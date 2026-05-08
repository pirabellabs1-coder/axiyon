/** HubSpot CRM — contacts, deals, notes. */
import { getActiveIntegration } from "@/lib/integrations/store";

export async function hubspotCreateContact(
  orgId: string,
  args: {
    email: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    phone?: string;
    jobtitle?: string;
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "hubspot");
  if (!integ) return { ok: false, error: "HubSpot n'est pas connecté" };

  const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: args }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `HubSpot ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string };
  return { ok: true, id: json.id };
}

export async function hubspotSearchContact(
  orgId: string,
  args: { query: string; n?: number },
): Promise<{ ok: boolean; results?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "hubspot");
  if (!integ) return { ok: false, error: "HubSpot n'est pas connecté" };

  const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: args.query,
      limit: args.n ?? 10,
      properties: ["email", "firstname", "lastname", "company", "phone", "jobtitle"],
    }),
  });
  if (!r.ok) return { ok: false, error: `HubSpot search ${r.status}` };
  const json = (await r.json()) as { results?: unknown[] };
  return { ok: true, results: json.results ?? [] };
}

export async function hubspotCreateDeal(
  orgId: string,
  args: {
    dealname: string;
    amount?: number;
    pipeline?: string;
    dealstage?: string;
    closedate?: string;
    contactId?: string;
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "hubspot");
  if (!integ) return { ok: false, error: "HubSpot n'est pas connecté" };

  const properties: Record<string, unknown> = {
    dealname: args.dealname,
    amount: args.amount,
    pipeline: args.pipeline ?? "default",
    dealstage: args.dealstage ?? "appointmentscheduled",
  };
  if (args.closedate) properties.closedate = args.closedate;

  const r = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties,
      associations: args.contactId
        ? [
            {
              to: { id: args.contactId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
            },
          ]
        : undefined,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `HubSpot deal ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string };
  return { ok: true, id: json.id };
}

export async function hubspotCreateNote(
  orgId: string,
  args: { body: string; contactId?: string; dealId?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "hubspot");
  if (!integ) return { ok: false, error: "HubSpot n'est pas connecté" };

  const associations: Array<{ to: { id: string }; types: unknown[] }> = [];
  if (args.contactId)
    associations.push({
      to: { id: args.contactId },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
    });
  if (args.dealId)
    associations.push({
      to: { id: args.dealId },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
    });

  const r = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { hs_note_body: args.body, hs_timestamp: Date.now() },
      associations,
    }),
  });
  if (!r.ok) return { ok: false, error: `HubSpot note ${r.status}` };
  const json = (await r.json()) as { id?: string };
  return { ok: true, id: json.id };
}
