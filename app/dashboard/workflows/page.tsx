import { Card, CardContent } from "@/components/ui/card";

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Workflows</h1>
        <p className="text-ink-2 mt-1">
          Orchestrez plusieurs agents en chaîne. Bientôt accessible en YAML + UI.
        </p>
      </div>
      <Card>
        <CardContent className="p-12 text-center space-y-2">
          <div className="text-5xl">🧩</div>
          <p className="text-ink-2">
            Les workflows multi-agents sont pré-câblés dans la DB
            (table <span className="font-mono text-brand-cyan">workflows</span>) et exécutables via
            l'API <span className="font-mono text-brand-cyan">POST /api/workflows/[slug]/run</span>.
          </p>
          <p className="text-ink-3 text-sm">L'éditeur visuel arrive dans la prochaine release.</p>
        </CardContent>
      </Card>
    </div>
  );
}
