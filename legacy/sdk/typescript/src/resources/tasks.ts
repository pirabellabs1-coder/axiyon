/** Tasks resource. */
import type { Axion } from "../client.js";
import type { Task } from "../types.js";

export class TasksResource {
  constructor(private readonly _c: Axion) {}

  list(filter: {
    status?: string;
    agentId?: string;
    workflowRunId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Task[]> {
    return this._c._request<Task[]>("GET", "/tasks", {
      query: {
        status: filter.status,
        agent_id: filter.agentId,
        workflow_run_id: filter.workflowRunId,
        limit: filter.limit,
        offset: filter.offset,
      },
    });
  }

  get(taskId: string): Promise<Task> {
    return this._c._request<Task>("GET", `/tasks/${taskId}`);
  }

  async cancel(taskId: string): Promise<void> {
    await this._c._request("POST", `/tasks/${taskId}/cancel`);
  }
}
