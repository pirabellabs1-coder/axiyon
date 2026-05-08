/**
 * Workflows pré-configurés.
 *
 * Chargés au premier accès à /dashboard/workflows si la table est vide pour
 * cette org. Démontre les patterns multi-agents les plus courants.
 */
import type { WorkflowSpec } from "./types";

export interface WorkflowPreset {
  slug: string;
  spec: WorkflowSpec;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    slug: "deal-flow-hebdo",
    spec: {
      name: "Deal Flow Hebdomadaire",
      description:
        "Sourcing ICP → qualification de marge → outreach → booking de démos. Lance chaque lundi 9h.",
      schedule_cron: "0 9 * * 1",
      steps: [
        {
          id: "source",
          agent_slug: "sdr-outbound",
          action: "Source 50 prospects matchant l'ICP cible et enrichis-les avec Apollo.",
          depends_on: [],
        },
        {
          id: "qualify",
          agent_slug: "cfo-assistant",
          action:
            "Sur les leads sourcés, qualifie ceux dont la marge brute attendue dépasse 80k€. Renvoie un classement.",
          depends_on: ["source"],
        },
        {
          id: "outreach",
          agent_slug: "sdr-outbound",
          action:
            "Sur les leads qualifiés, envoie une séquence d'outreach personnalisée et booke les démos sur le calendrier.",
          depends_on: ["qualify"],
        },
      ],
    },
  },
  {
    slug: "cloture-mensuelle",
    spec: {
      name: "Clôture Mensuelle",
      description:
        "Atlas tire les chiffres, Sigma rapproche les écritures, Quill prépare la conformité fiscale.",
      schedule_cron: "0 7 1 * *",
      steps: [
        {
          id: "trial-balance",
          agent_slug: "cfo-assistant",
          action: "Tire la balance générale du mois courant et résume la santé financière.",
          depends_on: [],
        },
        {
          id: "reconcile",
          agent_slug: "bookkeeper",
          action: "Rapproche les écritures bancaires avec le trial balance d'Atlas.",
          depends_on: ["trial-balance"],
        },
        {
          id: "tax-prep",
          agent_slug: "tax",
          action: "Prépare la déclaration TVA + IS pour le mois clos.",
          depends_on: ["reconcile"],
        },
      ],
    },
  },
  {
    slug: "incident-response",
    spec: {
      name: "Réponse à Incident P1",
      description:
        "Pulse coordonne, Forge investigue les logs, Sentinel checke les vulnérabilités, Sage rédige la com client.",
      steps: [
        {
          id: "investigate",
          agent_slug: "devops",
          action: "Cherche dans les logs des 2 dernières heures les erreurs critiques.",
          depends_on: [],
        },
        {
          id: "security",
          agent_slug: "appsec",
          action: "Vérifie que cette anomalie n'est pas un signe d'exploitation de vulnérabilité.",
          depends_on: ["investigate"],
        },
        {
          id: "comms",
          agent_slug: "support-l2",
          action:
            "Rédige le statut public à publier sur Statuspage et le mail aux clients impactés.",
          depends_on: ["investigate"],
        },
      ],
    },
  },
];
