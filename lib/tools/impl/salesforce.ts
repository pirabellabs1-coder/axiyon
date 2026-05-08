/** Salesforce REST — leads, accounts, opportunities. */
import { getActiveIntegration } from "@/lib/integrations/store";

function getInstanceUrl(integ: { metadata: Record<string, unknown> }): string {
  const md = integ.metadata as { profile?: { instance_url?: string }; raw?: { instance_url?: string } };
  return (
    md.profile?.instance_url ??
    md.raw?.instance_url ??
    "https://login.salesforce.com"
  );
}

export async function sfdcCreateLead(
  orgId: string,
  args: {
    Email: string;
    LastName: string;
    FirstName?: string;
    Company: string;
    Title?: string;
    Phone?: string;
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "salesforce");
  if (!integ) return { ok: false, error: "Salesforce n'est pas connecté" };
  const base = getInstanceUrl(integ);

  const r = await fetch(`${base}/services/data/v60.0/sobjects/Lead`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `SFDC ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string };
  return { ok: true, id: json.id };
}

export async function sfdcSearchAccount(
  orgId: string,
  args: { name: string },
): Promise<{ ok: boolean; results?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "salesforce");
  if (!integ) return { ok: false, error: "Salesforce n'est pas connecté" };
  const base = getInstanceUrl(integ);

  const url = new URL(`${base}/services/data/v60.0/parameterizedSearch/`);
  url.searchParams.set("q", args.name);
  url.searchParams.set("sobject", "Account");
  url.searchParams.set("Account.fields", "Id,Name,Website,Industry,AnnualRevenue");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${integ.accessToken}` } });
  if (!r.ok) return { ok: false, error: `SFDC search ${r.status}` };
  const json = (await r.json()) as { searchRecords?: unknown[] };
  return { ok: true, results: json.searchRecords ?? [] };
}

export async function sfdcCreateOpportunity(
  orgId: string,
  args: {
    Name: string;
    StageName: string;
    CloseDate: string;
    Amount?: number;
    AccountId?: string;
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "salesforce");
  if (!integ) return { ok: false, error: "Salesforce n'est pas connecté" };
  const base = getInstanceUrl(integ);

  const r = await fetch(`${base}/services/data/v60.0/sobjects/Opportunity`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `SFDC opp ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string };
  return { ok: true, id: json.id };
}
