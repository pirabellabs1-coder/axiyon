/**
 * LLM router — picks an AI SDK provider based on configured keys.
 *
 * Order of preference: Anthropic Claude → OpenAI GPT → no-key stub.
 * The router is the single import point — agents never talk to providers directly.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type RoutingPolicy = "quality" | "balanced" | "cheap" | "latency";

const DEFAULTS: Record<RoutingPolicy, { anthropic?: string; openai?: string }> = {
  quality: { anthropic: "claude-opus-5", openai: "gpt-4o" },
  balanced: { anthropic: "claude-sonnet-5", openai: "gpt-4o-mini" },
  cheap: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini" },
  latency: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini" },
};

export function pickModel(policy: RoutingPolicy = "balanced"): LanguageModelV1 {
  const choice = DEFAULTS[policy];

  if (process.env.ANTHROPIC_API_KEY && choice.anthropic) {
    return anthropic(choice.anthropic);
  }
  if (process.env.OPENAI_API_KEY && choice.openai) {
    return openai(choice.openai);
  }
  throw new Error(
    "No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your env.",
  );
}

export function hasAnyProvider(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

// Approximate pricing in EUR per 1M tokens.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-5": { in: 4.6, out: 23 },
  "claude-sonnet-5": { in: 2.8, out: 13.8 },
  "claude-haiku-4-5": { in: 0.92, out: 4.6 },
  "gpt-4o": { in: 2.3, out: 9 },
  "gpt-4o-mini": { in: 0.13, out: 0.55 },
};

export function estimateCostEur(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model] ?? { in: 0, out: 0 };
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
