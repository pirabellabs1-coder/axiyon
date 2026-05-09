/**
 * Client-side agent runtime powered by Puter.js (free unlimited Claude/GPT).
 *
 * Runs entirely in the browser:
 *   1. Builds the OpenAI-style tool schemas from the agent's enabledTools.
 *   2. Calls puter.ai.chat() with system prompt + objective + tools.
 *   3. When the model emits tool_calls, dispatches each to /api/tools/[name]
 *      so tools execute server-side (auth + rate-limit + audit preserved).
 *   4. Loops until the model returns a final text answer (max 8 steps).
 *   5. POSTs the final result + tool-call trace to /api/agents/[id]/result
 *      so it gets persisted as a Task with cost = 0 (Puter is free).
 *
 * Why client-side? Puter's free tier authorizes against the end-user's
 * browser session — no API key to manage, no quota on the platform side.
 */
import { TOOL_SCHEMAS, type ToolName } from "@/lib/agents/tool-schemas";

export interface PuterRunOptions {
  agentId: string;
  templateSlug: string;
  systemPrompt: string;
  enabledTools: string[];
  /** Slugs of providers the org has connected (e.g. ["google", "slack"]). */
  connectedProviders?: string[];
  objective: string;
  inputs?: Record<string, unknown>;
  model?: string;
  /** Called for each emitted text chunk (streaming). */
  onText?: (chunk: string) => void;
  /** Called whenever the agent invokes a tool. */
  onToolCall?: (call: { name: string; args: unknown; result?: unknown; error?: string }) => void;
}

