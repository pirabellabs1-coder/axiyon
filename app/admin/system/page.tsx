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
            <KV label="Provider IA actif" value={hasAnyProvider() ? "✓" : "✗ aucune clé"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Providers IA</h3>
            <KV label="ANTHROPIC_API_KEY" value={providers.anthropic ? "✓ configuré" : "✗ absent"} />
            <KV label="OPENAI_API_KEY" value={providers.openai ? "✓ configuré" : "✗ absent"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Database</h3>
            <KV label="Type" value="Postgres + pgvector (Neon via @vercel/postgres)" />
            <KV
              label="POSTGRES_URL"
              value={process.env.POSTGRES_URL ? "✓ configuré" : "✗ absent"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Sécurité</h3>
            <KV label="AUTH_SECRET" value={process.env.AUTH_SECRET ? "✓" : "✗"} />
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
