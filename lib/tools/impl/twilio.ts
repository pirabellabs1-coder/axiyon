/** Twilio — real phone calls + SMS. */
import { getApiKeyFields } from "@/lib/integrations/store";

function basicAuth(sid: string, token: string): string {
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

export async function twilioCall(
  orgId: string,
  args: { to: string; twiml?: string; url?: string },
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const fields = await getApiKeyFields(orgId, "twilio");
  if (!fields) return { ok: false, error: "Twilio n'est pas connecté" };
  const { account_sid, auth_token, from_number } = fields;
  if (!account_sid || !auth_token || !from_number) {
    return { ok: false, error: "Identifiants Twilio incomplets" };
  }

  const body = new URLSearchParams({
    From: from_number,
    To: args.to,
    ...(args.url ? { Url: args.url } : { Twiml: args.twiml ?? "<Response><Say>Bonjour, ceci est Axion.</Say></Response>" }),
  });

  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(account_sid, auth_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Twilio call ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

export async function twilioSms(
  orgId: string,
  args: { to: string; body: string },
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const fields = await getApiKeyFields(orgId, "twilio");
  if (!fields) return { ok: false, error: "Twilio n'est pas connecté" };
  const { account_sid, auth_token, from_number } = fields;
  if (!account_sid || !auth_token || !from_number) {
    return { ok: false, error: "Identifiants Twilio incomplets" };
  }

  const body = new URLSearchParams({
    From: from_number,
    To: args.to,
    Body: args.body,
  });

  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(account_sid, auth_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, error: `Twilio SMS ${r.status}: ${text.slice(0, 300)}` };
  }
  const json = (await r.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

export async function twilioListNumbers(
  orgId: string,
): Promise<{ ok: boolean; numbers?: string[]; error?: string }> {
  const fields = await getApiKeyFields(orgId, "twilio");
  if (!fields) return { ok: false, error: "Twilio n'est pas connecté" };
  const { account_sid, auth_token } = fields;

  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/IncomingPhoneNumbers.json`,
    { headers: { Authorization: basicAuth(account_sid, auth_token) } },
  );
  if (!r.ok) return { ok: false, error: `Twilio numbers ${r.status}` };
  const json = (await r.json()) as {
    incoming_phone_numbers?: Array<{ phone_number: string }>;
  };
  return {
    ok: true,
    numbers: (json.incoming_phone_numbers ?? []).map((n) => n.phone_number),
  };
}
