"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plug,
  Unplug,
  Lock,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  PROVIDER_LIST,
  categoryLabel,
  type ProviderDef,
} from "@/lib/integrations/providers";
import { cn } from "@/lib/utils";

interface ConnectedIntegration {
  id: string;
  provider: string;
  accountEmail: string | null;
  accountName: string | null;
  status: string;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  connected: "Connecté",
  expired: "Expiré",
  revoked: "Révoqué",
  error: "Erreur",
};

const STATUS_COLOR: Record<string, string> = {
  connected: "text-brand-green",
  expired: "text-brand-yellow",
  revoked: "text-ink-3",
  error: "text-brand-red",
};

export function IntegrationsClient({ connected }: { connected: ConnectedIntegration[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const flashConnected = params.get("connected");
  const flashError = params.get("error");
  const flashProvider = params.get("provider");

  const connectedMap = useMemo(() => {
    const map = new Map<string, ConnectedIntegration>();
    for (const c of connected) map.set(c.provider, c);
    return map;
  }, [connected]);

  const [activeProvider, setActiveProvider] = useState<ProviderDef | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    PROVIDER_LIST.forEach((p) => set.add(p.category));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return PROVIDER_LIST;
    return PROVIDER_LIST.filter((p) => p.category === filter);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Intégrations</h1>
        <p className="text-ink-2 mt-1.5">
          Connectez vos outils tiers pour que vos agents puissent agir réellement :
          envoyer des emails, passer des appels, créer des contacts CRM, poster sur Slack…
        </p>
      </div>

      {flashConnected && (
        <FlashBanner
          variant="success"
          title={`${flashConnected} connecté avec succès`}
          subtitle="Vos agents peuvent désormais utiliser ce service en production."
          onClose={() => router.replace("/dashboard/integrations")}
        />
      )}
      {flashError && (
        <FlashBanner
          variant="error"
          title={`Échec de la connexion${flashProvider ? ` à ${flashProvider}` : ""}`}
          subtitle={decodeURIComponent(flashError)}
          onClose={() => router.replace("/dashboard/integrations")}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Total connectés"
          value={connected.length}
          accent="text-brand-blue"
        />
        <StatTile
          label="En santé"
          value={connected.filter((c) => c.status === "connected").length}
          accent="text-brand-green"
        />
        <StatTile
          label="Expirés"
          value={connected.filter((c) => c.status === "expired").length}
          accent="text-brand-yellow"
        />
        <StatTile
          label="Disponibles"
          value={PROVIDER_LIST.length}
          accent="text-ink-2"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <CategoryButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="Tous"
        />
        {categories.map((c) => (
          <CategoryButton
            key={c}
            active={filter === c}
            onClick={() => setFilter(c)}
            label={categoryLabel(c as never)}
          />
        ))}
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const conn = connectedMap.get(p.slug);
          const Icon = p.icon;
          return (
            <Card
              key={p.slug}
              className={cn(
                "transition-colors",
                conn?.status === "connected" && "border-brand-green/40 bg-brand-green/[0.03]",
              )}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="size-11 rounded-md bg-bg-3 border border-line flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-brand-blue-2" strokeWidth={1.6} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-[15px] leading-tight">
                      {p.name}
                    </CardTitle>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-ink-3 mt-1">
                      {categoryLabel(p.category)}
                    </div>
                  </div>
                  {conn && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-mono",
                        STATUS_COLOR[conn.status] ?? "text-ink-3",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          conn.status === "connected" && "bg-brand-green",
                          conn.status === "expired" && "bg-brand-yellow",
                          conn.status === "error" && "bg-brand-red",
                        )}
                      />
                      {STATUS_LABEL[conn.status] ?? conn.status}
                    </span>
                  )}
                </div>

                <CardDescription className="text-xs leading-relaxed">
                  {p.description}
                </CardDescription>

                {conn && (
                  <div className="text-xs text-ink-3 font-mono space-y-0.5 pt-1 border-t border-line">
                    {conn.accountEmail && <div>{conn.accountEmail}</div>}
                    {conn.accountName && !conn.accountEmail && <div>{conn.accountName}</div>}
                    <div>
                      Connecté le {new Date(conn.connectedAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-3 font-mono">
                  {p.unlocksTools.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded border border-line bg-bg-3 px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                  {p.unlocksTools.length > 3 && (
                    <span className="text-ink-3">+{p.unlocksTools.length - 3}</span>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  {conn ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        if (!confirm(`Déconnecter ${p.name} ?`)) return;
                        await fetch(`/api/integrations/${conn.id}`, { method: "DELETE" });
                        router.refresh();
                      }}
                    >
                      <Unplug className="size-3.5" />
                      Déconnecter
                    </Button>
                  ) : (
                    <Button
                      variant="glow"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (p.flow.type === "oauth2") {
                          window.location.href = `/api/integrations/${p.slug}/connect`;
                        } else {
                          setActiveProvider(p);
                        }
                      }}
                    >
                      <Plug className="size-3.5" />
                      Connecter
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* API-key modal */}
      {activeProvider && (
        <ApiKeyDialog
          provider={activeProvider}
          onClose={() => setActiveProvider(null)}
          onConnected={() => {
            setActiveProvider(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-ink-2 mb-1.5">{label}</div>
        <div className={cn("text-2xl font-medium tracking-tight tabular-nums", accent)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md border text-xs whitespace-nowrap transition-colors font-medium",
        active
          ? "bg-brand-blue text-white border-brand-blue"
          : "border-line bg-bg-2 text-ink-2 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function FlashBanner({
  variant,
  title,
  subtitle,
  onClose,
}: {
  variant: "success" | "error";
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const Icon = variant === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={cn(
        "rounded-md border p-4 flex items-start gap-3",
        variant === "success"
          ? "border-brand-green/30 bg-brand-green/5"
          : "border-brand-red/30 bg-brand-red/5",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0 mt-0.5",
          variant === "success" ? "text-brand-green" : "text-brand-red",
        )}
      />
      <div className="flex-1">
        <div
          className={cn(
            "font-medium text-sm",
            variant === "success" ? "text-brand-green" : "text-brand-red",
          )}
        >
          {title}
        </div>
        <p className="text-xs text-ink-2 mt-1">{subtitle}</p>
      </div>
      <button onClick={onClose} className="text-ink-3 hover:text-ink">
        <XCircle className="size-4" />
      </button>
    </div>
  );
}

function ApiKeyDialog({
  provider,
  onClose,
  onConnected,
}: {
  provider: ProviderDef;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (provider.flow.type !== "api_key") return null;
  const flow = provider.flow;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const r = await fetch(`/api/integrations/${provider.slug}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `HTTP ${r.status}`);
      setSubmitting(false);
      return;
    }
    onConnected();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="size-11 rounded-md bg-bg-3 border border-line flex items-center justify-center shrink-0">
            <provider.icon className="size-5 text-brand-blue-2" strokeWidth={1.6} />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-medium">Connecter {provider.name}</h3>
            <p className="text-xs text-ink-2 mt-1">{provider.description}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {flow.fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-2 font-mono flex items-center gap-1.5">
                {f.secret && <Lock className="size-3" />}
                {f.label}
              </label>
              <input
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                required
                value={fields[f.name] ?? ""}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [f.name]: e.target.value }))
                }
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue font-mono"
              />
            </div>
          ))}

          {error && (
            <div className="rounded-md border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="glow"
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                <>
                  <Plug className="size-4" />
                  Connecter
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
