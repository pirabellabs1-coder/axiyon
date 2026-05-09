/**
 * Lightweight Markdown renderer for assistant chat output.
 *
 * Handles the subset agents actually emit — paragraphs, headings, bold,
 * italic, inline code, fenced code blocks, ordered/unordered lists, links,
 * blockquotes, GFM tables. No external deps so the edge bundle stays small.
 *
 * Tables render as real HTML tables with our design tokens (no visible
 * pipe characters, no gritty borders — just tasteful row dividers).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);
  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed text-ink", className)}>
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

// ── Block model ──────────────────────────────────────────────────────────
type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang: string | null; code: string }
  | { kind: "quote"; text: string }
  | { kind: "table"; header: string[]; align: Array<"left" | "center" | "right" | null>; rows: string[][] }
  | { kind: "hr" };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Skip blank lines.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block.
    const fence = line.match(/^\s*```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1] ?? null;
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence (or eof)
      out.push({ kind: "code", lang, code: buf.join("\n") });
      continue;
    }

    // Horizontal rule.
    if (/^\s*(\*\s*\*\s*\*+|-\s*-\s*-+|_\s*_\s*_+)\s*$/.test(line)) {
      out.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading.
    const h = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (h) {
      out.push({
        kind: "h",
        level: Math.min(4, h[1].length) as 1 | 2 | 3 | 4,
        text: h[2],
      });
      i++;
      continue;
    }

    // Blockquote.
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push({ kind: "quote", text: buf.join("\n") });
      continue;
    }

    // GFM Table — header row, then alignment row, then body rows.
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => {
        const t = c.trim();
        const left = t.startsWith(":");
        const right = t.endsWith(":");
        if (left && right) return "center" as const;
        if (right) return "right" as const;
        if (left) return "left" as const;
        return null;
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push({ kind: "table", header, align, rows });
      continue;
    }

    // Lists (- / * / + or 1.).
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (ulMatch || olMatch) {
      const isOl = !!olMatch;
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const um = cur.match(/^(\s*)[-*+]\s+(.+)/);
        const om = cur.match(/^(\s*)\d+\.\s+(.+)/);
        if (isOl ? om : um) {
          items.push(((isOl ? om : um) as RegExpMatchArray)[2]);
          i++;
          // Continuation lines (indented).
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !lines[i].match(/^(\s*)([-*+]|\d+\.)\s+/)) {
            items[items.length - 1] += " " + lines[i].trim();
            i++;
          }
        } else {
          break;
        }
      }
      out.push({ kind: isOl ? "ol" : "ul", items });
      continue;
    }

    // Default: paragraph (greedy until blank or block boundary).
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockBoundary(lines[i], lines[i + 1])) {
      buf.push(lines[i]);
      i++;
    }
    out.push({ kind: "p", text: buf.join("\n") });
  }

  return out;
}

function isBlockBoundary(line: string, next: string | undefined): boolean {
  if (/^#{1,4}\s+/.test(line)) return true;
  if (/^\s*```/.test(line)) return true;
  if (/^\s*[-*+]\s+/.test(line)) return true;
  if (/^\s*\d+\.\s+/.test(line)) return true;
  if (/^\s*>\s?/.test(line)) return true;
  if (line.includes("|") && next && /^\s*\|?\s*:?-{2,}/.test(next)) return true;
  return false;
}

function splitRow(line: string): string[] {
  // Trim leading/trailing pipes, then split. Escapes \| as literal pipe.
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let buf = "";
  for (let j = 0; j < trimmed.length; j++) {
    const c = trimmed[j];
    if (c === "\\" && trimmed[j + 1] === "|") {
      buf += "|";
      j++;
    } else if (c === "|") {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += c;
    }
  }
  out.push(buf.trim());
  return out;
}

// ── Inline rendering ─────────────────────────────────────────────────────
// Order matters: code spans first, then links, then bold, then italic.
function renderInline(text: string, key: string | number = "i"): React.ReactNode {
  const parts: Array<React.ReactNode> = [];
  let rest = text;
  let counter = 0;
  const push = (n: React.ReactNode) => {
    parts.push(<React.Fragment key={`${key}-${counter++}`}>{n}</React.Fragment>);
  };

  while (rest.length) {
    // Inline code.
    const code = rest.match(/`([^`]+)`/);
    // Link [text](url).
    const link = rest.match(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    // Bold **x** or __x__.
    const bold = rest.match(/\*\*([^*]+)\*\*|__([^_]+)__/);
    // Italic *x* or _x_ (avoid matching list bullets and bold).
    const italic = rest.match(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)\]]|$)|(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)\]]|$)/);

    const candidates = [
      code ? { type: "code", index: code.index!, m: code } : null,
      link ? { type: "link", index: link.index!, m: link } : null,
      bold ? { type: "bold", index: bold.index!, m: bold } : null,
      italic ? { type: "italic", index: italic.index!, m: italic } : null,
    ].filter(Boolean) as Array<{ type: string; index: number; m: RegExpMatchArray }>;

    if (!candidates.length) {
      push(rest);
      break;
    }
    candidates.sort((a, b) => a.index - b.index);
    const next = candidates[0];

    if (next.index > 0) push(rest.slice(0, next.index));

    const m = next.m;
    if (next.type === "code") {
      push(
        <code className="rounded bg-bg-3 border border-line px-1 py-0.5 font-mono text-[12.5px]">
          {m[1]}
        </code>,
      );
      rest = rest.slice(next.index + m[0].length);
    } else if (next.type === "link") {
      const txt = m[1];
      const href = m[2];
      push(
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-blue-2 hover:underline underline-offset-2"
        >
          {renderInline(txt, `${key}-l${counter}`)}
        </a>,
      );
      rest = rest.slice(next.index + m[0].length);
    } else if (next.type === "bold") {
      const inner = m[1] ?? m[2];
      push(<strong className="font-semibold text-ink">{renderInline(inner, `${key}-b${counter}`)}</strong>);
      rest = rest.slice(next.index + m[0].length);
    } else {
      // italic
      const lead = m[1] ?? m[3] ?? "";
      const inner = m[2] ?? m[4];
      if (lead) push(lead);
      push(<em className="italic">{renderInline(inner, `${key}-i${counter}`)}</em>);
      rest = rest.slice(next.index + m[0].length);
    }
  }

  return <>{parts}</>;
}

// ── Block rendering ──────────────────────────────────────────────────────
function renderBlock(b: Block, key: number): React.ReactNode {
  switch (b.kind) {
    case "p":
      return (
        <p key={key} className="whitespace-pre-wrap">
          {renderInline(b.text, key)}
        </p>
      );
    case "h": {
      const cls =
        b.level === 1
          ? "text-xl font-semibold tracking-tight mt-1"
          : b.level === 2
            ? "text-lg font-semibold tracking-tight mt-1"
            : b.level === 3
              ? "text-base font-semibold mt-1"
              : "text-sm font-semibold mt-1";
      const inline = renderInline(b.text, key);
      if (b.level === 1) return <h1 key={key} className={cls}>{inline}</h1>;
      if (b.level === 2) return <h2 key={key} className={cls}>{inline}</h2>;
      if (b.level === 3) return <h3 key={key} className={cls}>{inline}</h3>;
      return <h4 key={key} className={cls}>{inline}</h4>;
    }
    case "ul":
      return (
        <ul key={key} className="list-disc pl-5 space-y-1 marker:text-ink-3">
          {b.items.map((it, j) => (
            <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal pl-5 space-y-1 marker:text-ink-3">
          {b.items.map((it, j) => (
            <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre
          key={key}
          className="rounded-md border border-line bg-bg-3 p-3 overflow-x-auto text-[12.5px] font-mono leading-relaxed"
        >
          <code>{b.code}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-brand-blue/40 pl-3 text-ink-2 italic"
        >
          {renderInline(b.text, key)}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className="border-line my-1" />;
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {b.header.map((cell, j) => (
                  <th
                    key={j}
                    className={cn(
                      "py-2 px-2.5 text-[11px] uppercase tracking-wider font-mono text-ink-2 font-medium",
                      alignClass(b.align[j]),
                    )}
                  >
                    {renderInline(cell, `${key}-h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-line/60 last:border-0 hover:bg-bg-3/40 transition-colors"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn("py-2 px-2.5 align-top", alignClass(b.align[ci]))}
                    >
                      {renderInline(cell, `${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function alignClass(a: "left" | "center" | "right" | null): string {
  if (a === "right") return "text-right";
  if (a === "center") return "text-center";
  return "text-left";
}
