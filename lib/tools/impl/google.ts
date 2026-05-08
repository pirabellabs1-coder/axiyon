/**
 * Google (Gmail + Calendar) — real API calls when the org has the integration.
 */
import { getActiveIntegration } from "@/lib/integrations/store";

export async function gmailSend(
  orgId: string,
  args: { to: string; subject: string; body: string; cc?: string; bcc?: string },
): Promise<{ ok: boolean; messageId?: string; threadId?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "google");
  if (!integ) return { ok: false, error: "Google n'est pas connecté pour cette organisation" };

  const headers = [
    `From: ${integ.accountEmail ?? "me"}`,
    `To: ${args.to}`,
    args.cc ? `Cc: ${args.cc}` : "",
    args.bcc ? `Bcc: ${args.bcc}` : "",
    `Subject: =?UTF-8?B?${Buffer.from(args.subject).toString("base64")}?=`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    args.body,
  ]
    .filter(Boolean)
    .join("\r\n");

  const raw = Buffer.from(headers)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Gmail API ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string; threadId?: string };
  return { ok: true, messageId: json.id, threadId: json.threadId };
}

export async function gmailSearch(
  orgId: string,
  args: { query: string; n?: number },
): Promise<{ ok: boolean; messages?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "google");
  if (!integ) return { ok: false, error: "Google n'est pas connecté" };

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", args.query);
  url.searchParams.set("maxResults", String(args.n ?? 10));
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${integ.accessToken}` },
  });
  if (!r.ok) return { ok: false, error: `Gmail search ${r.status}` };
  const json = (await r.json()) as { messages?: Array<{ id: string }> };
  return { ok: true, messages: json.messages ?? [] };
}

export async function calendarBook(
  orgId: string,
  args: {
    summary: string;
    start: string;
    end: string;
    attendees?: string[];
    description?: string;
    location?: string;
  },
): Promise<{ ok: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  const integ = await getActiveIntegration(orgId, "google");
  if (!integ) return { ok: false, error: "Google n'est pas connecté" };

  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integ.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        attendees: (args.attendees ?? []).map((email) => ({ email })),
      }),
    },
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Calendar API ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { id?: string; htmlLink?: string };
  return { ok: true, eventId: json.id, htmlLink: json.htmlLink };
}

export async function calendarList(
  orgId: string,
  args: { sinceDays?: number; n?: number },
): Promise<{ ok: boolean; events?: unknown[]; error?: string }> {
  const integ = await getActiveIntegration(orgId, "google");
  if (!integ) return { ok: false, error: "Google n'est pas connecté" };

  const since = new Date(Date.now() - (args.sinceDays ?? 7) * 86_400_000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", since);
  url.searchParams.set("maxResults", String(args.n ?? 20));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${integ.accessToken}` } });
  if (!r.ok) return { ok: false, error: `Calendar list ${r.status}` };
  const json = (await r.json()) as { items?: unknown[] };
  return { ok: true, events: json.items ?? [] };
}
