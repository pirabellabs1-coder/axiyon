/**
 * Regenerates the agent list embedded in public/agents.html from the real
 * catalogue.
 *
 * The marketing site is static HTML by design, so /agents shipped its own
 * hardcoded `const agents=[…]` array — a second catalogue that drifted from
 * lib/agents/catalog.ts every time either changed. After the catalogue rewrite
 * it was still advertising agents (Iris, Vega, Orion…) that no longer existed
 * anywhere in the product.
 *
 * Rather than edit the duplicate — which only resets the drift clock — this
 * script derives it. It runs from `prebuild`, so the page cannot ship stale.
 *
 *   npx tsx scripts/sync-marketing-agents.ts          # rewrite
 *   npx tsx scripts/sync-marketing-agents.ts --check  # fail if out of date
 *
 * Only the array is touched; the page's markup, styles and filter logic are
 * left exactly as they are.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { TEMPLATES, categoryLabel, type AgentTemplate } from "../lib/agents/catalog";

const TARGET = resolve(process.cwd(), "public/agents.html");
const OPEN = "const agents=[";
const CLOSE = "];";

/** Filter bar, regenerated alongside the array. */
const TAGS_OPEN = '<div class="filter-tags">';
const TAGS_CLOSE = "</div>";

/**
 * The static page predates the switch to Lucide icons and renders an emoji.
 * Mapping from the catalogue's icon name keeps the two representations in step
 * without forcing the marketing page to load an icon library.
 */
const ICON_EMOJI: Record<string, string> = {
  Mail: "📧",
  Headphones: "🎧",
  CalendarClock: "📅",
  PhoneCall: "☎️",
  UserSearch: "🔍",
  Send: "✉️",
  Briefcase: "💼",
  PenTool: "✍️",
  MessagesSquare: "💬",
  Hash: "#️⃣",
  Eye: "👁️",
  Search: "🔎",
  ChartColumn: "📊",
  Receipt: "🧾",
  Scale: "⚖️",
  BookOpen: "📖",
};

/** Escapes a value for a double-quoted JS string literal inside an HTML file. */
function js(value: string): string {
  return JSON.stringify(value);
}

function renderEntry(t: AgentTemplate): string {
  const emoji = ICON_EMOJI[t.icon];
  if (!emoji) {
    // Loud rather than silently shipping a blank tile.
    throw new Error(
      `No emoji mapped for icon "${t.icon}" (agent "${t.slug}"). ` +
        `Add it to ICON_EMOJI in scripts/sync-marketing-agents.ts.`,
    );
  }
  return (
    `  {id:${js(emoji)},name:${js(t.name)},role:${js(t.role)},cat:${js(t.category)},` +
    `desc:${js(t.description)},skills:${JSON.stringify(t.skills)},` +
    `price:${js(`${t.priceEurMonthly}€/mo`)}},`
  );
}

function buildBlock(): string {
  const byCategory = new Map<string, AgentTemplate[]>();
  for (const t of TEMPLATES) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  const lines: string[] = [
    OPEN,
    "  // Généré depuis lib/agents/catalog.ts — ne pas éditer à la main.",
    "  // Régénérer : npx tsx scripts/sync-marketing-agents.ts",
  ];
  for (const [category, list] of byCategory) {
    lines.push(`  // ${category}`);
    for (const t of list) lines.push(renderEntry(t));
  }
  lines.push(CLOSE);
  return lines.join("\n");
}

/**
 * Only categories that actually have an agent get a filter button. A tag for an
 * empty category renders a grid with no results and reads as a broken page —
 * which is exactly what happened to "RH" and "Ingénierie" when the catalogue
 * shrank and only the array was regenerated.
 */
function buildTags(): string {
  const used = Array.from(new Set(TEMPLATES.map((t) => t.category)));
  const buttons = [
    '      <button class="filter-tag active" data-cat="all">Tous</button>',
    ...used.map(
      (c) => `      <button class="filter-tag" data-cat="${c}">${categoryLabel(c)}</button>`,
    ),
  ];
  return [TAGS_OPEN, ...buttons, "    " + TAGS_CLOSE].join("\n");
}

/** Replaces the text between `open` and the first `close` that follows it. */
function replaceRegion(
  html: string,
  open: string,
  close: string,
  next: string,
): { html: string; changed: boolean } {
  const start = html.indexOf(open);
  if (start === -1) throw new Error(`Could not find "${open}" in ${TARGET}`);
  const end = html.indexOf(close, start);
  if (end === -1) throw new Error(`Could not find "${close}" after "${open}"`);

  const current = html.slice(start, end + close.length);
  if (current === next) return { html, changed: false };
  return { html: html.slice(0, start) + next + html.slice(end + close.length), changed: true };
}

function main() {
  const check = process.argv.includes("--check");
  const original = readFileSync(TARGET, "utf8");

  const arrayPass = replaceRegion(original, OPEN, CLOSE, buildBlock());
  const tagsPass = replaceRegion(arrayPass.html, TAGS_OPEN, TAGS_CLOSE, buildTags());
  const changed = arrayPass.changed || tagsPass.changed;

  if (!changed) {
    console.log(`public/agents.html is up to date (${TEMPLATES.length} agents).`);
    return;
  }

  if (check) {
    console.error(
      "public/agents.html is out of date with lib/agents/catalog.ts.\n" +
        "Run: npx tsx scripts/sync-marketing-agents.ts",
    );
    process.exit(1);
  }

  writeFileSync(TARGET, tagsPass.html, "utf8");
  console.log(
    `public/agents.html synced — ${TEMPLATES.length} agents, ` +
      `${new Set(TEMPLATES.map((t) => t.category)).size} category filters.`,
  );
}

main();
