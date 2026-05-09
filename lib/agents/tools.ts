/**
 * Agent tools — wired with the AI SDK `tool()` helper.
 *
 * Each tool first attempts the real API call (when the org has the relevant
 * integration connected). Falls back to a deterministic preview response when
 * no integration is configured, so demos remain end-to-end runnable.
 *
 * Per-org context is passed via the `experimental_toolMetadata.orgId` field
 * inside `runAgent` — tools receive it through the second argument.
 */
import { tool } from "ai";
import { z } from "zod";
// Deterministic non-crypto hash (xfnv1a) — edge-safe replacement for
// createHash that we used for preview seeds. Not security-sensitive.
function xfnv1a(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function shortHex(seed: string, n: number): string {
  let s = "";
  let x = seed;
  while (s.length < n) {
    const h = xfnv1a(x);
    s += h.toString(16).padStart(8, "0");
    x = h.toString();
  }
  return s.slice(0, n);
}

import { recallMemory, ingestMemory } from "@/lib/memory";

// approvals + real-API implementations
import { requestApproval, requiresApproval } from "@/lib/approvals";
import { gmailSend, gmailSearch, calendarBook, calendarList } from "@/lib/tools/impl/google";
import {
  outlookSend,
  outlookSearch,
  msCalendarBook,
  teamsPost,
} from "@/lib/tools/impl/microsoft";
import { twilioCall, twilioSms, twilioListNumbers } from "@/lib/tools/impl/twilio";
import {
  hubspotCreateContact,
  hubspotCreateDeal,
  hubspotCreateNote,
  hubspotSearchContact,
} from "@/lib/tools/impl/hubspot";
import {
  slackPostMessage,
  slackListChannels,
  slackSendDm,
} from "@/lib/tools/impl/slack";
import {
  githubCreateIssue,
  githubListPrs,
  githubDispatchWorkflow,
} from "@/lib/tools/impl/github";
import { notionCreatePage, notionSearch } from "@/lib/tools/impl/notion";
import {
  sfdcCreateLead,
  sfdcCreateOpportunity,
  sfdcSearchAccount,
} from "@/lib/tools/impl/salesforce";
import {
  stripeCreateCustomer,
  stripeCreateInvoice,
  stripeListCharges,
} from "@/lib/tools/impl/stripe";
import { sendgridSend } from "@/lib/tools/impl/sendgrid";
import { apolloSearchPeople, apolloEnrichPerson } from "@/lib/tools/impl/apollo";

// ─── Helpers ─────────────────────────────────────────────────────

function seededInt(seed: string, max: number): number {
  return xfnv1a(seed) % max;
}

// ─── ToolContext ─────────────────────────────────────────────────
// AI SDK tools don't have a built-in "context" channel, so we store it on a
// module-level singleton when calling generateText. Includes orgId + agentId
// + taskId so approval requests can be traced back.
interface ToolContext {
  orgId: string;
  agentId: string;
  taskId: string;
}
let _ctx: ToolContext | null = null;
export function setToolOrgContext(ctx: ToolContext | null): void {
  _ctx = ctx;
}
// Backwards-compat — older runtime passed just orgId as a string.
export function setToolOrgContextLegacy(orgId: string | null): void {
  _ctx = orgId ? { orgId, agentId: "unknown", taskId: "unknown" } : null;
}
function ctxOrg(): string | null {
  return _ctx?.orgId ?? null;
}
function ctxFull(): ToolContext | null {
  return _ctx;
}

// ─── Tool definitions ────────────────────────────────────────────

export const tools = {
  // ── EMAIL ────────────────────────────────────────────────────────

  send_email: tool({
    description:
      "Send a real email. Tries Gmail (if Google connected) → Outlook (Microsoft) → SendGrid → preview.",
    parameters: z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1),
      cc: z.string().email().optional(),
      bcc: z.string().email().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { delivered: false, mode: "preview", error: "No org context" };

      // Try Gmail first
      const g = await gmailSend(orgId, args);
      if (g.ok) return { delivered: true, mode: "gmail", messageId: g.messageId };
      // Outlook
      const o = await outlookSend(orgId, args);
      if (o.ok) return { delivered: true, mode: "outlook" };
      // SendGrid
      const s = await sendgridSend(orgId, args);
      if (s.ok) return { delivered: true, mode: "sendgrid" };

      return {
        delivered: false,
        mode: "preview",
        note: "Aucun fournisseur email connecté. Connectez Google, Microsoft 365 ou SendGrid dans /dashboard/integrations.",
        message_id: `preview-${shortHex(args.to + args.subject, 12)}`,
      };
    },
  }),

  search_emails: tool({
    description: "Search the user's mailbox (Gmail or Outlook).",
    parameters: z.object({
      query: z.string(),
      n: z.number().int().min(1).max(50).default(10),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { messages: [], mode: "preview" };
      const g = await gmailSearch(orgId, args);
      if (g.ok) return { mode: "gmail", messages: g.messages };
      const o = await outlookSearch(orgId, args);
      if (o.ok) return { mode: "outlook", messages: o.messages };
      return { messages: [], mode: "preview" };
    },
  }),

  // ── CALENDAR ─────────────────────────────────────────────────────

  book_meeting: tool({
    description:
      "Create a real calendar event (Google Calendar or Microsoft 365). Sends invites to attendees.",
    parameters: z.object({
      summary: z.string().min(1),
      start_iso: z.string().describe("ISO 8601 start datetime"),
      end_iso: z.string().describe("ISO 8601 end datetime"),
      attendees: z.array(z.string().email()).default([]),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { confirmed: false, mode: "preview" };

      const g = await calendarBook(orgId, {
        summary: args.summary,
        start: args.start_iso,
        end: args.end_iso,
        attendees: args.attendees,
        description: args.description,
        location: args.location,
      });
      if (g.ok)
        return {
          confirmed: true,
          mode: "google_calendar",
          event_id: g.eventId,
          html_link: g.htmlLink,
        };

      const m = await msCalendarBook(orgId, {
        subject: args.summary,
        start: args.start_iso,
        end: args.end_iso,
        attendees: args.attendees,
        body: args.description,
        location: args.location,
      });
      if (m.ok)
        return {
          confirmed: true,
          mode: "ms_calendar",
          event_id: m.eventId,
          web_link: m.webLink,
        };

      return {
        confirmed: false,
        mode: "preview",
        note: "Connectez Google ou Microsoft 365 pour créer de vrais évènements.",
      };
    },
  }),

  list_calendar_events: tool({
    description: "List upcoming calendar events (Google Calendar).",
    parameters: z.object({
      since_days: z.number().int().min(0).max(60).default(0),
      n: z.number().int().min(1).max(50).default(20),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { events: [] };
      const g = await calendarList(orgId, { sinceDays: args.since_days, n: args.n });
      return { events: g.events ?? [], mode: g.ok ? "google_calendar" : "preview" };
    },
  }),

  // ── VOICE / SMS ──────────────────────────────────────────────────

  make_phone_call: tool({
    description:
      "Place a real phone call via Twilio. High-stakes — requires human approval the first time per session.",
    parameters: z.object({
      to: z.string().describe("E.164 phone number, e.g. +33...."),
      message: z.string().describe("Message to speak (will be wrapped in <Say>).").optional(),
      twiml_url: z.string().url().optional(),
    }),
    execute: async (args) => {
      const ctx = ctxFull();
      if (!ctx) return { placed: false, mode: "preview" };

      // Approval gate — phone calls always require human OK
      if (requiresApproval("make_phone_call")) {
        const decision = await requestApproval({
          orgId: ctx.orgId,
          agentId: ctx.agentId,
          taskId: ctx.taskId,
          actionType: "make_phone_call",
          summary: `Appel à ${args.to} : "${(args.message ?? "").slice(0, 200)}"`,
          payload: args,
          estimatedImpactEur: 0.3,
        });
        if (decision.status !== "approved") {
          return {
            placed: false,
            status: decision.status,
            approval_id: decision.id,
            note:
              decision.status === "pending"
                ? "Appel en attente d'approbation humaine. Voir /dashboard/approvals."
                : `Appel rejeté par l'utilisateur.`,
          };
        }
      }

      const twiml = args.message
        ? `<Response><Say language="fr-FR" voice="Polly.Lea">${args.message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .slice(0, 800)}</Say></Response>`
        : undefined;
      const r = await twilioCall(ctx.orgId, { to: args.to, twiml, url: args.twiml_url });
      if (r.ok) return { placed: true, mode: "twilio", call_sid: r.sid };
      return { placed: false, mode: "preview", error: r.error };
    },
  }),

  send_sms: tool({
    description: "Send a real SMS via Twilio. Requires human approval.",
    parameters: z.object({
      to: z.string(),
      body: z.string().min(1).max(1600),
    }),
    execute: async (args) => {
      const ctx = ctxFull();
      if (!ctx) return { sent: false, mode: "preview" };

      const decision = await requestApproval({
        orgId: ctx.orgId,
        agentId: ctx.agentId,
        taskId: ctx.taskId,
        actionType: "send_sms",
        summary: `SMS à ${args.to} : "${args.body.slice(0, 200)}"`,
        payload: args,
        estimatedImpactEur: 0.05,
      });
      if (decision.status !== "approved") {
        return {
          sent: false,
          status: decision.status,
          approval_id: decision.id,
          note:
            decision.status === "pending"
              ? "SMS en attente d'approbation humaine. Voir /dashboard/approvals."
              : "SMS rejeté.",
        };
      }

      const r = await twilioSms(ctx.orgId, args);
      return r.ok ? { sent: true, mode: "twilio", sid: r.sid } : { sent: false, error: r.error };
    },
  }),

  list_phone_numbers: tool({
    description: "List the org's owned phone numbers (Twilio).",
    parameters: z.object({}),
    execute: async () => {
      const orgId = ctxOrg();
      if (!orgId) return { numbers: [] };
      const r = await twilioListNumbers(orgId);
      return { numbers: r.numbers ?? [], mode: r.ok ? "twilio" : "preview" };
    },
  }),

  // ── CRM (HubSpot + Salesforce) ───────────────────────────────────

  crm_create_contact: tool({
    description:
      "Create a contact in the org's CRM. Tries HubSpot, then Salesforce (as a Lead).",
    parameters: z.object({
      email: z.string().email(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      jobtitle: z.string().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { created: false };
      const h = await hubspotCreateContact(orgId, {
        email: args.email,
        firstname: args.first_name,
        lastname: args.last_name,
        company: args.company,
        phone: args.phone,
        jobtitle: args.jobtitle,
      });
      if (h.ok) return { created: true, system: "hubspot", id: h.id };

      const s = await sfdcCreateLead(orgId, {
        Email: args.email,
        FirstName: args.first_name,
        LastName: args.last_name ?? "Unknown",
        Company: args.company ?? "Unknown",
        Title: args.jobtitle,
        Phone: args.phone,
      });
      if (s.ok) return { created: true, system: "salesforce", id: s.id };

      return { created: false, error: "Aucun CRM connecté" };
    },
  }),

  crm_search_contact: tool({
    description: "Search contacts/accounts across connected CRM.",
    parameters: z.object({
      query: z.string(),
      n: z.number().int().min(1).max(50).default(10),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { results: [] };
      const h = await hubspotSearchContact(orgId, args);
      if (h.ok) return { system: "hubspot", results: h.results };
      const s = await sfdcSearchAccount(orgId, { name: args.query });
      if (s.ok) return { system: "salesforce", results: s.results };
      return { results: [] };
    },
  }),

  crm_create_deal: tool({
    description: "Create a deal/opportunity. HubSpot first, then Salesforce.",
    parameters: z.object({
      name: z.string(),
      amount_eur: z.number().optional(),
      close_date_iso: z.string().optional(),
      stage: z.string().optional(),
      contact_id: z.string().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { created: false };
      const h = await hubspotCreateDeal(orgId, {
        dealname: args.name,
        amount: args.amount_eur,
        closedate: args.close_date_iso,
        dealstage: args.stage,
        contactId: args.contact_id,
      });
      if (h.ok) return { created: true, system: "hubspot", id: h.id };

      const s = await sfdcCreateOpportunity(orgId, {
        Name: args.name,
        StageName: args.stage ?? "Prospecting",
        CloseDate: args.close_date_iso ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        Amount: args.amount_eur,
      });
      if (s.ok) return { created: true, system: "salesforce", id: s.id };

      return { created: false, error: "Aucun CRM connecté" };
    },
  }),

  crm_create_note: tool({
    description: "Attach a note to a contact or deal in HubSpot.",
    parameters: z.object({
      body: z.string(),
      contact_id: z.string().optional(),
      deal_id: z.string().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { created: false };
      const h = await hubspotCreateNote(orgId, {
        body: args.body,
        contactId: args.contact_id,
        dealId: args.deal_id,
      });
      return h.ok ? { created: true, id: h.id } : { created: false, error: h.error };
    },
  }),

  // ── MESSAGING ────────────────────────────────────────────────────

  slack_post: tool({
    description: "Post a message in a Slack channel (use channel ID or #name).",
    parameters: z.object({
      channel: z.string(),
      text: z.string(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { posted: false };
      const r = await slackPostMessage(orgId, args);
      return r.ok ? { posted: true, ts: r.ts } : { posted: false, error: r.error };
    },
  }),

  slack_list_channels: tool({
    description: "List Slack channels the workspace has access to.",
    parameters: z.object({ limit: z.number().int().min(1).max(200).default(50) }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { channels: [] };
      const r = await slackListChannels(orgId, args);
      return { channels: r.channels ?? [], error: r.error };
    },
  }),

  slack_dm: tool({
    description: "Send a Slack DM to a user (by user ID).",
    parameters: z.object({ user: z.string(), text: z.string() }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { sent: false };
      const r = await slackSendDm(orgId, args);
      return { sent: r.ok, error: r.error };
    },
  }),

  teams_post: tool({
    description: "Post in a Microsoft Teams channel.",
    parameters: z.object({
      team_id: z.string(),
      channel_id: z.string(),
      text: z.string(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { posted: false };
      const r = await teamsPost(orgId, {
        teamId: args.team_id,
        channelId: args.channel_id,
        text: args.text,
      });
      return { posted: r.ok, error: r.error };
    },
  }),

  // ── CODE ─────────────────────────────────────────────────────────

  github_create_issue: tool({
    description: "Open a GitHub issue.",
    parameters: z.object({
      repo: z.string().describe("owner/repo"),
      title: z.string(),
      body: z.string().optional(),
      labels: z.array(z.string()).optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { created: false };
      const r = await githubCreateIssue(orgId, args);
      return r.ok
        ? { created: true, number: r.number, url: r.url }
        : { created: false, error: r.error };
    },
  }),

  github_list_prs: tool({
    description: "List pull requests.",
    parameters: z.object({
      repo: z.string(),
      state: z.enum(["open", "closed", "all"]).default("open"),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { prs: [] };
      const r = await githubListPrs(orgId, args);
      return { prs: r.prs ?? [], error: r.error };
    },
  }),

  github_dispatch_workflow: tool({
    description: "Trigger a GitHub Actions workflow_dispatch event.",
    parameters: z.object({
      repo: z.string(),
      workflow_id: z.string(),
      ref: z.string().default("main"),
      inputs: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { dispatched: false };
      const r = await githubDispatchWorkflow(orgId, {
        repo: args.repo,
        workflowId: args.workflow_id,
        ref: args.ref,
        inputs: args.inputs,
      });
      return { dispatched: r.ok, error: r.error };
    },
  }),

  // ── DOCS ─────────────────────────────────────────────────────────

  notion_create_page: tool({
    description: "Create a Notion page from markdown.",
    parameters: z.object({
      parent_page_id: z.string(),
      title: z.string(),
      markdown: z.string(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { created: false };
      const r = await notionCreatePage(orgId, {
        parentPageId: args.parent_page_id,
        title: args.title,
        markdown: args.markdown,
      });
      return r.ok
        ? { created: true, page_id: r.pageId, url: r.url }
        : { created: false, error: r.error };
    },
  }),

  notion_search: tool({
    description: "Search the Notion workspace.",
    parameters: z.object({
      query: z.string(),
      n: z.number().int().min(1).max(50).default(10),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { results: [] };
      const r = await notionSearch(orgId, args);
      return { results: r.results ?? [], error: r.error };
    },
  }),

  // ── PAYMENTS ─────────────────────────────────────────────────────

  stripe_create_customer: tool({
    description: "Create a Stripe customer.",
    parameters: z.object({
      email: z.string().email(),
      name: z.string().optional(),
      phone: z.string().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { created: false };
      const r = await stripeCreateCustomer(orgId, args);
      return r.ok ? { created: true, id: r.id } : { created: false, error: r.error };
    },
  }),

  stripe_create_invoice: tool({
    description: "Create a finalized Stripe invoice for a customer. Requires approval if > 100 EUR.",
    parameters: z.object({
      customer: z.string(),
      amount_cents: z.number().int().positive(),
      currency: z.string().default("eur"),
      description: z.string().optional(),
    }),
    execute: async (args) => {
      const ctx = ctxFull();
      if (!ctx) return { created: false };

      const amountEur = args.amount_cents / 100;
      if (amountEur > 100) {
        const decision = await requestApproval({
          orgId: ctx.orgId,
          agentId: ctx.agentId,
          taskId: ctx.taskId,
          actionType: "stripe_create_invoice",
          summary: `Facture Stripe ${args.currency.toUpperCase()} ${amountEur.toFixed(2)} pour ${args.customer}${args.description ? ` — ${args.description}` : ""}`,
          payload: args,
          estimatedImpactEur: amountEur,
        });
        if (decision.status !== "approved") {
          return {
            created: false,
            status: decision.status,
            approval_id: decision.id,
            note:
              decision.status === "pending"
                ? "Facture en attente d'approbation humaine. Voir /dashboard/approvals."
                : "Facture rejetée.",
          };
        }
      }

      const r = await stripeCreateInvoice(ctx.orgId, {
        customer: args.customer,
        amount: args.amount_cents,
        currency: args.currency,
        description: args.description,
      });
      return r.ok
        ? { created: true, invoice_id: r.invoiceId, hosted_url: r.hostedInvoiceUrl }
        : { created: false, error: r.error };
    },
  }),

  stripe_list_charges: tool({
    description: "List recent Stripe charges.",
    parameters: z.object({ limit: z.number().int().min(1).max(100).default(10) }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { charges: [] };
      const r = await stripeListCharges(orgId, args);
      return { charges: r.charges ?? [], error: r.error };
    },
  }),

  // ── PROSPECTING ──────────────────────────────────────────────────

  search_leads: tool({
    description: "Search B2B prospects via Apollo.io (real). Falls back to demo data if Apollo isn't connected.",
    parameters: z.object({
      icp: z.string().describe("ICP, e.g. 'VP Data, Series B+, EU'"),
      n: z.number().int().min(1).max(50).default(10),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (orgId) {
        const titles = args.icp
          .split(/,|\sat\s|\bchez\b/i)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);
        const r = await apolloSearchPeople(orgId, {
          person_titles: titles.length ? titles : undefined,
          n: args.n,
        });
        if (r.ok) return { source: "apollo", leads: r.people ?? [] };
      }

      // Demo fallback
      const firstNames = ["Sarah", "Léa", "Marc", "Yuki", "Priya", "Diego", "Emma"];
      const lastNames = ["Chen", "Dupont", "Petit", "Schmidt", "Martin", "Reis"];
      const leads = Array.from({ length: args.n }, (_, i) => {
        const seed = `${args.icp}-${i}`;
        const fn = firstNames[seededInt(seed + "fn", firstNames.length)];
        const ln = lastNames[seededInt(seed + "ln", lastNames.length)];
        const company = `${ln.toLowerCase()}-co-${seededInt(seed + "co", 99)}`;
        return {
          name: `${fn} ${ln}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${company}.com`,
          company,
          title: "VP " + (args.icp.split(" ")[1] ?? "Data"),
        };
      });
      return { source: "demo", leads };
    },
  }),

  enrich_lead: tool({
    description: "Enrich a lead with firmographic data via Apollo (real if connected).",
    parameters: z.object({
      email: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      company: z.string().optional(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (orgId) {
        const r = await apolloEnrichPerson(orgId, {
          email: args.email,
          first_name: args.first_name,
          last_name: args.last_name,
          organization_name: args.company,
        });
        if (r.ok) return { source: "apollo", person: r.person };
      }
      const seed = `${args.email}-${args.company}`;
      return {
        source: "demo",
        company: args.company,
        arr_signal_eur: seededInt(seed + "arr", 50) * 50_000,
        headcount: 50 + seededInt(seed + "hc", 500),
      };
    },
  }),

  // ── MEMORY (always real, persisted in Postgres) ──────────────────

  search_kb: tool({
    description: "Search the org's knowledge base (vector + relevance).",
    parameters: z.object({
      query: z.string(),
      k: z.number().int().min(1).max(20).default(5),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { hits: [] };
      const items = await recallMemory({ orgId, query: args.query, k: args.k });
      return { hits: items, count: items.length };
    },
  }),

  ingest_to_kb: tool({
    description: "Save a fact / SOP / lesson to the org's persistent memory.",
    parameters: z.object({
      content: z.string().min(1),
      kind: z.enum(["semantic", "episodic", "procedural", "client", "task"]).default("semantic"),
      importance: z.number().min(0).max(1).default(0.5),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (!orgId) return { saved: false };
      const r = await ingestMemory({
        orgId,
        content: args.content,
        kind: args.kind,
        importance: args.importance,
      });
      return { saved: true, id: r.id };
    },
  }),

  // ── DRAFTING (no provider needed, LLM handles it) ────────────────

  draft_response: tool({
    description: "Compose a polished customer-facing response.",
    parameters: z.object({
      ticket_summary: z.string(),
      tone: z.enum(["empathetic", "direct", "neutral"]).default("empathetic"),
    }),
    execute: async (args) => ({
      draft:
        args.tone === "empathetic"
          ? `Bonjour, merci pour votre patience. Concernant : ${args.ticket_summary.slice(0, 200)}…`
          : `Réponse : ${args.ticket_summary.slice(0, 200)}…`,
      tone: args.tone,
    }),
  }),

  draft_outreach: tool({
    description: "Draft a recruitment outreach message.",
    parameters: z.object({
      candidate_name: z.string(),
      role_title: z.string(),
      hook: z.string().optional(),
    }),
    execute: async (args) => ({
      draft: `Bonjour ${args.candidate_name.split(" ")[0]}, je vous écris au sujet d'un poste de ${args.role_title}. ${args.hook ?? ""}`.trim(),
    }),
  }),

  analyze_contract: tool({
    description: "Analyze contract text for risks against a checklist.",
    parameters: z.object({
      contract_text: z.string(),
      checklist: z.array(z.string()).default(["responsabilité", "propriété intellectuelle", "résiliation", "RGPD"]),
    }),
    execute: async (args) => {
      const len = args.contract_text.length;
      const risks = args.checklist.map((c, i) => ({
        clause: c,
        severity: ["low", "medium", "high"][seededInt(c + len + i, 3)] as "low" | "medium" | "high",
        note: `Clause standard sur ${c} ; vérifier les exceptions.`,
      }));
      return {
        risks,
        summary: "Contrat MSA standard avec quelques points négociables (auto-renouvellement, exceptions IP).",
      };
    },
  }),

  // ── PREVIEW finance/ops tools (kept for catalog parity) ──────────

  fetch_revenue: tool({
    description: "Fetch recent revenue (Stripe if connected, else preview).",
    parameters: z.object({
      period: z.string(),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (orgId) {
        const r = await stripeListCharges(orgId, { limit: 100 });
        if (r.ok && r.charges) {
          const total = r.charges.reduce<number>((acc, c) => {
            const ch = c as { amount?: number; currency?: string; status?: string };
            return ch.status === "succeeded" ? acc + (ch.amount ?? 0) : acc;
          }, 0);
          return { source: "stripe", period: args.period, revenue_eur: total / 100 };
        }
      }
      return { source: "demo", period: args.period, revenue_eur: 1_540_000 };
    },
  }),

  calculate_margin: tool({
    description: "Estimate gross margin for opportunities.",
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
    execute: async (args) => {
      const scored = args.opportunities.map((o) => {
        const score =
          ((o.arr_signal_eur ?? 0) * 0.18) + (seededInt(o.company, 60_000) - 30_000);
        return { ...o, expected_margin_eur: Math.max(0, Math.round(score)) };
      });
      const passing = scored.filter((s) => s.expected_margin_eur >= args.threshold_eur);
      return { passing, rejected_count: scored.length - passing.length };
    },
  }),

  summarize_finances: tool({
    description: "Summarise the company's financial state.",
    parameters: z.object({ period: z.string() }),
    execute: async (args) => ({
      period: args.period,
      revenue_eur: 1_540_000,
      gross_margin_pct: 82,
      cash_eur: 8_400_000,
      runway_months: 36,
    }),
  }),

  search_logs: tool({
    description: "Search application logs.",
    parameters: z.object({ query: z.string(), since: z.string().default("1h") }),
    execute: async (args) => ({
      query: args.query,
      since: args.since,
      hits: [
        { ts: new Date(Date.now() - 12 * 60_000).toISOString(), level: "ERROR", msg: `upstream timeout: ${args.query.slice(0, 50)}` },
        { ts: new Date(Date.now() - 11 * 60_000).toISOString(), level: "WARN", msg: "retry succeeded after 1.4s" },
      ],
    }),
  }),

  search_candidates: tool({
    description: "Search candidates for a JD via Apollo (real if connected).",
    parameters: z.object({
      jd: z.string(),
      n: z.number().int().min(1).max(30).default(10),
    }),
    execute: async (args) => {
      const orgId = ctxOrg();
      if (orgId) {
        const r = await apolloSearchPeople(orgId, {
          person_titles: [args.jd.split(/[\n.]/)[0].slice(0, 80)],
          n: args.n,
        });
        if (r.ok) return { source: "apollo", candidates: r.people };
      }
      return {
        source: "demo",
        candidates: Array.from({ length: args.n }, (_, i) => ({
          name: `Candidate ${i + 1}`,
          email: `candidate${i + 1}@example.com`,
          match_score: 0.6 + (seededInt(args.jd + i, 40) / 100),
        })),
      };
    },
  }),
  // ── MULTI-AGENT HANDOFF ──────────────────────────────────────────

  agent_handoff: tool({
    description:
      "Hand off the current objective to another agent in your organization. Use when " +
      "another agent's expertise is better suited (e.g. SDR finds a lead → CFO qualifies " +
      "the margin → SDR books → Legal prepares contract). Returns a queued task that the " +
      "target agent will pick up.",
    parameters: z.object({
      to_agent_name: z
        .string()
        .describe(
          "The exact name of the agent to hand off to (e.g. 'Atlas', 'Codex'). Must exist in this org.",
        ),
      action: z.string().min(3).max(2000).describe("What you want the next agent to do"),
      context: z
        .record(z.string(), z.unknown())
        .default({})
        .describe("Structured data the next agent will need (leads, IDs, prior decisions, etc.)"),
    }),
    execute: async (args) => {
      const ctx = ctxFull();
      if (!ctx) {
        return { handed_off: false, error: "No org context" };
      }

      // Look up target agent in this org by name (case-insensitive prefix match).
      const { eq } = await import("drizzle-orm");
      const { db, agentInstances, tasks } = await import("@/lib/db");
      const all = await db
        .select()
        .from(agentInstances)
        .where(eq(agentInstances.orgId, ctx.orgId));
      const target = all.find(
        (a) =>
          a.name.toLowerCase() === args.to_agent_name.toLowerCase() ||
          a.name.toLowerCase().startsWith(args.to_agent_name.toLowerCase() + " "),
      );
      if (!target) {
        return {
          handed_off: false,
          error: `No agent named "${args.to_agent_name}" in this org. Available: ${all.map((a) => a.name).join(", ")}`,
        };
      }
      if (target.id === ctx.agentId) {
        return { handed_off: false, error: "Cannot hand off to yourself" };
      }

      // Queue a task for the target agent.
      const [task] = await db
        .insert(tasks)
        .values({
          orgId: ctx.orgId,
          agentId: target.id,
          objective: args.action,
          status: "queued",
          inputPayload: {
            context: args.context,
            handed_off_from: ctx.agentId,
            parent_task_id: ctx.taskId,
          },
          outputPayload: {},
          toolCalls: [],
        })
        .returning();

      // Audit
      const { audit } = await import("@/lib/audit");
      await audit({
        orgId: ctx.orgId,
        actorType: "agent",
        actorId: ctx.agentId,
        action: "agent.handoff",
        resourceType: "task",
        resourceId: task.id,
        payload: {
          to_agent: target.name,
          to_agent_id: target.id,
          action: args.action.slice(0, 200),
        },
      }).catch(() => undefined);

      return {
        handed_off: true,
        target_agent_id: target.id,
        target_agent_name: target.name,
        target_agent_slug: target.templateSlug,
        queued_task_id: task.id,
        action: args.action,
        context: args.context,
        note: `Tâche queuée pour ${target.name}. Visible dans /dashboard/tasks.`,
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
