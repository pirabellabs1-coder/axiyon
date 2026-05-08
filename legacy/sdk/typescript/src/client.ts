/** Axion HTTP client (uses native fetch). */
import {
  AuthError,
  AxionError,
  ConflictError,
  NotFoundError,
  RateLimited,
  ServerError,
  ValidationError,
} from "./errors.js";
import { AgentsResource } from "./resources/agents.js";
import { AuditResource } from "./resources/audit.js";
import { MemoryResource } from "./resources/memory.js";
import { TasksResource } from "./resources/tasks.js";
import { WorkflowsResource } from "./resources/workflows.js";

const DEFAULT_BASE_URL = "https://api.axion.ai/v1";

export interface AxionOptions {
  apiKey?: string;
  baseUrl?: string;
  orgId?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetch?: typeof fetch;
}

export class Axion {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly orgId: string | undefined;
  readonly timeoutMs: number;
  private readonly _fetch: typeof fetch;
  private readonly _userAgent: string;

  readonly agents: AgentsResource;
  readonly workflows: WorkflowsResource;
  readonly tasks: TasksResource;
  readonly memory: MemoryResource;
  readonly audit: AuditResource;

  constructor(opts: AxionOptions = {}) {
    const apiKey = opts.apiKey ?? globalThis.process?.env?.AXION_API_KEY;
    if (!apiKey) {
      throw new AuthError(
        "Missing API key. Pass `{ apiKey }` or set AXION_API_KEY."
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (
      opts.baseUrl ??
      globalThis.process?.env?.AXION_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.orgId = opts.orgId ?? globalThis.process?.env?.AXION_ORG_ID;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this._fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this._userAgent = opts.userAgent ?? "axion-typescript/1.0.0";

    this.agents = new AgentsResource(this);
    this.workflows = new WorkflowsResource(this);
    this.tasks = new TasksResource(this);
    this.memory = new MemoryResource(this);
    this.audit = new AuditResource(this);
  }

  async _request<T = unknown>(
    method: string,
    path: string,
    init?: { body?: unknown; query?: Record<string, unknown> }
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(init?.query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": this._userAgent,
      Accept: "application/json",
    };
    if (this.orgId) headers["X-Org-Id"] = this.orgId;
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this._fetch(url.toString(), {
        method,
        headers,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      throw new AxionError(`Network error: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    return this._handle<T>(response);
  }

  private async _handle<T>(r: Response): Promise<T> {
    const text = await r.text();
    let body: unknown = text;
    if (text && r.headers.get("content-type")?.startsWith("application/json")) {
      try {
        body = JSON.parse(text);
      } catch {
        /* keep as text */
      }
    }
    if (r.ok) return body as T;

    const detail =
      (body as { detail?: string } | undefined)?.detail ?? text ?? r.statusText;
    switch (r.status) {
      case 401:
      case 403:
        throw new AuthError(detail);
      case 404:
        throw new NotFoundError(detail);
      case 409:
        throw new ConflictError(detail);
      case 422:
        throw new ValidationError(detail);
      case 429:
        throw new RateLimited(detail);
      default:
        if (r.status >= 500) throw new ServerError(detail, r.status);
        throw new AxionError(`${r.status}: ${detail}`, r.status);
    }
  }
}
