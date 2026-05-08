# Architecture — Axion

> Engineering reference. Last updated: May 2026.

This document describes how the Axion platform is built, deployed, and operated. Read this before changing anything load-bearing.

---

## 1. System overview

Axion is a multi-tenant SaaS that lets organizations hire **AI employees** (agents), orchestrate them as **multi-step workflows**, and observe every action via an immutable audit log.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Browser / SDK / CLI                        │
└──────────────┬───────────────────────────────────────────────┬──────────┘
               │ HTTPS · Bearer JWT · TLS 1.3                  │
               ▼                                               ▼
        ┌──────────────────┐                       ┌──────────────────────┐
        │  axion-api       │  ◄──────  K8s HPA ──► │  axion-worker        │
        │  FastAPI · 4-40  │                       │  Celery · 8-100      │
        │  uvicorn · async │                       │  agents + workflows  │
        └────┬─────────────┘                       └─────────┬────────────┘
             │                                               │
             │   shared in-process registries:               │
             │   AgentRegistry · ToolRegistry · LLMRouter    │
             │                                               │
             ▼                                               ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Postgres 16 + pgvector  ·  Redis 7 (Celery + cache)                 │
   │  S3 (audit replay, immutable, object-lock 10y)                       │
   │  KMS (envelope encryption for tokens, secrets)                       │
   └──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │   LLM providers · Anthropic · OpenAI · Mistral (multi-route fallback)│
   │   Tool integrations · Salesforce · Stripe · Slack · GitHub · 12 more │
   └──────────────────────────────────────────────────────────────────────┘
```

## 2. Layered architecture

| Layer | Responsibility | Code path |
|---|---|---|
| **L5 — Interface** | Web console, CLI, SDKs, IDE plugins | `axion/index.html`, `cli/`, `sdk/python`, `sdk/typescript` |
| **L4 — Orchestration** | Workflow DAG, multi-agent routing, replay | `backend/src/axion/orchestrator/` |
| **L3 — Agents** | Catalog templates + per-org instances | `backend/src/axion/agents/` |
| **L2 — Memory & Governance** | Vector recall, KG, RBAC, audit chain, budgets | `memory/`, `core/` |
| **L1 — Models & Tools** | Multi-LLM router, tool registry | `llm/`, `tools/` |
| **L0 — Infra** | Postgres + Redis + S3 + KMS + EKS | `infrastructure/` |

## 3. Request lifecycle (POST `/v1/agents/{id}/run`)

```
1. Client                  →  POST /v1/agents/abc/run  +  Bearer JWT
2. FastAPI middleware      →  CORS · OTel span · X-Request-Id
3. deps.get_current_user   →  decode JWT (HS256)
4. deps.get_current_org_id →  resolve active tenant
5. require_role(OPERATOR)  →  RBAC check vs. OrgMember.role
6. INSERT tasks (queued)
7. registry.dispatch_task  →  Celery in prod, asyncio in dev
8. core.audit              →  append SHA-chained record
9. ORJSON 202 response     →  client gets task object

… meanwhile in worker:
10. registry.execute_task  →  load AgentInstance + template
11. AgentRegistry.get(slug)→  IrisSDR | AtlasCFO | Codex | … | GenericAgent
12. agent.run(ctx)         →  loop: think → call_tool → observe
13. tool registry          →  apollo.enrich, salesforce.update, etc.
14. llm.router.complete    →  Claude → GPT → Mistral fallback chain
15. memory.store.ingest    →  vector + summary, importance
16. UPDATE tasks (succeeded) + agent_instances.health_score
17. core.audit             →  append final record
```

## 4. Data model

ER diagram (simplified):

```
User ─< OrgMember >─ Org
                      │
                      ├─< AgentInstance ──< Task
                      ├─< Workflow ─< WorkflowRun ─< WorkflowStep
                      ├─< MemoryEntry
                      ├─< KnowledgeNode
                      ├─< AuditLog (chained by record_hash)
                      ├─< Integration (encrypted tokens)
                      ├─  Subscription
                      ├─  BillingAccount
                      └─< Invoice
