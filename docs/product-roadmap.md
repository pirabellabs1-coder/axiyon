# Product Roadmap — Axion

> Document interne · Owner : Théo Martelli (CPO) · Co-owner : Nour Abichou (CTO)
> Date : Mai 2026 · 36 mois

---

## Principes de roadmap

1. **Une release majeure toutes les 6 semaines.** Vélocité non négociable.
2. **Pas de feature sans data.** Chaque feature naît d'un signal client mesuré (NPS, ticket, attrition cohorte).
3. **Toute feature doit pouvoir être désactivée en 1 clic.** Compatibilité régressive obligatoire.
4. **Conformité, sécurité et performance sont des features.** Pas des add-ons.
5. **L'API est la source de vérité.** L'UI consomme l'API publique. Pas de "API privée pour notre web app".

---

## Now → Q3 2026 (next 4 months)

### Theme : "Enterprise-grade by default"

| Feature | Why | Owner | Beta | GA |
|---|---|---|---|---|
| **VPC déployement (AWS, GCP, Azure)** | Top-3 ent. blocker | Joaquim | Mai 2026 | Juil. 2026 |
| **SSO SAML + SCIM** | Required ent. | Joaquim | Mai 2026 | Juin 2026 |
| **Audit log streaming (Datadog, Splunk)** | SOC 2 + IR | Lina | Juin 2026 | Juil. 2026 |
| **Voice clone v2 (sub-150ms latency)** | Echo agent UX | Yuki | Juin 2026 | Aug. 2026 |
| **Workflow versionning (git-style)** | Power user request | Théo | Juil. 2026 | Sept. 2026 |
| **Cost & budget dashboards** | CFO request top-5 | Théo | Aug. 2026 | Sept. 2026 |
| **20 nouveaux agents verticaux** | Catalog expansion | Maxime | rolling | Sept. 2026 |

### Hidden infra deliverables

- Migration mémoire vectorielle vers infra propriétaire (sortie de Pinecone) — économies COGS 4,2 M€/an
- Multi-modèle routing v3 : décision en sub-50ms entre Claude/GPT/Gemini/Mistral/Llama selon coût/latence/qualité
- Compliance dashboard pour les CISOs (controls, evidence, gaps)

---

## Q4 2026 — H1 2027

### Theme : "Custom & vertical"

| Feature | Why |
|---|---|
| **Agent Builder Studio** (no-code) | Permet aux clients de créer leurs propres agents sans dev. Augmente NDR par création de demand interne. |
| **Voice agent native multi-langue (47 langues)** | Doctolib + BlaBlaCar request, EU expansion |
| **Marketplace tier-3rd party agents** | Agents construits par des tiers, listés et monétisés. Network effect. |
| **HIPAA-ready par défaut** (US health vertical) | Unlocks US healthcare cohort |
| **AI Act risk classification system** | Auto-classification des agents par niveau de risque. Conformité native. |
| **MCP (Model Context Protocol) full support** | Standardisation tool ecosystem |
| **Slack-first UX** | Bring agents into existing tools (vs requiring console) |

### Hidden infra

- Edge inference pour les régions sensibles (Indonesia, Saudi Arabia, Brazil)
- Custom fine-tuning pipeline pour agents Enterprise (3 jours de turnaround sur SOPs clients)
- A/B testing platform interne pour les prompts (data-driven prompt engineering)

---

## H2 2027

### Theme : "Autonomous workflows"

| Feature | Why |
|---|---|
| **Goal-oriented agents (no workflow needed)** | Donnez un objectif, l'agent invente son propre workflow. Killer feature pour le mid-market. |
| **Agent memory that compounds** (knowledge sharing across orgs) | Avec opt-in, agents apprennent des patterns inter-clients pour s'améliorer collectively |
| **Autonomous billing/contracts (Stripe + DocuSign chains)** | Codex + Atlas sign deals end-to-end avec budget control |
| **Real-time collaboration** (humans + agents in same Notion/Linear/Figma) | Pas un "outil à part" — invisible dans les outils existants |
| **Agent reputation system** | Scoring par performance, transparence. Permet aux clients de choisir les meilleurs agents par metric |
| **Verticalisation : finance, santé, retail** | 3 SKUs verticaux pour l'Enterprise |

---

## 2028

### Theme : "Beyond knowledge work"

| Feature | Why |
|---|---|
| **Robotic agents** (intégration robotics OEMs) | Étend Axion au monde physique : entrepôts, manufacturing, healthcare |
| **Agent mesh** (cross-org agents collaboration via consent) | Inter-organization workflows (supply chain, partnerships) |
| **Industry-specific compliance packs** | FedRAMP High, NIS2, DORA, CCPA, etc. — preconfigured |
| **Multi-currency, multi-tax, multi-jurisdiction native** | Required pour les groupes internationaux |
| **Disaster recovery automation** | Agents that detect+prevent incidents before they fail |

---

## 2029-2031 (vision)

- **Axion-Tuned** : modèles propriétaires fine-tunés sur 5+ ans de traces d'orchestration. Performance/coût supérieurs aux modèles de base sur des tâches d'agent enterprise.
- **Operating Layer for Embodied AI** : extension aux robots, drones, véhicules autonomes — Axion devient l'OS de l'intelligence opérationnelle.
- **Axion Markets** : marketplace de "skills" achetables/échangeables (un workflow optimisé peut être vendu à d'autres entreprises avec consentement).
- **Sovereign Edition** : déploiement souverain pour gouvernements (FR, DE, IT, ES, JP, IN, BR).

---

## Engineering principles

### Stack

- **Langues principales** : Python (research, data) · TypeScript (web) · Rust (perf-critical infra) · Go (operators K8s)
- **Modèles** : agnostique (Claude, GPT, Gemini, Mistral, Llama). Routing intelligent selon tâche.
- **Infra** : K8s sur AWS/GCP/Azure (multi-cloud par design). Postgres/pg_vector + ClickHouse (analytics) + S3 (replay store).
- **Frontend** : Next.js + Tailwind + shadcn/ui + Tiptap (workflow editor)
- **Observability** : OpenTelemetry + Datadog (interne) + audit-log immuable maison

### SRE targets

| Metric | Target 2026 | Target 2028 |
|---|---|---|
| Uptime API | 99,98% | 99,99% |
| p99 latency (agent action) | < 800ms | < 400ms |
| Voice latency (turn-around) | < 200ms | < 100ms |
| MTTR P0 incidents | < 12 min | < 6 min |
| Time-to-deploy (PR → prod) | < 18 min | < 8 min |

### Security & compliance roadmap

| Mois | Milestone |
|---|---|
| Mai 2026 | SOC 2 Type II audit (en cours) |
| Juil. 2026 | ISO 27001 audit (en cours) |
| Sept. 2026 | HIPAA BAA infrastructure ready |
| Nov. 2026 | AI Act compliance certified (CEN audit) |
| Q1 2027 | FedRAMP Moderate (US gov) |
| Q3 2027 | ISO 27701 (privacy mgmt) |
| Q4 2027 | DORA (EU finance) |
| Q2 2028 | FedRAMP High |

---

## Customer feedback loops

- **Daily standup product** avec rep CSM lisant 5 tickets random
- **Quarterly NPS** segmenté par tier + cohort
- **Monthly customer advisory board** : 8 power-users en rotation
- **Build with us program** : 24 design partners par feature majeure
- **Analytics dashboards** publics interne sur usage, errors, drop-off

---

*Roadmap v3 · Mai 2026*
