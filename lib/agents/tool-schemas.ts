/**
 * Tool schemas — partagés entre serveur (AI SDK) et client (Puter).
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  search_leads: {
    name: "search_leads",
    description: "Recherche des prospects B2B matchant un ICP.",
    parameters: {
      type: "object",
      properties: {
        icp: { type: "string" },
        n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["icp"],
    },
  },
  enrich_lead: {
    name: "enrich_lead",
    description: "Enrichit un prospect avec des données firmographiques.",
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
    description: "Envoie un email personnalisé.",
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
    description: "Réserve un créneau sur le calendrier.",
    parameters: {
      type: "object",
      properties: {
        attendee_email: { type: "string" },
        duration_min: { type: "integer", default: 30 },
        topic: { type: "string" },
      },
      required: ["attendee_email"],
    },
  },
  fetch_revenue: {
    name: "fetch_revenue",
    description: "Récupère le revenu pour une période.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      required: ["period"],
    },
  },
  calculate_margin: {
    name: "calculate_margin",
    description: "Estime la marge brute attendue pour des opportunités.",
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
    description: "Résume l'état financier de l'entreprise.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      required: ["period"],
    },
  },
  search_logs: {
    name: "search_logs",
    description: "Recherche dans les logs applicatifs.",
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
    description: "Liste les pull requests ouvertes/mergées.",
    parameters: {
      type: "object",
      properties: { repo: { type: "string" } },
    },
  },
  search_kb: {
    name: "search_kb",
    description: "Recherche dans la base de connaissances.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        k: { type: "integer", default: 5 },
      },
      required: ["query"],
    },
  },
  draft_response: {
    name: "draft_response",
    description: "Compose une réponse client polie.",
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
    description: "Rédige un message d'approche recruitment.",
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
    description: "Recherche de candidats matchant une JD.",
    parameters: {
      type: "object",
      properties: {
        jd: { type: "string" },
        n: { type: "integer", default: 10 },
      },
      required: ["jd"],
    },
  },
  analyze_contract: {
    name: "analyze_contract",
    description: "Analyse un contrat pour identifier les risques.",
    parameters: {
      type: "object",
      properties: {
        contract_text: { type: "string" },
        checklist: { type: "array", items: { type: "string" } },
      },
      required: ["contract_text"],
    },
  },
  agent_handoff: {
    name: "agent_handoff",
    description:
      "Pass the current objective to another agent in your organization. Use when " +
      "another agent's expertise is better suited (e.g. SDR finds a lead → CFO qualifies " +
      "the margin → SDR books → Legal prepares contract). Returns a queued task that the " +
      "target agent will pick up.",
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