export interface PuterRunResult {
  text: string;
  toolCalls: Array<{ name: string; args: unknown; result?: unknown; error?: string }>;
  steps: number;
  modelUsed: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-5";
const MAX_STEPS = 8;

interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

// Anthropic / OpenAI return content sometimes as a string, sometimes as an
// array of blocks like [{type:"text", text:"..."}]. JSON.stringify on those
// blocks produces "[object Object]" which is what the user saw in chat.
function extractText(
  content:
    | string
    | Array<{ type?: string; text?: string; [k: string]: unknown }>
    | null
    | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

export async function runWithPuter(opts: PuterRunOptions): Promise<PuterRunResult> {
  // Wait for Puter to load (script may still be initializing on first paint).
  await waitForPuter();

  // Pull this agent's recent task history so it has working memory across
  // turns. We squash the last 6 turns (3 user + 3 assistant) into the system
  // prompt — enough for continuity, small enough to stay well under context.
  // Best-effort: silent fail if the endpoint is unavailable.
  let memorySnippet = "";
  try {
    const r = await fetch(
      `/api/v1/chat/history?agentId=${encodeURIComponent(opts.agentId)}&limit=6`,
      { cache: "no-store" },
    );
    if (r.ok) {
      const data = (await r.json()) as {
        turns: Array<{ role: "user" | "assistant"; content: string; createdAt: string }>;
      };
      const recent = (data.turns ?? []).slice(-6);
      if (recent.length) {
        const lines = recent.map((t) => {
          const text = t.content.replace(/\s+/g, " ").trim().slice(0, 200);
          return `[${t.role === "user" ? "USER" : "YOU"}] ${text}`;
        });
        memorySnippet =
          "\n\nRecent turns with this user (continuity context):\n" +
          lines.join("\n");
      }
    }
  } catch {
    /* silent — memory is best-effort */
  }

  // Always-on tools. Every agent gets these regardless of its template's
  // enabledTools list — they're the foundation of multi-agent autonomy and
  // real-world research, so an agent created before they existed should still
  // be able to use them.
  const enabledSet = new Set(
    opts.enabledTools.length ? opts.enabledTools : Object.keys(TOOL_SCHEMAS),
  );
  enabledSet.add("agent_handoff");
  enabledSet.add("fetch_url");
  enabledSet.add("web_search");
  const tools = Array.from(enabledSet)
    .map((name) => TOOL_SCHEMAS[name as ToolName])
    .filter(Boolean)
    .map((schema) => ({
      type: "function" as const,
      function: {
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
      },
    }));

  const userMsg = buildUserMessage(
    opts.objective,
    opts.inputs ?? {},
    opts.connectedProviders ?? [],
  );
  const messages: ChatMsg[] = [
    { role: "system", content: opts.systemPrompt + memorySnippet },
    { role: "user", content: userMsg },
  ];

  const collectedToolCalls: PuterRunResult["toolCalls"] = [];
  let finalText = "";
  let step = 0;
  // We allow ourselves at MOST one "you procrastinated, execute now" nudge
  // per run. Beyond that we accept the model's plain answer rather than
  // looping forever (which we did in 25d42f9 and broke replies entirely).
  let executionNudgesUsed = 0;
  const MAX_EXECUTION_NUDGES = 1;
  const model = opts.model ?? DEFAULT_MODEL;

  while (step < MAX_STEPS) {
    step += 1;

    const response = (await window.puter!.ai.chat(messages as never, {
      model,
      tools,
    })) as {
      message?: {
        role?: string;
        content?:
          | string
          | Array<{ type?: string; text?: string; [k: string]: unknown }>;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      };
      text?: string;
      toString(): string;
    };

    const message = response?.message;
    const toolCalls = message?.tool_calls ?? [];
    const assistantText = extractText(message?.content) || response?.text || "";

    // No tool calls → usually means the agent has its final answer.
    if (!toolCalls.length) {
      const trimmed = String(assistantText).trim();

      // SAFETY GUARD: only nudge once per run, and only when the answer is
      // clearly a "promise of future action" with NO substance. Generic
      // French replies starting with "Je ..." are NOT procrastination.
      const hasNoToolHistory = collectedToolCalls.length === 0;
      const isShort = trimmed.length < 320; // long answers are real answers
      const PROCRASTINATION_RE =
        /(?:^|\n)\s*(?:je vais (?:commencer par|d['e]abord|maintenant|imm[ée]diatement)\b|let me (?:start|begin|first|do that)\b|i'?ll (?:start|begin|first|do that|go ahead)\b|i'?m going to (?:start|begin)\b|d'abord, je vais\b|tout d'abord, je vais\b)/i;
      const looksLikePurePromise =
        isShort &&
        PROCRASTINATION_RE.test(trimmed) &&
        // and the answer doesn't already contain a result / recap
        !/✅|✓|terminé|done|complete|résumé|recap|finalisé/i.test(trimmed);

      if (
        hasNoToolHistory &&
        looksLikePurePromise &&
        executionNudgesUsed < MAX_EXECUTION_NUDGES &&
        step < MAX_STEPS - 1
      ) {
        executionNudgesUsed += 1;
        messages.push({ role: "assistant", content: trimmed });
        messages.push({
          role: "user",
          content:
            "Execute that intention now: call the tool you said you'd call, " +
            "with concrete arguments. If you genuinely need a clarification, " +
            "ask exactly one short question instead.",
        });
        continue;
      }

      finalText = trimmed;
      if (opts.onText && finalText) opts.onText(finalText);
      break;
    }

    // Push the assistant turn (with tool_calls) to keep conversation valid.
    messages.push({
      role: "assistant",
      content: String(assistantText),
      tool_calls: toolCalls,
    });

    // Execute each tool call against the server.
    for (const tc of toolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs =
          typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : (tc.function.arguments as Record<string, unknown>);
      } catch {
        parsedArgs = { _raw: tc.function.arguments };
      }

      let toolResult: unknown = null;
      let toolError: string | undefined;
      try {
        const r = await fetch(`/api/v1/tools/${encodeURIComponent(tc.function.name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            args: parsedArgs,
            // Forwarded so /api/v1/tools/[name] can attribute approval requests
            // and audit entries to the actual recruited agent (not a generic
            // "chat-runtime" placeholder).
            agentId: opts.agentId,
            templateSlug: opts.templateSlug,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        toolResult = await r.json();
      } catch (e) {
        toolError = e instanceof Error ? e.message : String(e);
      }

      const recorded = { name: tc.function.name, args: parsedArgs, result: toolResult, error: toolError };
      collectedToolCalls.push(recorded);
      if (opts.onToolCall) opts.onToolCall(recorded);

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(toolError ? { error: toolError } : toolResult),
      });
    }
  }

  if (step >= MAX_STEPS && !finalText) {
    finalText = `[Limite de ${MAX_STEPS} étapes atteinte sans réponse finale.]`;
  }

  // Persist the run as a Task so it shows up in /dashboard/tasks + audit.
  try {
    await fetch(`/api/v1/agents/${opts.agentId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: opts.objective,
        inputs: opts.inputs ?? {},
        text: finalText,
        toolCalls: collectedToolCalls,
        modelUsed: `puter:${model}`,
        steps: step,
      }),
    });
  } catch {
    // Persist failure shouldn't bubble — the user already sees the answer.
  }

  return {
    text: finalText,
    toolCalls: collectedToolCalls,
    steps: step,
    modelUsed: `puter:${model}`,
  };
}

function buildUserMessage(
  objective: string,
  inputs: Record<string, unknown>,
  connectedProviders: string[],
): string {
  const parts = [`Objective:\n${objective}`];
  if (Object.keys(inputs).length) {
    parts.push(`\nInputs:\n${JSON.stringify(inputs, null, 2)}`);
  }

  // Map provider slugs → which tools become "real" vs preview.
  const PROVIDER_CAPABILITIES: Record<string, string> = {
    google: "Gmail (`send_email`, `search_emails`) + Google Calendar (`book_meeting`, `list_calendar_events`)",
    microsoft: "Outlook (`send_email`, `search_emails`) + MS Calendar + Teams (`teams_post`)",
    sendgrid: "SendGrid (`send_email` fallback)",
    twilio: "Twilio voice + SMS (`make_phone_call`, `send_sms`, `list_phone_numbers`)",
    hubspot: "HubSpot CRM (`crm_create_contact`, `crm_search_contact`, `crm_create_deal`, `crm_create_note`)",
    salesforce: "Salesforce (`crm_create_contact`, `crm_search_contact`, `crm_create_deal`)",
    slack: "Slack (`slack_post`, `slack_list_channels`, `slack_dm`)",
    github: "GitHub (`github_create_issue`, `github_list_prs`, `github_dispatch_workflow`)",
    notion: "Notion (`notion_create_page`, `notion_search`)",
    stripe: "Stripe (`stripe_create_customer`, `stripe_create_invoice`, `stripe_list_charges`, `fetch_revenue`)",
    apollo: "Apollo.io (`search_leads`, `enrich_lead`, `search_candidates`)",
  };
  const liveProviderLines = connectedProviders
    .map((p) => PROVIDER_CAPABILITIES[p])
    .filter(Boolean)
    .map((line) => `• ${line}`);

  const integrationsBlock = liveProviderLines.length
    ? [
        "",
        "✅ Real integrations connected for this org — when you call these tools they make REAL API calls (not previews):",
        ...liveProviderLines,
      ]
    : [
        "",
        "ℹ️  No third-party integration connected yet. The tools still work in preview mode (returning structured demo data) but no real email / message / payment will be sent. If you need real delivery, tell the user to connect the relevant provider in /dashboard/integrations.",
      ];

  parts.push(
    [
      "",
      "═══════════════════════════════════════════════════════════════",
      "EXECUTION POLICY (read this before you generate any token):",
      "═══════════════════════════════════════════════════════════════",
      "1. **EXECUTE — DO NOT DESCRIBE.** If the user asks you to do something,",
      "   your VERY FIRST response must be a tool call, never a sentence",
      "   like “I will…”, “Je vais…”, “Let me…”. Don't announce — act.",
      "2. **PLAN INTERNALLY, EMIT TOOLS.** Think silently. The only thing the",
      "   user wants to see is: tools you called → their results → your final",
      "   summary. Skip the “Here's what I'm going to do” preamble.",
      "3. **CHAIN WITHOUT ASKING.** If a step needs another step, just do it.",
      "   Only ask the user a question when you genuinely cannot proceed",
      "   (missing required field that no tool can find for you).",
      "4. **REPORT ONLY AFTER WORKING.** Your final text is a *recap of what",
      "   you actually did*, not a plan for the future.",
      "",
      "Capabilities you ALWAYS have:",
      "• `fetch_url(url)` — read any public webpage (company sites, articles, docs, profiles).",
      "• `web_search(query)` — find candidate URLs, then `fetch_url` the promising ones.",
      "• `agent_handoff(to_agent_name, action, context)` — when another teammate is better suited (e.g. you found leads → hand off to the CFO agent for margin qualification, then to Legal for the contract).",
      "• `search_kb(query)` and `ingest_to_kb(content, kind)` — read/write the org's persistent memory.",
      ...integrationsBlock,
      "",
      "Decision tree before answering:",
      "1. Did the user give a concrete task (\"trie mes mails\", \"trouve 10 prospects\", \"analyse pirabellabs.com\")?",
      "   → IMMEDIATELY call the matching tool(s). Don't preface.",
      "2. Don't know a fact? → `web_search` then `fetch_url`. Don't guess, don't ask the user.",
      "3. Task spans expertises? → finish your part FIRST, then `agent_handoff`.",
      "4. NEVER claim a tool is unavailable. The full toolbox above is loaded for this run — call it.",
      "",
      "Output format (your final assistant message will be rendered as Markdown):",
      "• Real Markdown — **bold**, lists, headings (`##`), proper tables for structured data:",
      "  | Colonne | Colonne |",
      "  | --- | --- |",
      "  | valeur | valeur |",
      "• End with a one-line **recap** stating what you did and what's next, e.g.",
      "  \"✅ 12 prospects qualifiés ; 8 emails envoyés ; relais Codex pour le contrat Stripe.\"",
      "• No raw `****` decoration. Use `##` for section titles, not stars.",
      "",
      "Approval gate: actions > 5 000 € impact, contract signature, mass email (> 50 recipients), phone calls, real fund transfers → STOP and call the relevant tool that triggers `requestApproval` (the runtime will pause until a human decides).",
    ].join("\n"),
  );
  return parts.join("\n");
}

async function waitForPuter(timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (typeof window !== "undefined" && !window.puter?.ai) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Puter.js did not load in time. Reload the page.");
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

export function isPuterAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.puter?.ai);
}
