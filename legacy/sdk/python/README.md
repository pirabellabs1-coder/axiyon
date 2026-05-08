# axion — Python SDK

Official Python client for [Axion](https://axion.ai). Hire AI employees, orchestrate them as workflows, and monitor every action — from your code.

## Install

```bash
pip install axion
```

## Quick start

```python
from axion import Axion, Workflow

ax = Axion(api_key="axn_live_...")

# Hire your first agent
iris = ax.agents.hire(
    template="sdr-outbound",
    name="Iris",
    config={"icp": "VP Data, Series B+, Europe"},
    budget_per_day=500,
)

# Or build a multi-agent workflow
flow = (
    Workflow("deal-flow", description="Weekly outbound")
    .step("source",  agent="sdr-outbound", action="source_leads",
          params={"n": 100})
    .step("qualify", agent="cfo-assistant", action="qualify_margin",
          params={"margin_threshold_eur": 80_000},
          depends_on=["source"])
    .step("book",    agent="sdr-outbound", action="book_demos",
          depends_on=["qualify"],
          requires_approval=True, approval_threshold_eur=50_000)
    .schedule("0 9 * * 1")
    .on_blocker(escalate_to="founder@helia.io")
    .max_cost(20.0)
)

ax.workflows.create("deal-flow", flow.spec)
ax.workflows.publish("deal-flow")
run = ax.workflows.run("deal-flow", inputs={"target": 50})
final = ax.workflows.wait_for_run(run["id"], timeout_s=600)
print(final["status"], final["outputs"])
```

## Configuration

| Param | Env var | Default |
|---|---|---|
| `api_key` | `AXION_API_KEY` | required |
| `base_url` | `AXION_BASE_URL` | `https://api.axion.ai/v1` |
| `org_id` | `AXION_ORG_ID` | from token if single-org |

## Resources

- `ax.agents` — catalog, hire, list, run, pause/resume, delete
- `ax.workflows` — create, publish, run, wait, replay, cancel
- `ax.tasks` — list, get, cancel
- `ax.memory` — ingest, recall, export
- `ax.audit` — list, verify chain

## Errors

All errors inherit from `axion.errors.AxionError`:

- `AuthError` (401/403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `ValidationError` (422)
- `RateLimited` (429)
- `ServerError` (5xx)

## License

MIT.
