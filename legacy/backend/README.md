# Axion Backend

The brain of Axion: FastAPI + SQLAlchemy + Celery + multi-LLM router + agent runtime.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | FastAPI 0.115+ | Async-native, OpenAPI for free |
| ORM | SQLAlchemy 2 (async) | Battle-tested, types matter |
| Migrations | Alembic | Reproducible, reviewable |
| DB | Postgres 16 + pgvector | Single store for relational + vector |
| Cache & Pub-sub | Redis 7 | Celery broker + rate limiting |
| Workers | Celery 5 + Redis | Battle-tested, observable |
| LLM routing | Multi-provider (Anthropic, OpenAI, Mistral) | No vendor lock-in |
| Tracing | OpenTelemetry | Prod-grade observability |
| Auth | JWT (HS256, future RS256) + bcrypt | Simple, scoped, expires |
| Audit | SHA-256 chain (Merkle-style) | Tamper-evident |

## Quick start

```bash
cp .env.example .env
docker compose -f ../infrastructure/docker/docker-compose.yml up -d postgres redis
pip install -e ".[dev]"
alembic upgrade head
axion-api          # → http://localhost:8000/docs
# in another shell:
axion-worker       # Celery worker
```

Without LLM keys the system runs in stub mode — every provider returns deterministic
mock data so you can exercise agents end-to-end without external accounts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FastAPI (axion.main:app)                                   │
│  ├── /v1/auth         signup / login / refresh / me         │
│  ├── /v1/orgs         tenant management                     │
│  ├── /v1/agents       catalog + instances + ad-hoc runs     │
│  ├── /v1/workflows    DAG specs + runs + replay             │
│  ├── /v1/tasks        billable units of work                │
│  ├── /v1/memory       semantic recall + KG                  │
│  ├── /v1/audit        immutable, chained log + verifier     │
│  ├── /v1/billing      Stripe-backed subscriptions           │
│  ├── /v1/integrations OAuth tokens, encrypted at rest       │
│  └── /v1/webhooks     inbound Stripe + generic              │
└────────────┬────────────────────────────────────────────────┘
             │
   ┌─────────┴──────────────────────────────────────────────┐
   │  Agent Registry  ←→  Orchestrator (DAG engine)         │
   │  Generic + 5 specialized (Iris, Atlas, Sage, Codex…)   │
   └─────────┬──────────────────────────────────────────────┘
             │
   ┌─────────┴────────┬─────────────┬─────────────────────┐
   │ Tool Registry    │ Memory      │ LLM Router          │
   │ (16 tools)       │ (vector+KG) │ (Claude/GPT/Mistral)│
   └──────────────────┴─────────────┴─────────────────────┘
                                          │
                                  ┌───────┴────────┐
                                  │ Postgres+vector│
                                  │ Redis · S3     │
                                  └────────────────┘
```

## Code layout

```
src/axion/
├── main.py               FastAPI factory + middleware
├── config.py             Pydantic Settings
├── deps.py               FastAPI dependencies
├── api/v1/               10 route modules
├── core/                 auth, RBAC, audit chain
├── db/                   SQLAlchemy session/base
├── models/               9 ORM models
├── schemas/              Pydantic request/response
├── agents/               base + catalog + 5 specialized + generic
├── orchestrator/         workflow engine + router + replay
├── memory/               vector + episodic + KG
├── llm/                  router + 3 providers
├── tools/                registry + 16 integrations
└── workers/              Celery app + scheduled jobs
```

## Useful commands

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "describe_change"
alembic upgrade head

# Run tests
pytest -q
pytest --cov=src/axion --cov-report=term-missing

# Lint & format
ruff check src/ tests/
ruff format src/ tests/

# Type-check
mypy src/

# Run the worker
celery -A axion.workers.celery_app:celery_app worker -l INFO
celery -A axion.workers.celery_app:celery_app beat   -l INFO  # scheduled jobs
```

## Deployment

- Docker image: `docker build -t axion/api -f Dockerfile .`
- Helm chart in `../infrastructure/helm/`
- Terraform for AWS in `../infrastructure/terraform/`

## Security model

- All requests authenticated via Bearer JWT (or HMAC-signed webhook).
- Multi-tenancy enforced at the SQL layer via `org_id` filters in every query.
- RBAC with 5-level hierarchy (viewer < operator < builder < admin < owner).
- Secrets encrypted via envelope encryption (AWS KMS in prod).
- Audit log SHA-256 chained. Verifiable with `POST /v1/audit/verify`.
- All changes traceable via `X-Request-Id` and `X-Trace-Id` headers (OTLP-exported).
