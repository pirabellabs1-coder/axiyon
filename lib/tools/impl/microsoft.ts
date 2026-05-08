/** Microsoft Graph (Outlook + Calendar + Teams). */
import { getActiveIntegration } from "@/lib/integrations/store";

export async function outlookSend(
  orgId: string,
  args: { to: string; subject: string; body: string; cc?: string; bcc?: string },
): Promise<{ ok: boolean; error?: string }> {
  const integ = await getActiveIntegration(orgId, "microsoft");
  if (!integ) return { ok: false, error: "Microsoft 365 n'est pas connecté" };

  const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: args.subject,
        body: { contentType: "Text", content: args.body },
        toRecipients: [{ emailAddress: { address: args.to } }],
        ccRecipients: args.cc ? [{ emailAddress: { address: args.cc } }] : [],
        bccRecipients: args.bcc ? [{ emailAddress: { address: args.bcc } }] : [],
      },
      saveToSentItems: true,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Graph sendMail ${r.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true };
}

export async function outlookSearch(
  orgId: string,
  args: { query: string; n?: number },
): Promise<{ ok: boolean; messages?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "microsoft");
  if (!integ) return { ok: false, error: "Microsoft 365 n'est pas connecté" };

  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$search", `"${args.query}"`);
  url.searchParams.set("$top", String(args.n ?? 10));
  const r = await fetch(url, { headers: { Authorization: `Bearer ${integ.accessToken}` } });
  if (!r.ok) return { ok: false, error: `Graph search ${r.status}` };
  const json = (await r.json()) as { value?: unknown[] };
  return { ok: true, messages: json.value ?? [] };
}

export async function msCalendarBook(
  orgId: string,
  args: {
    subject: string;
    start: string;
    end: string;
    attendees?: string[];
    body?: string;
    location?: string;
  },
): Promise<{ ok: boolean; eventId?: string; webLink?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "microsoft");
  if (!integ) return { ok: false, error: "Microsoft 365 n'est pas connecté" };

  const r = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: args.subject,
      body: { contentType: "HTML", content: args.body ?? "" },
      start: { dateTime: args.start, timeZone: "UTC" },
      end: { dateTime: args.end, timeZone: "UTC" },
      location: args.location ? { displayName: args.location } : undefined,
      attendees: (args.attendees ?? []).map((email) => ({
        emailAddress: { address: email },
        type: "required",
      })),
    }),
  });
  if (!r.ok) return { ok: false, error: `Graph event ${r.status}` };
  const json = (await r.json()) as { id?: string; webLink?: string };
  return { ok: true, eventId: json.id, webLink: json.webLink };
}

export async function teamsPost(
  orgId: string,
  args: { teamId: string; channelId: string; text: string },
): Promise<{ ok: boolean; error?: string }> {
  const integ = await getActiveIntegration(orgId, "microsoft");
  if (!integ) return { ok: false, error: "Microsoft 365 n'est pas connecté" };

  const r = await fetch(
    `https://graph.microsoft.com/v1.0/teams/${args.teamId}/channels/${args.channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integ.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: { contentType: "text", content: args.text } }),
    },
  );
  if (!r.ok) return { ok: false, error: `Teams post ${r.status}` };
  return { ok: true };
}
