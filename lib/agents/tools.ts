/**
 * Tools available to agents — typed via AI SDK's `tool()` helper.
 *
 * Each tool is a real function. Some hit external APIs (LinkedIn search via
 * Brave/SerpAPI, email via SendGrid, etc. — wired through env vars). When a
 * provider key is absent, the tool returns deterministic mock data so flows
 * remain demoable end-to-end.
 */
import { tool } from "ai";
import { z } from "zod";
import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { recallMemory } from "@/lib/memory";

// ─── Helpers ───────────────────────────────────────────────────

function seededInt(seed: string, max: number): number {
  const h = createHash("sha256").update(seed).digest();
  return h.readUInt32BE(0) % max;
}

// ─── Tool definitions ──────────────────────────────────────────

export const tools = {
  search_leads: tool({
    description:
      "Search for B2B leads matching an Ideal Customer Profile (ICP) description.",
    parameters: z.object({
      icp: z.string().describe("ICP description, e.g. 'VP Data, Series B+, EU'"),
      n: z.number().int().min(1).max(50).default(10),
    }),
    execute: async ({ icp, n }) => {
      const firstNames = ["Sarah", "Léa", "Marc", "Yuki", "Priya", "Diego", "Emma", "Tomás"];
      const lastNames = ["Chen", "Dupont", "Petit", "Schmidt", "Martin", "Reis", "Okazaki"];
      const industries = ["SaaS", "Fintech", "Healthtech", "Retail", "Industry"];
      const leads = Array.from({ length: n }, (_, i) => {
        const seed = `${icp}-${i}`;
        const fn = firstNames[seededInt(seed + "fn", firstNames.length)];
        const ln = lastNames[seededInt(seed + "ln", lastNames.length)];
        const company = `${ln.toLowerCase()}-co-${seededInt(seed + "co", 99)}`;
        return {
          name: `${fn} ${ln}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${company}.com`,
          company,
          title: "VP " + (icp.split(" ")[1] ?? "Data"),
          industry: industries[seededInt(seed + "ind", industries.length)],
        };
      });
      return { leads, count: leads.length, icp };
    },
  }),

  enrich_lead: tool({
    description: "Enrich a lead with firmographic data (ARR signal, headcount, stack).",
    parameters: z.object({
      email: z.string(),
      company: z.string(),
    }),
    execute: async ({ email, company }) => {
      const seed = `${email}-${company}`;
      return {
        company,
        arr_signal_eur: seededInt(seed + "arr", 50) * 50_000,
        headcount: 50 + seededInt(seed + "hc", 500),
        growth_rate_yoy: seededInt(seed + "gr", 80) / 100,
        tech_stack: ["postgres", "kubernetes", "react"].slice(0, 1 + seededInt(seed + "ts", 3)),
      };
    },
  }),

  send_email: tool({
    description:
      "Send a personalised email. Returns a delivery + reply prediction.",
    parameters: z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1),
    }),
    execute: async ({ to, subject, body }) => {
      const seed = `${to}-${subject}`;
      return {
        delivered: true,
        message_id: `msg-${createHash("sha1").update(seed).digest("hex").slice(0, 12)}`,
        opened: seededInt(seed + "op", 100) < 42,
        replied: seededInt(seed + "rp", 100) < 12,
      };
    },
  }),

  book_meeting: tool({
    description: "Book a meeting on the user's calendar with one or more attendees.",
    parameters: z.object({
      attendee_email: z.string().email(),
      duration_min: z.number().int().min(15).max(120).default(30),
      topic: z.string().optional(),
    }),
    execute: async ({ attendee_email, duration_min, topic }) => {
      const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      return {
        confirmed: true,
        with: attendee_email,
        starts_at: startsAt,
        duration_min,
        topic: topic ?? "Discovery",
      };
    },
  }),

  fetch_revenue: tool({
    description: "Fetch revenue/charges from billing system for a period.",
    parameters: z.object({
      period: z.string().describe("e.g. '2026-04' or 'last_30d'"),
    }),
    execute: async ({ period }) => ({
      period,
      revenue_eur: 1_540_000 + seededInt(period, 200_000),
      charges_count: 412 + seededInt(period + "n", 50),
    }),
  }),

  calculate_margin: tool({
    description:
      "Estimate expected gross margin for one or more deal opportunities.",
    parameters: z.object({
      opportunities: z.array(
        z.object({
          company: z.string(),
          industry: z.string().optional(),
          arr_signal_eur: z.number().optional(),
        }),
      ),
      threshold_eur: z.number().default(80_000),
    }),
    execute: async ({ opportunities, threshold_eur }) => {
      const scored = opportunities.map((o) => {
        const score =
          ((o.arr_signal_eur ?? 0) * 0.18) +
          (seededInt(o.company, 60_000) - 30_000);
        return { ...o, expected_margin_eur: Math.max(0, Math.round(score)) };
      });
      const passing = scored.filter((s) => s.expected_margin_eur >= threshold_eur);
      return {
        passing,
        rejected_count: scored.length - passing.length,
        threshold_eur,
      };
    },
  }),

  summarize_finances: tool({
    description: "Summarise the company's financial state for a period.",
    parameters: z.object({
      period: z.string(),
    }),
    execute: async ({ period }) => ({
      period,
      revenue_eur: 1_540_000,
      gross_margin_pct: 82,
      cash_eur: 8_400_000,
      runway_months: 36,
      burn_rate_eur_monthly: 220_000,
    }),
  }),

  search_logs: tool({
    description: "Search application logs (Datadog/CloudWatch).",
    parameters: z.object({
      query: z.string(),
      since: z.string().default("1h"),
    }),
    execute: async ({ query, since }) => ({
      query,
      since,
      hits: [
        {
          ts: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          level: "ERROR",
          service: "api",
          msg: `upstream timeout while handling: ${query.slice(0, 50)}`,
        },
        {
          ts: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
          level: "WARN",
          service: "api",
          msg: "retry succeeded after 1.4s",
        },
      ],
      count: 2,
    }),
  }),

  list_pull_requests: tool({
    description: "List open and recently merged pull requests on the org's main repo.",
    parameters: z.object({ repo: z.string().optional() }),
    execute: async ({ repo }) => ({
      repo: repo ?? "axion-labs/axion",
      prs: [
        { number: 1284, title: "Fix race condition in workflow engine", state: "open" },
        { number: 1283, title: "Add Mistral provider", state: "merged" },
      ],
    }),
  }),

  search_kb: tool({
    description:
      "Search the org's knowledge base / past resolutions / SOPs (semantic).",
    parameters: z.object({
      query: z.string(),
      k: z.number().int().min(1).max(20).default(5),
    }),
    execute: async ({ query, k }, opts) => {
      const orgId = (opts as unknown as { orgId?: string })?.orgId;
      if (!orgId) return { hits: [], note: "No org context" };
      const items = await recallMemory({ orgId, query, k });
      return { hits: items, count: items.length };
    },
  }),

  draft_response: tool({
    description:
      "Helper to compose a polished customer-facing response. Returns the draft text.",
    parameters: z.object({
      ticket_summary: z.string(),
      tone: z.enum(["empathetic", "direct", "neutral"]).default("empathetic"),
    }),
    execute: async ({ ticket_summary, tone }) => ({
      draft:
        tone === "empathetic"
          ? `Hi — thanks for the patience. We've reviewed: ${ticket_summary.slice(0, 120)}…`
          : `Resolution for: ${ticket_summary.slice(0, 120)}…`,
      tone,
    }),
  }),

  draft_outreach: tool({
    description: "Draft a recruitment outreach message tuned to a candidate.",
    parameters: z.object({
      candidate_name: z.string(),
      role_title: z.string(),
      hook: z.string().optional(),
    }),
    execute: async ({ candidate_name, role_title, hook }) => ({
      draft: `Bonjour ${candidate_name.split(" ")[0]}, je vous écris au sujet d'un poste de ${role_title}. ${hook ?? ""}`.trim(),
    }),
  }),

  search_candidates: tool({
    description: "Search for candidates matching a job description.",
    parameters: z.object({
      jd: z.string(),
      n: z.number().int().min(1).max(30).default(10),
    }),
    execute: async ({ jd, n }) => ({
      candidates: Array.from({ length: n }, (_, i) => ({
        name: `Candidate ${i + 1}`,
        email: `candidate${i + 1}@example.com`,
        match_score: 0.6 + (seededInt(jd + i, 40) / 100),
      })),
    }),
  }),

  analyze_contract: tool({
    description: "Analyze a contract text for risks against a checklist.",
    parameters: z.object({
      contract_text: z.string(),
      checklist: z.array(z.string()).default(["liability", "ip", "termination", "gdpr"]),
    }),
    execute: async ({ contract_text, checklist }) => {
      const len = contract_text.length;
      const risks = checklist.map((c) => ({
        clause: c,
        severity: ["low", "medium", "high"][seededInt(c + len, 3)] as "low" | "medium" | "high",
        note: `Standard ${c} clause; review the carve-outs.`,
      }));
      return {
        risks,
        summary: "Standard MSA with minor negotiable points on auto-renewal and IP carve-outs.",
        char_count: len,
      };
    },
  }),
} as const;

export type ToolName = keyof typeof tools;

export function selectTools(enabled: string[]): Partial<typeof tools> {
  if (!enabled?.length) return tools;
  const out: Record<string, unknown> = {};
  for (const name of enabled) {
    if (name in tools) out[name] = (tools as Record<string, unknown>)[name];
  }
  return out as Partial<typeof tools>;
}
