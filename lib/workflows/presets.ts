/**
 * Workflows pré-configurés.
 *
 * Chargés au premier accès à /dashboard/workflows si la table est vide pour
 * cette org. Ils servent d'exemples exécutables des enchaînements les plus
 * courants — chaque étape référence un agent réel du catalogue.
 *
 * `schedule_cron` est en UTC, 5 champs (voir lib/workflows/cron.ts). Un preset
 * sans planification se déclenche à la demande ou par webhook.
 *
 * Deux prérequis pour qu'un preset planifié tourne réellement :
 *   1. le workflow doit être **publié** — le balayeur ignore les brouillons ;
 *   2. chaque agent référencé doit être **recruté** dans l'organisation, car
 *      l'exécution serveur attribue le coût et l'audit à une instance réelle.
 */
import type { WorkflowSpec } from "./types";

export interface WorkflowPreset {
  slug: string;
  spec: WorkflowSpec;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    slug: "prospection-hebdo",
    spec: {
      name: "Prospection hebdomadaire",
      description:
        "Cherche de nouveaux prospects, les contacte par email, puis consigne tout dans le CRM. Chaque lundi à 8 h UTC.",
      schedule_cron: "0 8 * * 1",
      steps: [
        {
          id: "recherche",
          agent_slug: "recherche-clients",
          action:
            "Identifie 30 prospects correspondant à la cible de l'organisation. Vérifie chaque société sur son site avant de la retenir, et écarte celles qui ne correspondent plus. Renvoie un tableau : entreprise, contact, rôle, raison de la pertinence, source.",
          depends_on: [],
        },
        {
          id: "contact",
          agent_slug: "prospection-email",
          action:
            "Pour chaque prospect retenu, rédige un email personnalisé à partir d'un fait vérifié sur son entreprise, puis envoie-le. Si un prospect répond favorablement, propose un créneau.",
          depends_on: ["recherche"],
        },
        {
          id: "crm",
          agent_slug: "crm",
          action:
            "Enregistre les prospects contactés dans le CRM en vérifiant d'abord les doublons, et consigne l'email envoyé en note sur chaque contact.",
          depends_on: ["contact"],
        },
      ],
    },
  },
  {
    slug: "veille-hebdo",
    spec: {
      name: "Veille concurrentielle hebdomadaire",
      description:
        "Surveille les concurrents, détecte ce qui a changé depuis la semaine dernière et en fait une synthèse. Chaque lundi à 6 h UTC.",
      schedule_cron: "0 6 * * 1",
      steps: [
        {
          id: "veille",
          agent_slug: "veille-concurrence",
          action:
            "Relève l'état actuel des concurrents suivis : tarifs, positionnement, annonces, offres d'emploi. Compare avec l'état enregistré la semaine précédente et ne retiens que les changements réels — ignore les modifications purement graphiques.",
          depends_on: [],
        },
        {
          id: "synthese",
          agent_slug: "reporting",
          action:
            "Rédige une synthèse des changements détectés. Pour chacun, indique la conséquence concrète pour l'organisation. Commence par la conclusion.",
          depends_on: ["veille"],
        },
      ],
    },
  },
  {
    slug: "audit-site-et-contenu",
    spec: {
      name: "Audit de site et plan de contenu",
      description:
        "Audite un site page par page, puis transforme les manques détectés en plan éditorial SEO. À lancer à la demande sur un site donné.",
      steps: [
        {
          id: "audit",
          agent_slug: "analyse-site",
          action:
            "Audite le site fourni en entrée : clarté de la proposition, structure, SEO, parcours de conversion. Livre un tableau priorisé par impact, avec une URL précise par constat.",
          depends_on: [],
        },
        {
          id: "plan-contenu",
          agent_slug: "redacteur-seo",
          action:
            "À partir des manques de contenu relevés dans l'audit, propose un plan éditorial de 8 articles. Pour chacun : mot-clé visé, intention de recherche, angle qui n'est pas déjà couvert par les pages les mieux classées.",
          depends_on: ["audit"],
        },
      ],
    },
  },
  {
    slug: "relances-impayes",
    spec: {
      name: "Relance des impayés",
      description:
        "Vérifie les paiements reçus, puis relance uniquement les factures réellement en retard, avec une escalade progressive. Chaque jour à 9 h UTC.",
      schedule_cron: "0 9 * * *",
      steps: [
        {
          id: "relances",
          agent_slug: "facturation",
          action:
            "Liste les paiements encaissés récemment, puis identifie les factures encore impayées et leur retard. Relance chaque client en retard avec un ton proportionné à l'ancienneté de la créance. Ne relance jamais un client dont le paiement apparaît déjà encaissé.",
          depends_on: [],
        },
      ],
    },
  },
  {
    slug: "traitement-boite-mail",
    spec: {
      name: "Traitement de la boîte mail",
      description:
        "Trie la boîte mail, répond à ce qui peut l'être et transmet le reste au support. En semaine, toutes les heures de 7 h à 18 h UTC.",
      schedule_cron: "0 7-18 * * 1-5",
      steps: [
        {
          id: "tri",
          agent_slug: "gestion-email",
          action:
            "Récupère les messages non traités, classe-les par urgence, réponds à ceux qui relèvent de ton périmètre et programme les rendez-vous demandés. Signale sans y répondre tout message portant sur un engagement financier ou contractuel.",
          depends_on: [],
        },
        {
          id: "support",
          agent_slug: "support-client",
          action:
            "Traite les demandes transmises par l'étape précédente : cherche la réponse dans la base de connaissances avant de rédiger, et ouvre un ticket pour tout bug reproductible.",
          depends_on: ["tri"],
        },
      ],
    },
  },
];
