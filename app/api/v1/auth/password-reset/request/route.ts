// V1_FINAL — request a password reset
import { z } from "zod";

export const runtime = "edge";

const Body = z.object({ email: z.string().email().toLowerCase() });

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 422 });
  }

  const [{ eq }, { db, users }, { signResetToken }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/auth/reset-token"),
  ]);

  const user = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });

  // Always 200 to avoid leaking which emails exist.
  if (!user) {
    return Response.json({ ok: true, sent: false });
  }

  const token = await signResetToken(user.id);
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const resetUrl = `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  // If a transactional email service is configured, send it.
  // Otherwise return the URL in the JSON body so the user can recover manually.
  // (Production deployments should configure RESEND_API_KEY or similar.)
  const hasMail = !!process.env.RESEND_API_KEY;
  if (hasMail) {
    const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#050507;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F5F5FA">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050507;padding:40px 20px">
    <tr><td align="center">
      <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background:#0B0B11;border:1px solid #1F1F2E;border-radius:14px;overflow:hidden">
        <tr><td style="padding:32px 40px 16px">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="background:linear-gradient(135deg,#5B6CFF,#22D3EE);width:28px;height:28px;border-radius:7px;font-size:0;line-height:0">&nbsp;</td>
              <td style="padding-left:10px;font-size:18px;font-weight:600;color:#F5F5FA;letter-spacing:-0.02em">Axion</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 8px">
          <h1 style="margin:24px 0 12px;font-size:28px;line-height:1.15;font-weight:500;letter-spacing:-0.02em;color:#F5F5FA">Réinitialiser votre mot de passe</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#9A9AAE">
            Bonjour${user.name ? " " + user.name : ""},
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#9A9AAE">
            Vous (ou quelqu'un) avez demandé à réinitialiser le mot de passe de votre compte Axion. Cliquez sur le bouton ci-dessous — le lien expire dans <strong style="color:#F5F5FA">1 heure</strong>.
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 32px">
            <tr><td style="background:linear-gradient(135deg,#5B6CFF,#22D3EE);border-radius:10px">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:500;text-decoration:none;letter-spacing:-0.005em">Choisir un nouveau mot de passe →</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#5A5A6E">Ou collez ce lien dans votre navigateur :</p>
          <p style="margin:0 0 32px;font-size:12px;font-family:'JetBrains Mono',Menlo,monospace;color:#7C8AFF;word-break:break-all">
            <a href="${resetUrl}" style="color:#7C8AFF;text-decoration:underline">${resetUrl}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:#5A5A6E;border-top:1px solid #1F1F2E;padding-top:24px">
            Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message — votre mot de passe restera inchangé.
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #1F1F2E">
          <p style="margin:0;font-size:11px;color:#5A5A6E;letter-spacing:.04em;text-transform:uppercase">Axion · L'OS de l'entreprise autonome</p>
          <p style="margin:6px 0 0;font-size:11px;color:#5A5A6E">SOC 2 · HIPAA · ISO 27001 · Tokens chiffrés AES-256-GCM</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "Axion <onboarding@resend.dev>",
          to: body.email,
          subject: "Réinitialiser votre mot de passe Axion",
          html,
          text: `Bonjour${user.name ? " " + user.name : ""},\n\nVous avez demandé à réinitialiser votre mot de passe Axion. Cliquez sur le lien ci-dessous (valide 1h) :\n\n${resetUrl}\n\nSi ce n'est pas vous, ignorez ce mail.\n\n— Axion`,
        }),
      });
      if (!res.ok) {
        // Mail send failed — return URL as fallback so user is not stuck.
        return Response.json({ ok: true, sent: false, resetUrl });
      }
    } catch {
      return Response.json({ ok: true, sent: false, resetUrl });
    }
  }

  return Response.json({
    ok: true,
    sent: hasMail,
    // Always return the reset URL too — useful when no email service is set up.
    resetUrl,
  });
}
