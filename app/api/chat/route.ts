/**
 * Streaming chat endpoint — multi-turn, with tools, with the user's active agent.
 *
 * Uses AI SDK's `streamText` so the UI can show tokens as they arrive.
 */
import { streamText, type CoreMessage } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { getTemplate } from "@/lib/agents/catalog";
import { selectTools } from "@/lib/agents/tools";
import { hasAnyProvider, pickModel } from "@/lib/llm/router";

export const maxDuration = 60;

const Body = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system", "tool"]),
      content: z.union([z.string(), z.array(z.any())]),
    }),
  ),
  agentId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasAnyProvider()) {
    return new Response(
      "No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your project.",
      { status: 503 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response("Invalid body", { status: 422 });
  }

  // Resolve agent (or use a default helper persona)
  let systemPrompt =
    "You are an Axion assistant — a helpful agent that can plan, call tools, and answer questions about the user's organization. Be concise.";
  let toolset: ReturnType<typeof selectTools> = selectTools([]);

  if (body.agentId) {
    const agent = await db.query.agentInstances.findFirst({
      where: eq(agentInstances.id, body.agentId),
    });
    if (!agent || agent.orgId !== session.user.activeOrgId) {
      return new Response("Agent not found", { status: 404 });
    }
    const template = getTemplate(agent.templateSlug);
    if (template) {
      systemPrompt = agent.customPrompt?.trim() || template.systemPrompt;
      const enabled =
        (agent.enabledTools as string[] | null)?.filter(Boolean) ?? template.defaultTools;
      toolset = selectTools(enabled);
    }
  }

  const result = streamText({
    model: pickModel("balanced"),
    system: systemPrompt,
    messages: body.messages as CoreMessage[],
    tools: toolset,
    maxSteps: 6,
  });

  return result.toDataStreamResponse();
}
