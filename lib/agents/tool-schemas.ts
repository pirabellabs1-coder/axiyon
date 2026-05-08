/**
 * Tool schemas — shared between server (AI SDK) and client (Puter).
 *
 * These describe ONLY the parameters; execution lives server-side at
 * `/api/tools/[name]/route.ts`.
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  search_leads: {
    name: "search_leads",
    description:
      "Search the web/LinkedIn for B2B leads matching an Ideal Customer Profile (ICP).",
    parameters: {
      type: "object",
      properties: {
        icp: { type: "string", description: "ICP description, e.g. 'VP Data, Series B+, EU'" },
        n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["icp"],
    },
  },

  enrich_lead: {
    name: "enrich_lead",
    description: "Enrich a lead with firmographic data (ARR signal, headcount, stack).",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        company: { type: "string" },
      },
      required: ["email", "company"],
    },
  },

  send_email: {
    name: "send_email",
    description: "Send a personalised email. Returns delivery + reply prediction.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },

  book_meeting: {
    name: "book_meeting",
    description: "Book a meeting on the user's calendar.",
    parameters: {
      type: "object",
      properties: {
        attendee_email: { type: "string" },
        duration_min: { type: "integer", minimum: 15, maximum: 120, default: 30 },
        topic: { type: "string" },
      },
      required: ["attendee_email"],
    },
  },

  fetch_revenue: {
    name: "fetch_revenue",
    description: "Fetch revenue/charges from billing for a period.",
    parameters: {
      type: "object",
      properties: { period: { type: "string", description: "e.g. '2026-04' or 'last_30d'" } },
      required: ["period"],
    },
  },

  calculate_margin: {
    name: "calculate_margin",
    description: "Estimate gross margin for one or more deal opportunities.",
    parameters: {
      type: "object",
      properties: {
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              industry: { type: "string" },
              arr_signal_eur: { type: "number" },
            },
            required: ["company"],
          },
        },
        threshold_eur: { type: "number", default: 80000 },
      },
      required: ["opportunities"],
    },
  },

  summarize_finances: {
    name: "summarize_finances",
    description: "Summarise the company's financial state.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      required: ["period"],
    },
  },

  search_logs: {
    name: "search_logs",
    description: "Search application logs (Datadog/CloudWatch).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        since: { type: "string", default: "1h" },
      },
      required: ["query"],
    },
  },

  list_pull_requests: {
    name: "list_pull_requests",
    description: "List open and recently merged pull requests.",
    parameters: {
      type: "object",
      properties: { repo: { type: "string" } },
    },
  },

  search_kb: {
    name: "search_kb",
    description: "Search the org's knowledge base / past resolutions / SOPs.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        k: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["query"],
    },
  },

  draft_response: {
    name: "draft_response",
    description: "Compose a polished customer-facing response.",
    parameters: {
      type: "object",
      properties: {
        ticket_summary: { type: "string" },
        tone: { type: "string", enum: ["empathetic", "direct", "neutral"], default: "empathetic" },
      },
      required: ["ticket_summary"],
    },
  },

  draft_outreach: {
    name: "draft_outreach",
    description: "Draft a recruitment outreach message tuned to a candidate.",
    parameters: {
      type: "object",
      properties: {
        candidate_name: { type: "string" },
        role_title: { type: "string" },
        hook: { type: "string" },
      },
      required: ["candidate_name", "role_title"],
    },
  },

  search_candidates: {
    name: "search_candidates",
    description: "Search for candidates matching a job description.",
    parameters: {
      type: "object",
      properties: {
        jd: { type: "string" },
        n: { type: "integer", minimum: 1, maximum: 30, default: 10 },
      },
      required: ["jd"],
    },
  },

  analyze_contract: {
    name: "analyze_contract",
    description: "Analyze a contract for risks against a checklist.",
    parameters: {
      type: "object",
      properties: {
        contract_text: { type: "string" },
        checklist: { type: "array", items: { type: "string" }, default: ["liability", "ip", "termination", "gdpr"] },
      },
      required: ["contract_text"],
    },
  },
};

export type ToolName = keyof typeof TOOL_SCHEMAS;
