/** Public types — mirror the OpenAPI schemas. */

export type AgentStatus = "idle" | "running" | "paused" | "error" | "archived";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "awaiting_approval";

export interface AgentTemplate {
  slug: string;
  name: string;
  role: string;
  category: string;
  description: string;
  icon: string;
  skills: string[];
  default_tools: string[];
  price_eur_monthly: number;
}

export interface AgentInstance {
  id: string;
  org_id: string;
  template_slug: string;
  name: string;
  status: AgentStatus;
  config: Record<string, unknown>;
  enabled_tools: string[];
  budget_per_day_eur: number;
  health_score: number;
  tasks_today: number;
  created_at: string;
}

export type Agent = AgentInstance;

export interface Task {
  id: string;
  org_id: string;
  agent_id: string;
  objective: string;
  status: TaskStatus;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  duration_ms: number | null;
  tokens_in: number;
  tokens_out: number;
  cost_eur: number;
  model_used: string | null;
  error: string | null;
  trace_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  cost_eur: number;
  error: string | null;
  triggered_by: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface MemoryEntry {
  id: string;
  kind: string;
  content: string;
  summary: string | null;
  importance: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditRecord {
  id: string;
  created_at: string;
  actor_type: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  payload: Record<string, unknown>;
  record_hash: string;
  prev_hash: string | null;
}
