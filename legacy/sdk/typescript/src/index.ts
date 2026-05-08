/**
 * @axion/sdk — Official TypeScript SDK for Axion.
 *
 * @example
 * ```ts
 * import { Axion, Workflow } from "@axion/sdk";
 *
 * const ax = new Axion({ apiKey: process.env.AXION_API_KEY! });
 * const iris = await ax.agents.hire({
 *   template: "sdr-outbound",
 *   name: "Iris",
 *   config: { icp: "VP Data, Series B+, Europe" },
 *   budgetPerDay: 500,
 * });
 *
 * const flow = new Workflow("deal-flow")
 *   .step("source", { agent: iris.id, action: "source_leads", params: { n: 100 } })
 *   .step("qualify", { agent: "cfo-assistant", action: "qualify_margin",
 *                      params: { margin_threshold_eur: 80_000 }, dependsOn: ["source"] })
 *   .step("book",    { agent: iris.id, action: "book_demos", dependsOn: ["qualify"] })
 *   .onBlocker({ escalateTo: "founder@helia.io" });
 *
 * await ax.workflows.create("deal-flow", flow.spec);
 * await ax.workflows.publish("deal-flow");
 * const run = await ax.workflows.run("deal-flow", { target: 50 });
 * const done = await ax.workflows.waitForRun(run.id);
 * ```
 *
 * @module
 */
export { Axion } from "./client.js";
export type { AxionOptions } from "./client.js";
export { Workflow } from "./workflow.js";
export type { WorkflowSpec, WorkflowStepSpec } from "./workflow.js";
export {
  AxionError,
  AuthError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimited,
  ServerError,
} from "./errors.js";
export type {
  Agent,
  AgentInstance,
  AgentTemplate,
  Task,
  TaskStatus,
  WorkflowRun,
  WorkflowRunStatus,
  MemoryEntry,
  AuditRecord,
} from "./types.js";
