/** Slack — post messages, list channels, send DMs. */
import { getActiveIntegration } from "@/lib/integrations/store";

async function slackApi<T>(
  orgId: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const integ = await getActiveIntegration(orgId, "slack");
  if (!integ) return { ok: false, error: "Slack n'est pas connecté" };

  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integ.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!json.ok) return { ok: false, error: json.error ?? `Slack ${method} failed` };
  return { ok: true, data: json as unknown as T };
}

export async function slackPostMessage(
  orgId: string,
  args: { channel: string; text: string; blocks?: unknown[] },
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const r = await slackApi<{ ts?: string }>(orgId, "chat.postMessage", {
    channel: args.channel,
    text: args.text,
    blocks: args.blocks,
  });
  return { ok: r.ok, ts: r.data?.ts, error: r.error };
}

export async function slackListChannels(
  orgId: string,
  args: { limit?: number },
): Promise<{ ok: boolean; channels?: Array<{ id: string; name: string }>; error?: string }> {
  const r = await slackApi<{ channels?: Array<{ id: string; name: string }> }>(orgId, "conversations.list", {
    limit: args.limit ?? 100,
    exclude_archived: true,
  });
  return { ok: r.ok, channels: r.data?.channels, error: r.error };
}

export async function slackSendDm(
  orgId: string,
  args: { user: string; text: string },
): Promise<{ ok: boolean; error?: string }> {
  // Open conversation first
  const open = await slackApi<{ channel?: { id: string } }>(orgId, "conversations.open", {
    users: args.user,
  });
  if (!open.ok || !open.data?.channel?.id) return { ok: false, error: open.error ?? "Cannot open DM" };
  const r = await slackApi<unknown>(orgId, "chat.postMessage", {
    channel: open.data.channel.id,
    text: args.text,
  });
  return { ok: r.ok, error: r.error };
}
