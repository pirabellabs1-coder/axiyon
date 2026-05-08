/** Agents resource. */
import type { Axion } from "../client.js";
import type { AgentInstance, AgentTemplate, Task } from "../types.js";

export interface HireOptions {
  template: string;
  name: string;
  config?: Record<string, unknown>;
  enabledTools?: string[];
  customPrompt?: string;
  voiceCloneId?: string;
  budgetPerDay?: number;
}

export class AgentsResource {
  constructor(private readonly _c: Axion) {}

  catalog(filter?: { category?: string; q?: string }): Promise<AgentTemplate[]> {
    return this._c._request<AgentTemplate[]>("GET", "/agents/catalog", {
      query: filter ?? {},
    });
  }

  template(slug: string): Promise<AgentTemplate> {
    return this._c._request<AgentTemplate>("GET", `/agents/catalog/${slug}`);
  }

  list(opts?: { status?: string }): Promise<AgentInstance[]> {
    return this._c._request<AgentInstance[]>("GET", "/agents", { query: opts });
  }

  get(agentId: string): Promise<AgentInstance> {
    return this._c._request<AgentInstance>("GET", `/agents/${agentId}`);
  }

  hire(opts: HireOptions): Promise<AgentInstance> {
    return this._c._request<AgentInstance>("POST", "/agents", {
      body: {
        template_slug: opts.template,
        name: opts.name,
        config: opts.config ?? {},
        enabled_tools: opts.enabledTools ?? [],
        custom_prompt: opts.customPrompt,
        voice_clone_id: opts.voiceCloneId,
        budget_per_day_eur: opts.budgetPerDay ?? 100,
      },
    });
  }

  update(agentId: string, fields: Partial<AgentInstance>): Promise<AgentInstance> {
    return this._c._request<AgentInstance>("PATCH", `/agents/${agentId}`, {
      body: fields,
    });
  }

  async delete(agentId: string): Promise<void> {
    await this._c._request("DELETE", `/agents/${agentId}`);
  }

  async pause(agentId: string): Promise<void> {
    await this._c._request("POST", `/agents/${agentId}/pause`);
  }

  async resume(agentId: string): Promise<void> {
    await this._c._request("POST", `/agents/${agentId}/resume`);
  }

  run(
    agentId: string,
    opts: { objective: string; inputs?: Record<string, unknown>; timeoutS?: number }
  ): Promise<Task> {
    return this._c._request<Task>("POST", `/agents/${agentId}/run`, {
      body: {
        objective: opts.objective,
        inputs: opts.inputs ?? {},
        timeout_s: opts.timeoutS ?? 300,
      },
    });
  }
}
