# API Reference — Axion v1

Base URL: `https://api.axion.ai/v1` (production) · `http://localhost:8000/v1` (dev)

All requests require a Bearer token in the `Authorization` header. Multi-org users pass `X-Org-Id`.

OpenAPI spec: [openapi.yaml](./openapi.yaml) · live at `/v1/openapi.json`.

---

## Authentication

### `POST /v1/auth/signup`
Create a user + initial org. Returns a token pair.

```http
POST /v1/auth/signup
Content-Type: application/json

{
  "email": "claire@helia.io",
  "full_name": "Claire Laporte",
  "password": "correct horse battery staple",
  "org_name": "Helia"
}

→ 201 Created
{
  "access_token":  "eyJ…",
  "refresh_token": "eyJ…",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### `POST /v1/auth/login`
Exchange email + password for token pair.

### `POST /v1/auth/refresh`
Exchange a refresh token for a new pair.

### `GET /v1/auth/me`
Get the authenticated user.

### `POST /v1/auth/logout`
204. Stateless — client deletes its tokens.

---

## Orgs

### `GET /v1/orgs`
List orgs the user belongs to.

### `GET /v1/orgs/current`
Get the active org (resolved from token + `X-Org-Id`).

### `PATCH /v1/orgs/current`  *(admin+)*

```json
{ "name": "...", "domain": "...", "settings": { "..." } }
```

### `GET /v1/orgs/current/members`

### `POST /v1/orgs/current/invite`  *(admin+)*

```json
{ "email": "alice@helia.io", "role": "operator" }
```

### `DELETE /v1/orgs/current/members/{member_id}`  *(admin+)*

---

## Agents

### `GET /v1/agents/catalog`
List the catalog of agent templates.

Query: `category` (sales|support|finance|hr|eng|ops|marketing|legal|data|content) · `q` (text search)

### `GET /v1/agents/catalog/{slug}`
Single template detail.

### `GET /v1/agents`
List your hired agents. Query: `status`.

### `POST /v1/agents`  *(builder+)*  Hire an agent.

```json
{
  "template_slug": "sdr-outbound",
  "name": "Iris",
  "config": { "icp": "VP Data, Series B+, Europe", "target_count": 50, "margin_threshold_eur": 80000 },
  "enabled_tools": ["linkedin.search", "apollo.enrich", "email.send", "calendar.book"],
  "custom_prompt": null,
  "voice_clone_id": null,
  "budget_per_day_eur": 500
}
```

### `GET /v1/agents/{id}`
### `PATCH /v1/agents/{id}`  *(builder+)*
### `DELETE /v1/agents/{id}`  *(admin+)*
### `POST /v1/agents/{id}/pause`  *(operator+)*
### `POST /v1/agents/{id}/resume`  *(operator+)*

### `POST /v1/agents/{id}/run`  *(operator+)*  Trigger ad-hoc.

```json
{
  "objective": "Source 50 ICP leads, qualify, book demos.",
  "inputs": { "n": 50 },
  "timeout_s": 300
}

