/** SendGrid — transactional email at scale. */
import { getApiKeyFields } from "@/lib/integrations/store";

export async function sendgridSend(
  orgId: string,
  args: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    htmlBody?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const fields = await getApiKeyFields(orgId, "sendgrid");
  if (!fields?.api_key) return { ok: false, error: "SendGrid n'est pas connecté" };
  if (!fields.from_email) return { ok: false, error: "SendGrid : from_email manquant" };

  const personalizations: Array<Record<string, unknown>> = [
    {
      to: [{ email: args.to }],
      cc: args.cc ? [{ email: args.cc }] : undefined,
      bcc: args.bcc ? [{ email: args.bcc }] : undefined,
    },
  ];

  const content: Array<{ type: string; value: string }> = [
    { type: "text/plain", value: args.body },
  ];
  if (args.htmlBody) content.push({ type: "text/html", value: args.htmlBody });

  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fields.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations,
      from: { email: fields.from_email, name: fields.from_name ?? undefined },
      subject: args.subject,
      content,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `SendGrid ${r.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true };
}
