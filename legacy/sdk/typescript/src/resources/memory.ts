/** Memory resource. */
import type { Axion } from "../client.js";
import type { MemoryEntry } from "../types.js";

export class MemoryResource {
  constructor(private readonly _c: Axion) {}

  ingest(opts: {
    content: string;
    kind?: string;
    importance?: number;
    source?: string;
    metadata?: Record<string, unknown>;
    agentId?: string;
  }): Promise<{ id: string; kind: string }> {
    return this._c._request("POST", "/memory/ingest", {
      body: {
        content: opts.content,
        kind: opts.kind ?? "semantic",
        importance: opts.importance ?? 0.5,
        source: opts.source,
        metadata: opts.metadata ?? {},
        agent_id: opts.agentId,
      },
    });
  }

  recall(opts: {
    query: string;
    k?: number;
    kind?: string;
    minImportance?: number;
  }): Promise<MemoryEntry[]> {
    return this._c._request<MemoryEntry[]>("POST", "/memory/recall", {
      body: {
        query: opts.query,
        k: opts.k ?? 8,
        kind: opts.kind,
        min_importance: opts.minImportance ?? 0,
      },
    });
  }

  export(opts: { kind?: string; limit?: number } = {}): Promise<MemoryEntry[]> {
    return this._c._request<MemoryEntry[]>("GET", "/memory/export", {
      query: { kind: opts.kind, limit: opts.limit ?? 10000 },
    });
  }
}