→ 202 Accepted
{
  "id": "task-uuid",
  "status": "queued",
  "agent_id": "...",
  ...
}
```

---

## Workflows

### `GET /v1/workflows` — list latest version per slug
### `POST /v1/workflows`  *(builder+)*  Create or new version.

```json
{
  "slug": "deal-flow",
  "spec": {
    "name": "Deal Flow",
    "description": "Weekly outbound",
    "schedule_cron": "0 9 * * 1",
    "steps": [
      {
        "id": "source",
        "agent": "sdr-outbound",
        "action": "source_leads",
        "params": { "n": 100 },
        "depends_on": [],
        "timeout_s": 300, "retry": 2, "on_failure": "fail",
        "requires_approval": false
      },
      { "id": "qualify", "agent": "cfo-assistant", "action": "qualify_margin",
        "params": { "margin_threshold_eur": 80000 }, "depends_on": ["source"] },
      { "id": "book", "agent": "sdr-outbound", "action": "book_demos",
        "depends_on": ["qualify"],
        "requires_approval": true, "approval_threshold_eur": 50000 }
    ],
    "on_blocker": { "escalate_to": "founder@helia.io" },
    "max_cost_eur": 20.0
  }
}
```

### `GET /v1/workflows/{slug}` — query `?version=N` for a specific version
### `POST /v1/workflows/{slug}/publish`  *(admin+)*
### `POST /v1/workflows/{slug}/run`  *(operator+)*

```json
{ "inputs": { "target": 50 } }
→ 202
{ "id": "run-uuid", "status": "pending", ... }
```

### `GET /v1/workflows/runs/{run_id}`
### `GET /v1/workflows/runs/{run_id}/steps`
### `POST /v1/workflows/runs/{run_id}/cancel`  *(operator+)*
### `POST /v1/workflows/runs/{run_id}/replay`  *(builder+)*

---

## Tasks

### `GET /v1/tasks`
Filters: `status`, `agent_id`, `workflow_run_id`, `limit`, `offset`.

### `GET /v1/tasks/{id}`
### `POST /v1/tasks/{id}/cancel`

---

## Memory

### `POST /v1/memory/ingest`

```json
{
  "content": "Stripe is one of our top 5 customers. ARR ~ 18M€",
  "kind": "client",          // semantic | episodic | procedural | client | task
  "importance": 0.9,
  "source": "crm",
  "metadata": { "customer_id": "stripe" }
}
```

### `POST /v1/memory/recall`

```json
{ "query": "Top customers by ARR", "k": 8, "kind": "client", "min_importance": 0.5 }
```

### `GET /v1/memory/export?kind=client&limit=10000`
Full export — your data, your right.

### `GET /v1/memory/kg/{node_id}`
Get a knowledge-graph node by ID.

---

## Audit

### `GET /v1/audit`  *(admin+)*
Filters: `actor_type`, `action`, `resource_type`, `since`, `limit`, `offset`.

### `POST /v1/audit/verify`  *(admin+)*
Re-walk the cryptographic chain. `{ ok: true, records_verified: N }`.

---

## Billing

### `GET /v1/billing/subscription`
### `POST /v1/billing/subscription/change`  *(admin+)*

```json
{ "tier": "growth", "annual": true }
```

### `GET /v1/billing/usage`
Tasks/cost/tokens for the current billing period.

### `GET /v1/billing/invoices`

---

## Integrations

### `GET /v1/integrations`
### `POST /v1/integrations`  *(admin+)*  After completing OAuth flow.

```json
{
  "kind": "salesforce",
  "label": "Helia · Production",
  "external_account_id": "00D5g000000abcDEF",
  "token": "00D…",
  "refresh_token": "5Aep…",
  "scopes": ["api", "refresh_token"]
}
```

### `DELETE /v1/integrations/{id}`  *(admin+)*

---

## Webhooks (inbound)

### `POST /v1/webhooks/stripe`
Stripe events (signed via `Stripe-Signature`).

### `POST /v1/webhooks/generic/{slug}`
Receive arbitrary events from third-party tools. Authenticated via HMAC-SHA256 over the body in `X-Axion-Signature`.

---

## Errors

```json
{ "detail": "Reason in plain English", "request_id": "abc..." }
```

| Status | Meaning |
|---|---|
| 400 | Bad request — fix the body |
| 401 | Missing or invalid token |
| 403 | Authenticated but role too low |
| 404 | Resource not found in your org |
| 409 | Conflict (duplicate slug, etc.) |
| 422 | Body failed validation |
| 429 | Rate-limited; retry with backoff |
| 5xx | Server error; retry with exponential backoff up to 3 times |

## Rate limits

- 50 req/s burst, 1000 req/min sustained per JWT.
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- 429 response includes a `Retry-After` header in seconds.

## Pagination

List endpoints accept `limit` (max 500) and `offset`. Use these consistently to walk a result set.

## Versioning

- The base path `/v1` will not break compatibly.
- New optional fields may be added at any time. Clients must ignore unknown fields.
- Breaking changes ship under `/v2` with a 12-month deprecation notice on `/v1`.
