/** Shared workflow types — used by API, runtime, UI. */
export interface WorkflowStepSpec {
  id: string;
  agent_slug: string;
  action: string;
  depends_on?: string[];
}

export interface WorkflowSpec {
  name: string;
  description?: string;
  schedule_cron?: string;
  steps: WorkflowStepSpec[];
}

export interface WorkflowStepOutput {
  id: string;
  agent_slug: string;
  status: "pending" | "running" | "succeeded" | "failed";
  text?: string;
  toolCalls?: unknown[];
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}
