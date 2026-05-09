/**
 * Tool schemas — partagés entre serveur (AI SDK) et client (Puter).
 *
 * IMPORTANT — chaque outil défini dans `lib/agents/tools.ts` doit avoir une
 * entrée ici, sinon le LLM (côté navigateur via Puter) ignore l'outil et croit
 * ne pas pouvoir l'appeler. Le serveur fait l'autorité sur l'exécution réelle ;
 * ce fichier sert uniquement à exposer la signature au modèle.
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  // ── EMAIL ────────────────────────────────────────────────────────
  send_email: {
    name: "send_email",
    description:
      "Send a real email. Tries Gmail (if Google connected), then Outlook (Microsoft 365), then SendGrid. Falls back to a preview if no provider is connected.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email." },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "string" },
        bcc: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  search_emails: {
    name: "search_emails",
    description:
      "Search the user's mailbox (Gmail or Outlook, whichever is connected). Returns recent matching messages with subject, snippet, from, date.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (Gmail/Outlook syntax, e.g. 'from:billing newer_than:7d').",
        },
        n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["query"],
    },
  },

  // ── CALENDAR ─────────────────────────────────────────────────────
  book_meeting: {
    name: "book_meeting",
    description:
      "Create a real calendar event in Google Calendar or Microsoft 365 and send invites. Use ISO 8601 datetimes.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Event title." },
        start_iso: { type: "string", description: "Start datetime (ISO 8601)." },
        end_iso: { type: "string", description: "End datetime (ISO 8601)." },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Attendee emails.",
        },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["summary", "start_iso", "end_iso"],
    },
  },
  list_calendar_events: {
    name: "list_calendar_events",
    description: "List upcoming calendar events from the connected Google Calendar.",
    parameters: {
      type: "object",
      properties: {
        since_days: { type: "integer", minimum: 0, maximum: 60, default: 0 },
        n: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
    },
  },

  // ── VOICE / SMS ──────────────────────────────────────────────────
  make_phone_call: {
    name: "make_phone_call",
    description:
      "Place a real phone call via Twilio. ALWAYS requires human approval (high-stakes). Provide either a `message` to be spoken or a TwiML URL.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "E.164 phone number, e.g. +33...." },
        message: { type: "string", description: "Message to speak (wrapped in <Say>)." },
        twiml_url: { type: "string", description: "Custom TwiML URL." },
      },
      required: ["to"],
    },
  },
  send_sms: {
    name: "send_sms",
    description: "Send a real SMS via Twilio. Always requires human approval.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        body: { type: "string", maxLength: 1600 },
      },
      required: ["to", "body"],
    },
  },
  list_phone_numbers: {
    name: "list_phone_numbers",
    description: "List the org's owned Twilio phone numbers.",
    parameters: { type: "object", properties: {} },
  },

  // ── CRM (HubSpot + Salesforce) ───────────────────────────────────
  crm_create_contact: {
    name: "crm_create_contact",
    description:
      "Create a contact in the connected CRM. Tries HubSpot first, then Salesforce (as a Lead).",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        company: { type: "string" },
        phone: { type: "string" },
        jobtitle: { type: "string" },
      },
      required: ["email"],
    },
  },
  crm_search_contact: {
    name: "crm_search_contact",
    description: "Search contacts/accounts across the connected CRM (HubSpot, Salesforce).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["query"],
    },
  },
  crm_create_deal: {
    name: "crm_create_deal",
    description: "Create a deal/opportunity in the connected CRM.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount_eur: { type: "number" },
        close_date_iso: { type: "string" },
        stage: { type: "string" },
        contact_id: { type: "string" },
      },
      required: ["name"],
    },
  },
  crm_create_note: {
    name: "crm_create_note",
    description: "Attach a note to a contact or deal in HubSpot.",
    parameters: {
      type: "object",
      properties: {
        body: { type: "string" },
        contact_id: { type: "string" },
        deal_id: { type: "string" },
      },
      required: ["body"],
    },
  },

  // ── MESSAGING ────────────────────────────────────────────────────
  slack_post: {
    name: "slack_post",
    description: "Post a message in a Slack channel (use channel ID or #name).",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string" },
        text: { type: "string" },
      },
      required: ["channel", "text"],
    },
  },
  slack_list_channels: {
    name: "slack_list_channels",
    description: "List Slack channels the workspace can post to.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      },
    },
  },
  slack_dm: {
    name: "slack_dm",
    description: "Send a Slack direct message to a user (by user ID).",
    parameters: {
      type: "object",
      properties: {
        user: { type: "string" },
        text: { type: "string" },
      },
      required: ["user", "text"],
    },
  },
  teams_post: {
    name: "teams_post",
    description: "Post a message in a Microsoft Teams channel.",
    parameters: {
      type: "object",
      properties: {
        team_id: { type: "string" },
        channel_id: { type: "string" },
        text: { type: "string" },
      },
      required: ["team_id", "channel_id", "text"],
    },
  },

  // ── CODE / GITHUB ────────────────────────────────────────────────
  github_create_issue: {
    name: "github_create_issue",
    description: "Open a new GitHub issue.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/repo" },
        title: { type: "string" },
        body: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
      },
      required: ["repo", "title"],
    },
  },
  github_list_prs: {
    name: "github_list_prs",
    description: "List pull requests for a repo.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
      },
      required: ["repo"],
    },
  },
  github_dispatch_workflow: {
    name: "github_dispatch_workflow",
    description: "Trigger a GitHub Actions workflow_dispatch event.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string" },
        workflow_id: { type: "string" },
        ref: { type: "string", default: "main" },
        inputs: { type: "object" },
      },
      required: ["repo", "workflow_id"],
    },
  },

  // ── DOCS / NOTION ────────────────────────────────────────────────
  notion_create_page: {
    name: "notion_create_page",
    description: "Create a Notion page from markdown.",
    parameters: {
      type: "object",
      properties: {
        parent_page_id: { type: "string" },
        title: { type: "string" },
        markdown: { type: "string" },
      },
      required: ["parent_page_id", "title", "markdown"],
    },
  },
  notion_search: {
    name: "notion_search",
    description: "Search the connected Notion workspace.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["query"],
    },
  },

  // ── PAYMENTS / STRIPE ────────────────────────────────────────────
  stripe_create_customer: {
    name: "stripe_create_customer",
    description: "Create a Stripe customer.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
      },
      required: ["email"],
    },
  },
  stripe_create_invoice: {
    name: "stripe_create_invoice",
    description:
      "Create a finalised Stripe invoice for a customer. Requires human approval if amount > 100 EUR.",
    parameters: {
      type: "object",
      properties: {
        customer: { type: "string", description: "Stripe customer ID." },
        amount_cents: { type: "integer", minimum: 1 },
        currency: { type: "string", default: "eur" },
        description: { type: "string" },
      },
      required: ["customer", "amount_cents"],
    },
  },
  stripe_list_charges: {
    name: "stripe_list_charges",
    description: "List recent Stripe charges.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
      },
    },
  },

  // ── PROSPECTING / APOLLO ─────────────────────────────────────────
  search_leads: {
    name: "search_leads",
    description: "Search B2B prospects via Apollo.io. Falls back to demo data if Apollo isn't connected.",
    parameters: {
      type: "object",
      properties: {
        icp: { type: "string", description: "ICP, e.g. 'VP Data, Series B+, EU'." },
        n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["icp"],
    },
  },
  enrich_lead: {
    name: "enrich_lead",
    description: "Enrich a lead with firmographic data via Apollo.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        company: { type: "string" },
      },
    },
  },
  search_candidates: {
    name: "search_candidates",
    description: "Search candidates matching a job description via Apollo.",
    parameters: {
      type: "object",
      properties: {
        jd: { type: "string", description: "Job description or title." },
        n: { type: "integer", minimum: 1, maximum: 30, default: 10 },
      },
      required: ["jd"],
    },
  },

  // ── MEMORY (always real, persisted in Postgres) ──────────────────
  search_kb: {
    name: "search_kb",
    description: "Search the org's persistent knowledge base (semantic + relevance).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        k: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["query"],
    },
  },
  ingest_to_kb: {
    name: "ingest_to_kb",
    description: "Save a fact / SOP / lesson to the org's persistent memory so future agents can recall it.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        kind: {
          type: "string",
          enum: ["semantic", "episodic", "procedural", "client", "task"],
          default: "semantic",
        },
        importance: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
      },
      required: ["content"],
    },
  },

  // ── DRAFTING (LLM only, no provider needed) ──────────────────────
  draft_response: {
    name: "draft_response",
    description: "Compose a polished customer-facing response.",
    parameters: {
      type: "object",
      properties: {
        ticket_summary: { type: "string" },
        tone: {
          type: "string",
          enum: ["empathetic", "direct", "neutral"],
          default: "empathetic",
        },
      },
      required: ["ticket_summary"],
    },
  },
  draft_outreach: {
    name: "draft_outreach",
    description: "Draft a recruitment outreach message.",
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
  analyze_contract: {
    name: "analyze_contract",
    description: "Analyze contract text against a checklist of risk clauses.",
    parameters: {
      type: "object",
      properties: {
        contract_text: { type: "string" },
        checklist: { type: "array", items: { type: "string" } },
      },
      required: ["contract_text"],
    },
  },

  // ── FINANCE ──────────────────────────────────────────────────────
  fetch_revenue: {
    name: "fetch_revenue",
    description: "Fetch recent revenue from Stripe (real if connected, else demo).",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      required: ["period"],
    },
  },
  calculate_margin: {
    name: "calculate_margin",
    description: "Estimate gross margin for a list of opportunities.",
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
    description: "Summarise the company's financial state for a period.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      required: ["period"],
    },
  },

  // ── OPS ──────────────────────────────────────────────────────────
  search_logs: {
    name: "search_logs",
    description: "Search application logs for a query string.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        since: { type: "string", default: "1h" },
      },
      required: ["query"],
    },
  },

  // ── WEB BROWSING (always available) ──────────────────────────────
  fetch_url: {
    name: "fetch_url",
    description:
      "Visit a public URL and read its content. Returns title, meta description, cleaned text and outbound links. Use whenever you need fresh information about a company, person, article or doc page.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch (http or https)." },
        max_chars: {
          type: "integer",
          minimum: 500,
          maximum: 16000,
          default: 8000,
        },
        include_links: { type: "boolean", default: true },
      },
      required: ["url"],
    },
  },
  web_search: {
    name: "web_search",
    description:
      "Search the public web (DuckDuckGo). Returns top results as {title, url, snippet}. Pair with fetch_url to read promising pages.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        n: { type: "integer", minimum: 1, maximum: 15, default: 8 },
      },
      required: ["query"],
    },
  },

  // ── MULTI-AGENT (always available) ───────────────────────────────
  agent_handoff: {
    name: "agent_handoff",
    description:
      "Pass the current objective to another agent in your organization. Use when another agent's expertise is better suited (e.g. SDR finds a lead → CFO qualifies the margin → SDR books → Legal prepares contract). Returns a queued task that the target agent will pick up.",
    parameters: {
      type: "object",
      properties: {
        to_agent_name: {
          type: "string",
          description:
            "The exact name of the agent to hand off to (e.g. 'Atlas', 'Codex'). Must exist in this org.",
        },
        action: {
          type: "string",
          description: "What you want the next agent to do. Be precise and actionable.",
        },
        context: {
          type: "object",
          description:
            "Structured data the next agent will need (leads, IDs, prior decisions, etc.).",
        },
      },
      required: ["to_agent_name", "action"],
    },
  },
};

export type ToolName = keyof typeof TOOL_SCHEMAS;
