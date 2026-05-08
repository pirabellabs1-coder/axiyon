/** GitHub — issues, PRs, workflow dispatch. */
import { getActiveIntegration } from "@/lib/integrations/store";

const GH_HEADERS = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "axion",
});

export async function githubCreateIssue(
  orgId: string,
  args: { repo: string; title: string; body?: string; labels?: string[] },
): Promise<{ ok: boolean; number?: number; url?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "github");
  if (!integ) return { ok: false, error: "GitHub n'est pas connecté" };

  const r = await fetch(`https://api.github.com/repos/${args.repo}/issues`, {
    method: "POST",
    headers: { ...GH_HEADERS(integ.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ title: args.title, body: args.body, labels: args.labels }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `GitHub ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { number?: number; html_url?: string };
  return { ok: true, number: json.number, url: json.html_url };
}

export async function githubListPrs(
  orgId: string,
  args: { repo: string; state?: "open" | "closed" | "all" },
): Promise<{ ok: boolean; prs?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "github");
  if (!integ) return { ok: false, error: "GitHub n'est pas connecté" };

  const url = new URL(`https://api.github.com/repos/${args.repo}/pulls`);
  url.searchParams.set("state", args.state ?? "open");
  url.searchParams.set("per_page", "30");
  const r = await fetch(url, { headers: GH_HEADERS(integ.accessToken) });
  if (!r.ok) return { ok: false, error: `GitHub PRs ${r.status}` };
  const json = (await r.json()) as unknown[];
  return { ok: true, prs: json };
}

export async function githubDispatchWorkflow(
  orgId: string,
  args: { repo: string; workflowId: string; ref: string; inputs?: Record<string, unknown> },
): Promise<{ ok: boolean; error?: string }> {
  const integ = await getActiveIntegration(orgId, "github");
  if (!integ) return { ok: false, error: "GitHub n'est pas connecté" };

  const r = await fetch(
    `https://api.github.com/repos/${args.repo}/actions/workflows/${args.workflowId}/dispatches`,
    {
      method: "POST",
      headers: { ...GH_HEADERS(integ.accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: args.ref, inputs: args.inputs ?? {} }),
    },
  );
  if (!r.ok) return { ok: false, error: `GitHub dispatch ${r.status}` };
  return { ok: true };
}
