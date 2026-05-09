"use client";

import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const KINDS = [
  { value: "semantic",   label: "Sémantique",   hint: "Connaissance durable, faits, politiques, playbooks" },
  { value: "episodic",   label: "Épisodique",   hint: "Événement précis, conversation, décision passée" },
  { value: "procedural", label: "Procédurale",  hint: "Pas-à-pas, processus, workflow type" },
  { value: "client",     label: "Client",       hint: "Information sur un client, prospect ou contact" },
] as const;

export function IngestButton() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<string>("semantic");
  const [importance, setImportance] = useState(0.7);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setContent("");
    setKind("semantic");
    setImportance(0.7);
    setSource("");
    setError(null);
    setDone(false);
    setBusy(false);
  }

  async function readFile(f: File) {
    if (f.size > 1_000_000) {
      setError("Fichier trop volumineux (max 1 Mo). Découpez-le ou collez le texte directement.");
      return;
    }
    setSource(f.name);
    const text = await f.text().catch(() => "");
    if (!text) {
      setError("Impossible de lire ce fichier — collez plutôt le texte.");
      return;
    }
    setContent(text);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Le contenu ne peut pas être vide.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, kind, importance }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
      }
      setDone(true);
      // Refresh the page so the memory table picks up the new entry.
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="glow" onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Ingérer document
      </Button>
    );
  }

  return (
    <>
      <Button variant="glow" disabled>
        <Upload className="size-4" /> Ingérer document
      </Button>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => {
          if (!busy) {
            setOpen(false);
            reset();
          }
        }}
      >
        <div
          className="w-full max-w-xl bg-bg-2 border border-line rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="text-base font-medium">Ingérer un document</h2>
            <button
              type="button"
              onClick={() => {
                if (!busy) {
                  setOpen(false);
                  reset();
                }
              }}
              className="text-ink-3 hover:text-ink"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>

          {done ? (
            <div className="p-8 text-center space-y-3">
              <CheckCircle2
                className="size-12 text-brand-green mx-auto"
                strokeWidth={1.5}
              />
              <h3 className="text-lg font-medium">Mémoire ingérée</h3>
              <p className="text-ink-2 text-sm">
                Vos agents pourront immédiatement s&apos;en servir comme contexte.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="p-5 space-y-4">
              {/* File drop */}
              <div>
                <label className="text-[11px] uppercase tracking-wider font-mono text-ink-3 block mb-1.5">
                  Source (fichier ou texte)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.json,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full text-left rounded-md border border-dashed border-line hover:border-line-2 px-3 py-2.5 text-xs text-ink-2 hover:text-ink transition-colors flex items-center gap-2"
                >
                  <FileText className="size-3.5" />
                  {source || "Choisir un fichier .txt / .md / .json / .csv (max 1 Mo)"}
                </button>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-mono text-ink-3 block mb-1.5">
                  Contenu
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Collez le texte du playbook, du compte-rendu, du brief…"
                  rows={8}
                  className="w-full bg-bg-3 border border-line rounded-md px-3 py-2 text-sm placeholder:text-ink-3 focus:outline-none focus:border-brand-blue/50 font-mono"
                />
                <div className="text-[10px] font-mono text-ink-3 mt-1">
                  {content.length.toLocaleString("fr-FR")} caractères
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-mono text-ink-3 block mb-1.5">
                    Type
                  </label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="w-full bg-bg-3 border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-blue/50"
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-ink-3 mt-1">
                    {KINDS.find((k) => k.value === kind)?.hint}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-mono text-ink-3 block mb-1.5">
                    Importance · {importance.toFixed(2).replace(".", ",")}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={importance}
                    onChange={(e) => setImportance(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                  <div className="text-[10px] text-ink-3 mt-1">
                    Le retrieval pondère les entrées par importance.
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-brand-red/40 bg-brand-red/5 px-3 py-2 text-xs text-brand-red">
                  ⚠ {error}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  disabled={busy}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="glow" disabled={busy || !content.trim()}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Ingestion…
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" /> Ingérer
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
