# @axion/sdk

Official TypeScript / JavaScript SDK for [Axion](https://axion.ai).

## Install

```bash
npm install @axion/sdk
# or
pnpm add @axion/sdk
```

## Quick start

```ts
import { Axion, Workflow } from "@axion/sdk";

const ax = new Axion({ apiKey: process.env.AXION_API_KEY! });

// Hire your first agent
const iris = await ax.agents.hire({
  template: "sdr-outbound",
  name: "Iris",
  config: { icp: "VP Data, Series B+, Europe" },
  budgetPerDay: 500,
});

// Build a multi-agent workflow
const flow = new Workflow("deal-flow", "Weekly outbound")
  .step("source", {
    agent: iris.id,
    action: "source_leads",
    params: { n: 100 },
  })
  .step("qualify", {
    agent: "cfo-assistant",
    action: "qualify_margin",
    params: { margin_threshold_eur: 80_000 },
    dependsOn: ["source"],
  })
  .step("book", {
    agent: iris.id,
    action: "book_demos",
    dependsOn: ["qualify"],
    requiresApproval: true,
    approvalThresholdEur: 50_000,
  })
  .schedule("0 9 * * 1")
  .onBlocker({ escalateTo: "founder@helia.io" })
  .maxCost(20.0);

await ax.workflows.create("deal-flow", flow.spec);
await ax.workflows.publish("deal-flow");
const run = await ax.workflows.run("deal-flow", { target: 50 });
const final = await ax.workflows.waitForRun(run.id, { timeoutMs: 600_000 });
console.log(final.status, final.outputs);
```

## Configuration

| Option | Env var | Default |
|---|---|---|
| `apiKey` | `AXION_API_KEY` | required |
| `baseUrl` | `AXION_BASE_URL` | `https://api.axion.ai/v1` |
| `orgId` | `AXION_ORG_ID` | from token if single-org |
| `timeoutMs` | — | `30000` |

## Errors

```ts
import { AuthError, RateLimited, ServerError } from "@axion/sdk";

try {
  await ax.agents.hire({ ... });
} catch (e) {
  if (e instanceof RateLimited) { /* back off */ }
  else if (e instanceof AuthError) { /* re-auth */ }
}
```

## License

MIT.
