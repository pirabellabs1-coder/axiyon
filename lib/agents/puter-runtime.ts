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

  const userMsg = buildUserMessage(opts.objective, opts.inputs ?? {});
  const messages: ChatMsg[] = [
    { role: "system", content: opts.systemPrompt },
    { role: "user", content: userMsg },
  ];

  const collectedToolCalls: PuterRunResult["toolCalls"] = [];
  let finalText = "";
  let step = 0;
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

    // No tool calls → final answer.
    if (!toolCalls.length) {
      finalText = String(assistantText).trim();
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
    finalText = `[step limit reached after ${MAX_STEPS} iterations]`;
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

function buildUserMessage(objective: string, inputs: Record<string, unknown>): string {
  const parts = [`Objective:\n${objective}`];
  if (Object.keys(inputs).length) {
    parts.push(`\nInputs:\n${JSON.stringify(inputs, null, 2)}`);
  }
  parts.push(
    [
      "",
      "Capabilities you ALWAYS have:",
      "• `fetch_url(url)` — read any public webpage (company sites, articles, docs, profiles).",
      "• `web_search(query)` — find candidate URLs, then `fetch_url` the promising ones.",
      "• `agent_handoff(to_agent_name, action, context)` — when another teammate is better suited (e.g. you found leads → hand off to the CFO agent for margin qualification, then to Legal for the contract).",
      "",
      "How to research before answering:",
      "1. If you don't know something specific (a company, a person, recent news) → `web_search` then `fetch_url` the top hits. Don't guess.",
      "2. If the task spans expertises → finish your part, then `agent_handoff` to the right teammate with structured context.",
      "",
      "Output format (your final assistant message will be rendered as Markdown):",
      "• Use real Markdown — **bold**, lists, headings (`##`), and proper tables when listing structured data:",
      "  | Colonne | Colonne |",
      "  | --- | --- |",
      "  | valeur | valeur |",
      "• Tables render with clean dividers; never describe table contents in prose when a table fits.",
      "• Never include raw stars (`****`) as decoration. Don't put asterisks around section titles — use a `##` heading instead.",
      "• Be concise. End with a clear next-step or recommendation.",
      "",
      "If a step needs human approval (>5k EUR action, contract signature, mass email, phone call), STOP and request approval.",
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
