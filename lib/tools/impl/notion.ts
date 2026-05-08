/** Notion — pages + databases. */
import { getActiveIntegration } from "@/lib/integrations/store";

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

export async function notionCreatePage(
  orgId: string,
  args: { parentPageId: string; title: string; markdown: string },
): Promise<{ ok: boolean; pageId?: string; url?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "notion");
  if (!integ) return { ok: false, error: "Notion n'est pas connecté" };

  const blocks = args.markdown
    .split(/\n\n+/)
    .filter(Boolean)
    .slice(0, 90)
    .map((para) => ({
      object: "block" as const,
      type: "paragraph" as const,
      paragraph: { rich_text: [{ type: "text", text: { content: para.slice(0, 1900) } }] },
    }));

  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: NOTION_HEADERS(integ.accessToken),
    body: JSON.stringify({
      parent: { page_id: args.parentPageId },
      properties: {
        title: { title: [{ text: { content: args.title.slice(0, 200) } }] },
      },
      children: blocks,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Notion ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string; url?: string };
  return { ok: true, pageId: json.id, url: json.url };
}

export async function notionSearch(
  orgId: string,
  args: { query: string; n?: number },
): Promise<{ ok: boolean; results?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "notion");
  if (!integ) return { ok: false, error: "Notion n'est pas connecté" };

  const r = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: NOTION_HEADERS(integ.accessToken),
    body: JSON.stringify({ query: args.query, page_size: args.n ?? 10 }),
  });
  if (!r.ok) return { ok: false, error: `Notion search ${r.status}` };
  const json = (await r.json()) as { results?: unknown[] };
  return { ok: true, results: json.results ?? [] };
}

export async function notionUpdatePage(
  orgId: string,
  args: { pageId: string; properties: Record<string, unknown> },
): Promise<{ ok: boolean; error?: string }> {
  const integ = await getActiveIntegration(orgId, "notion");
  if (!integ) return { ok: false, error: "Notion n'est pas connecté" };

  const r = await fetch(`https://api.notion.com/v1/pages/${args.pageId}`, {
    method: "PATCH",
    headers: NOTION_HEADERS(integ.accessToken),
    body: JSON.stringify({ properties: args.properties }),
  });
  if (!r.ok) return { ok: false, error: `Notion update ${r.status}` };
  return { ok: true };
}
