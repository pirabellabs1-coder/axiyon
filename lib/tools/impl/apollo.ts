/** Apollo.io — real B2B prospect search + enrichment. */
import { getApiKeyFields } from "@/lib/integrations/store";

export async function apolloSearchPeople(
  orgId: string,
  args: {
    person_titles?: string[];
    organization_locations?: string[];
    person_seniorities?: string[];
    n?: number;
  },
): Promise<{ ok: boolean; people?: unknown[]; error?: string }> {
  const fields = await getApiKeyFields(orgId, "apollo");
  if (!fields?.api_key) return { ok: false, error: "Apollo n'est pas connecté" };

  const r = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "X-Api-Key": fields.api_key,
    },
    body: JSON.stringify({
      page: 1,
      per_page: args.n ?? 10,
      person_titles: args.person_titles,
      organization_locations: args.organization_locations,
      person_seniorities: args.person_seniorities,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Apollo ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { people?: unknown[] };
  return { ok: true, people: json.people ?? [] };
}

export async function apolloEnrichPerson(
  orgId: string,
  args: { email?: string; first_name?: string; last_name?: string; organization_name?: string },
): Promise<{ ok: boolean; person?: unknown; error?: string }> {
  const fields = await getApiKeyFields(orgId, "apollo");
  if (!fields?.api_key) return { ok: false, error: "Apollo n'est pas connecté" };

  const r = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "X-Api-Key": fields.api_key,
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) return { ok: false, error: `Apollo enrich ${r.status}` };
  const json = (await r.json()) as { person?: unknown };
  return { ok: true, person: json.person };
}
