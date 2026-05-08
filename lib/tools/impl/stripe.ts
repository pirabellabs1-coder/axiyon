/** Stripe — payments + invoices + customers. */
import { getApiKeyFields } from "@/lib/integrations/store";

async function stripeApi<T>(
  orgId: string,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, string>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const fields = await getApiKeyFields(orgId, "stripe");
  if (!fields?.secret_key) return { ok: false, error: "Stripe n'est pas connecté" };

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${fields.secret_key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) init.body = new URLSearchParams(body).toString();

  const r = await fetch(`https://api.stripe.com${path}`, init);
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { ok: false, error: `Stripe ${r.status}: ${JSON.stringify(json).slice(0, 300)}` };
  return { ok: true, data: json as T };
}

export async function stripeCreateCustomer(
  orgId: string,
  args: { email: string; name?: string; phone?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = await stripeApi<{ id?: string }>(orgId, "/v1/customers", "POST", args);
  return { ok: r.ok, id: r.data?.id, error: r.error };
}

export async function stripeCreateInvoice(
  orgId: string,
  args: {
    customer: string;
    amount: number;
    currency?: string;
    description?: string;
  },
): Promise<{ ok: boolean; invoiceId?: string; hostedInvoiceUrl?: string; error?: string }> {
  // 1) Create an invoice item
  const itemRes = await stripeApi<{ id?: string }>(orgId, "/v1/invoiceitems", "POST", {
    customer: args.customer,
    amount: String(args.amount),
    currency: args.currency ?? "eur",
    description: args.description ?? "Axion invoice",
  });
  if (!itemRes.ok) return { ok: false, error: itemRes.error };

  // 2) Create + finalize the invoice
  const invRes = await stripeApi<{ id?: string }>(orgId, "/v1/invoices", "POST", {
    customer: args.customer,
    auto_advance: "true",
  });
  if (!invRes.ok || !invRes.data?.id) return { ok: false, error: invRes.error };

  const finRes = await stripeApi<{ id?: string; hosted_invoice_url?: string }>(
    orgId,
    `/v1/invoices/${invRes.data.id}/finalize`,
    "POST",
    {},
  );
  if (!finRes.ok) return { ok: false, error: finRes.error };

  return {
    ok: true,
    invoiceId: finRes.data?.id,
    hostedInvoiceUrl: finRes.data?.hosted_invoice_url,
  };
}

export async function stripeListCharges(
  orgId: string,
  args: { limit?: number },
): Promise<{ ok: boolean; charges?: unknown[]; error?: string }> {
  const r = await stripeApi<{ data?: unknown[] }>(
    orgId,
    `/v1/charges?limit=${args.limit ?? 10}`,
  );
  return { ok: r.ok, charges: r.data?.data, error: r.error };
}
