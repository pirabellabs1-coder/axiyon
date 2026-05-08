/** Workflows resource. */
import type { Axion } from "../client.js";
import { AxionError } from "../errors.js";
import type { WorkflowSpec } from "../workflow.js";
import type { WorkflowRun } from "../types.js";

export class WorkflowsResource {
  constructor(private readonly _c: Axion) {}

  list(opts?: { status?: string }): Promise<unknown[]> {
    return this._c._request("GET", "/workflows", { query: opts });
  }

  get(slug: string, opts?: { version?: number }): Promise<unknown> {
    return this._c._request("GET", `/workflows/${slug}`, { query: opts });
  }

  create(slug: string, spec: WorkflowSpec): Promise<unknown> {
    return this._c._request("POST", "/workflows", { body: { slug, spec } });
  }

  publish(slug: string, opts?: { version?: number }): Promise<unknown> {
    return this._c._request("POST", `/workflows/${slug}/publish`, {
      query: opts,
    });
  }

  run(slug: string, inputs: Record<string, unknown> = {}): Promise<WorkflowRun> {
    return this._c._request<WorkflowRun>("POST", `/workflows/${slug}/run`, {
      body: { inputs },
    });
  }

  getRun(runId: string): Promise<WorkflowRun> {
    return this._c._request<WorkflowRun>("GET", `/workflows/runs/${runId}`);
  }

  getRunSteps(runId: string): Promise<unknown[]> {
    return this._c._request<unknown[]>("GET", `/workflows/runs/${runId}/steps`);
  }

  async cancelRun(runId: string): Promise<void> {
    await this._c._request("POST", `/workflows/runs/${runId}/cancel`);
  }

  replayRun(runId: string): Promise<WorkflowRun> {
    return this._c._request<WorkflowRun>(
      "POST",
      `/workflows/runs/${runId}/replay`
    );
  }

  async waitForRun(
    runId: string,
    opts: { pollIntervalMs?: number; timeoutMs?: number } = {}
  ): Promise<WorkflowRun> {
    const interval = opts.pollIntervalMs ?? 2_000;
    const deadline = Date.now() + (opts.timeoutMs ?? 600_000);
    const terminal = new Set(["succeeded", "failed", "cancelled", "awaiting_approval"]);
    while (Date.now() < deadline) {
      const run = await this.getRun(runId);
      if (terminal.has(run.status)) return run;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new AxionError(`Run ${runId} did not finish in time`);
  }
}
