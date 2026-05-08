/**
 * Memory store — vector ingestion + recall.
 *
 * Embeddings via OpenAI when available, deterministic SHA-based fallback
 * otherwise (so dev environments without API keys still work).
 */
import { eq, and, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { embed as aiEmbed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

import { db, memoryEntries, type MemoryEntry } from "@/lib/db";

const EMBED_DIM = 1536;

function hashEmbed(text: string): number[] {
  const out: number[] = [];
  let buf = createHash("sha256").update(text).digest();
  while (out.length < EMBED_DIM) {
    for (let i = 0; i + 4 <= buf.length && out.length < EMBED_DIM; i += 4) {
      out.push(buf.readUInt32BE(i) / 2 ** 32 * 2 - 1);
    }
    buf = createHash("sha256").update(buf).digest();
  }
  return out;
}

export async function embed(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) return hashEmbed(text);
  try {
    const { embedding } = await aiEmbed({
      model: openai.embedding("text-embedding-3-small"),
      value: text.slice(0, 8000),
    });
    return embedding;
  } catch {
    return hashEmbed(text);
  }
}

function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface IngestArgs {
  orgId: string;
  content: string;
  kind?: "semantic" | "episodic" | "procedural" | "client" | "task";
  importance?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  agentId?: string;
}

export async function ingestMemory(args: IngestArgs): Promise<{ id: string }> {
  const v = await embed(args.content);
  const [row] = await db
    .insert(memoryEntries)
    .values({
      orgId: args.orgId,
      agentId: args.agentId ?? null,
      kind: args.kind ?? "semantic",
      content: args.content,
      summary: args.content.slice(0, 200),
      embedding: JSON.stringify(v),
      importance: args.importance ?? 0.5,
      source: args.source,
      metadata: args.metadata ?? {},
    })
    .returning({ id: memoryEntries.id });
  return row;
}

interface RecallArgs {
  orgId: string;
  query: string;
  k?: number;
  kind?: "semantic" | "episodic" | "procedural" | "client" | "task";
  minImportance?: number;
}

export async function recallMemory(args: RecallArgs) {
  const queryVec = await embed(args.query);

  const filters = [eq(memoryEntries.orgId, args.orgId)];
  if (args.kind) filters.push(eq(memoryEntries.kind, args.kind));

  // Pull recent candidates and re-rank in-memory. Fine for <10k items per org.
  const candidates = await db
    .select()
    .from(memoryEntries)
    .where(and(...filters))
    .orderBy(sql`${memoryEntries.createdAt} DESC`)
    .limit(500);

  const scored = candidates
    .filter((r) => (r.importance ?? 0) >= (args.minImportance ?? 0))
    .map((r) => {
      const v = r.embedding ? (JSON.parse(r.embedding) as number[]) : [];
      const score = cosine(queryVec, v) * (0.5 + (r.importance ?? 0));
      return { row: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, args.k ?? 8);

  return scored.map(({ row, score }) => ({
    id: row.id,
    kind: row.kind,
    content: row.content,
    summary: row.summary,
    importance: row.importance,
    score: Number(score.toFixed(4)),
    metadata: row.metadata,
    created_at: row.createdAt,
  }));
}

export type RecallResult = Awaited<ReturnType<typeof recallMemory>>;
