/** Fluent workflow builder. */

export interface WorkflowStepSpec {
  id: string;
  agent: string;
  action: string;
  params?: Record<string, unknown>;
  depends_on?: string[];
  timeout_s?: number;
  retry?: number;
  on_failure?: "fail" | "continue" | "escalate";
  requires_approval?: boolean;
  approval_threshold_eur?: number | null;
}

export interface WorkflowSpec {
  name: string;
  description?: string | null;
  schedule_cron?: string | null;
  inputs_schema?: Record<string, unknown>;
  steps: WorkflowStepSpec[];
  on_blocker?: { escalate_to?: string };
  max_cost_eur?: number | null;
}

interface StepArgs {
  agent: string;
  action: string;
  params?: Record<string, unknown>;
  dependsOn?: string[];
  timeoutS?: number;
  retry?: number;
  onFailure?: "fail" | "continue" | "escalate";
  requiresApproval?: boolean;
  approvalThresholdEur?: number;
}

export class Workflow {
  private readonly _spec: WorkflowSpec;

  constructor(name: string, description?: string) {
    this._spec = {
      name,
      description: description ?? null,
      schedule_cron: null,
      inputs_schema: {},
      steps: [],
      on_blocker: {},
      max_cost_eur: null,
    };
  }

  step(id: string, args: StepArgs): this {
    this._spec.steps.push({
      id,
      agent: args.agent,
      action: args.action,
      params: args.params ?? {},
      depends_on: args.dependsOn ?? [],
      timeout_s: args.timeoutS ?? 300,
      retry: args.retry ?? 2,
      on_failure: args.onFailure ?? "fail",
      requires_approval: args.requiresApproval ?? false,
      approval_threshold_eur: args.approvalThresholdEur,
    });
    return this;
  }

  schedule(cron: string): this {
    this._spec.schedule_cron = cron;
    return this;
  }

  inputs(schema: Record<string, unknown>): this {
    this._spec.inputs_schema = schema;
    return this;
  }

  onBlocker(opts: { escalateTo: string }): this {
    this._spec.on_blocker = { escalate_to: opts.escalateTo };
    return this;
  }

  maxCost(eur: number): this {
    this._spec.max_cost_eur = eur;
    return this;
  }

  get spec(): WorkflowSpec {
    return this._spec;
  }
}
