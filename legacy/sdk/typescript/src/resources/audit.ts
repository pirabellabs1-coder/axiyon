/** Audit resource. */
import type { Axion } from "../client.js";
import type { AuditRecord } from "../types.js";

export class AuditResource {
  constructor(private readonly _c: Axion) {}

  list(filter: {
    actorType?: string;
    action?: string;
    resourceType?: string;
    since?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AuditRecord[]> {
    return this._c._request<AuditRecord[]>("GET", "/audit", {
      query: {
        actor_type: filter.actorType,
        action: filter.action,
        resource_type: filter.resourceType,
        since: filter.since,
        limit: filter.limit ?? 100,
        offset: filter.offset ?? 0,
      },
    });
  }

  verify(): Promise<{ ok: boolean; records_verified: number }> {
    return this._c._request("POST", "/audit/verify");
  }
}