```

Every row in every tenant table carries `org_id`. Every query in the API filters by it. The orchestrator carries `org_id` through `AgentContext`.

## 5. Multi-tenancy & isolation

- **Logical isolation** by `org_id` on every read/write.
- **Tokens isolated** via JWT claims (`org_id`) plus `X-Org-Id` override for multi-org users.
- **Optional VPC mode**: separate dedicated EKS cluster per Enterprise tenant, namespace per env.
- **On-prem mode**: Helm chart deployable into customer K8s, no outbound traffic to Axion infra (except license heartbeat).

## 6. Workflow execution

Workflows are JSON specs (declarative) executed by a **DAG engine**:

1. `WorkflowSpec` parsed from `workflows.spec` JSONB column.
2. Steps topologically sorted (Kahn's algorithm; cycles detected and rejected).
3. Each step runs through `AgentRegistry.execute_task()` which dispatches to the right agent class.
4. Step `requires_approval=True` halts the run with `awaiting_approval` until a human resumes it via `POST /v1/workflows/runs/{id}/approve`.
5. Step `on_failure="escalate"` triggers the `on_blocker.escalate_to` notification (email/Slack).
6. Each step row stores its full input/output JSON → 100% replayable.

## 7. LLM routing

The router (`axion.llm.router.LLMRouter`) picks a provider × model pair based on `RoutingPolicy`:

| Policy | Primary | Fallback |
|---|---|---|
| `quality` | claude-opus-4-7 | gpt-4o → mistral-large-2 |
| `balanced` (default) | claude-sonnet-4-7 | gpt-4o-mini → mistral-medium |
| `cheap` | gpt-4o-mini | claude-haiku-4-7 → mistral-small |
| `latency` | claude-haiku-4-7 | gpt-4o-mini |

Each provider is wrapped in a `LLMProvider` ABC that translates Axion-shaped requests to provider-native ones (system, tools, history → `messages` for OpenAI, blocks for Anthropic, etc.). Cost is computed at the call site using a per-model price table (`PRICING`).

If **no API keys** are configured, the router uses `NullProvider` — agents still execute deterministically using mock data, which makes the entire system testable offline.

## 8. Memory

```
MemoryStore
├── ingest(content, kind, importance, source) → embed → INSERT
├── recall(query, k, kind, min_importance)
│      → embed(query) → cosine vs. last 500 candidates → score by importance
│      → top-k
└── upsert_kg / link_nodes / neighborhood
```

Embeddings:
- **Production**: OpenAI `text-embedding-3-large` (1536-dim).
- **Offline / no key**: deterministic SHA-based 1536-dim vector (so unit tests are reproducible).
- pgvector cosine in production for sub-millisecond recall at scale.

## 9. Audit chain

Every state-changing action calls `core.audit(...)` which:

1. Reads the previous record's `record_hash` (SHA-256 hex) for that org.
2. Computes `record_hash = SHA256(prev_hash || canonical_json(payload))`.
3. Appends an `AuditLog` row.

`POST /v1/audit/verify` re-walks the chain and confirms each link. Tampering breaks the chain. In production we additionally:
- Sign each row with KMS (AWS sign API) → tamper-evident even against DBA-level attackers.
- Stream rows to an S3 bucket with **Object-Lock COMPLIANCE mode** (10-year retention) → tamper-proof.

## 10. Security

- **TLS 1.3** everywhere; HSTS preload, `Strict-Transport-Security: max-age=63072000`.
- **JWT** HS256 (will move to RS256 + JWKS endpoint in 1.1). 60-min access, 30-day refresh.
- **Bcrypt** for passwords, work factor 12.
- **OAuth tokens** for integrations encrypted at rest with AES-GCM, key from KMS data-key. Toy XOR placeholder in dev only.
- **RBAC**: `viewer < operator < builder < admin < owner`. `require_role(min)` on every state-changing route.
- **Rate limiting**: per-tenant token bucket in Redis (50 req/s burst, 1000 req/min).
- **Pod security**: restricted PodSecurityStandard, read-only rootfs, drop ALL caps, run as 1000:1000 non-root.
- **Network policies**: default-deny, explicit allow only to RDS / Redis / outbound 443.

## 11. Observability

- **Logs**: structlog JSON to stdout, shipped to CloudWatch and Loki.
- **Metrics**: Prometheus `/metrics` endpoint (request count + latency histogram, custom counters for tasks/workflows/agents).
- **Traces**: OpenTelemetry, exported to Jaeger / Datadog APM.
- **Headers exposed** to clients: `X-Request-Id`, `X-Trace-Id`, `X-Response-Time-Ms`.

## 12. Deployment

| Mode | When | How |
|---|---|---|
| **SaaS** (default) | Most customers | Helm into our EKS, multi-tenant |
| **VPC** | Enterprise · regulated | Helm into customer's VPC-peered EKS |
| **On-prem** | Banking / public sector | Helm into customer K8s + airgapped image bundle |

Production EKS: 3 AZs, 4 m7i.large for API + 8 m7i.xlarge for workers + spot autoscaling. RDS `db.r7g.2xlarge` Multi-AZ. ElastiCache Redis 3-node cluster.

## 13. Scaling profile (May 2026)

- 18 M€ ARR, 4 200 customers, 11 800 agents in production
- ~ 1,2 Md tasks executed / month
- p99 API latency: 240 ms (most routes), 800 ms (recall under load)
- Voice: < 200 ms turnaround end-to-end
- Uptime SLA: 99.98% (achieved Q1 2026)

## 14. Future work

| Item | Quarter |
|---|---|
| RS256 + JWKS endpoint | Q3 2026 |
| Per-org dedicated VPC tenants | Q4 2026 |
| FedRAMP Moderate | Q1 2027 |
| Robotic agents (physical-world tools) | 2028 |
| Axion-Tuned proprietary models | 2029 |
