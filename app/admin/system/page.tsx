import { Check, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { hasAnyProvider } from "@/lib/llm/router";

export default function SystemPage() {
  const providers = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  };
  const env = process.env.NODE_ENV;
  const region = process.env.VERCEL_REGION ?? "local";
  const url = process.env.VERCEL_URL ?? "localhost:3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Système</h1>
        <p className="text-ink-2 mt-1">État de la plate-forme.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Runtime</h3>
            <KV label="Env" value={env ?? "—"} />
            <KV label="Région Vercel" value={region} />
            <KV label="URL" value={url} />
            <Status label="Provider IA actif" ok={hasAnyProvider()} okText="actif" koText="aucune clé" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Providers IA</h3>
            <Status label="ANTHROPIC_API_KEY" ok={providers.anthropic} okText="configuré" koText="absent" />
            <Status label="OPENAI_API_KEY" ok={providers.openai} okText="configuré" koText="absent" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Database</h3>
            <KV label="Type" value="Postgres + pgvector (Neon via @vercel/postgres)" />
            <Status
              label="POSTGRES_URL"
              ok={!!process.env.POSTGRES_URL}
              okText="configuré"
              koText="absent"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Sécurité</h3>
            <Status label="AUTH_SECRET" ok={!!process.env.AUTH_SECRET} okText="OK" koText="absent" />
            <Status
              label="AXION_ENCRYPTION_KEY"
              ok={!!process.env.AXION_ENCRYPTION_KEY}
              okText="OK"
              koText="utilise AUTH_SECRET en fallback"
            />
            <KV
              label="Super-admin email"
              value={process.env.SUPER_ADMIN_EMAIL ?? "(non configuré)"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="text-ink-3 font-mono text-xs uppercase tracking-wider">{label}</div>
      <div className="text-ink truncate">{value}</div>
    </div>
  );
}

function Status({
  label,
  ok,
  okText,
  koText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  koText: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="text-ink-3 font-mono text-xs uppercase tracking-wider">{label}</div>
      <div className={`flex items-center gap-1.5 ${ok ? "text-brand-green" : "text-brand-red"}`}>
        {ok ? <Check className="size-4" strokeWidth={2} /> : <X className="size-4" strokeWidth={2} />}
        <span>{ok ? okText : koText}</span>
      </div>
    </div>
  );
}
