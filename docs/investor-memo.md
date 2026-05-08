# Investor Memo — Pourquoi Axion sera valorisée 500 Md$ en 2031

> Document interne · Series A
> Auteur : Maxime Vasseur (CEO) · Mai 2026
> Confidentiel — distribution restreinte

---

## TL;DR (à lire si rien d'autre)

1. **Le marché**. 30 000 Md$ de travail de la connaissance globalement. La couche d'abstraction au-dessus des LLMs (= "OS d'agents d'entreprise") est la nouvelle catégorie tech. Premier mover, premier moat, premier monopole partiel.
2. **Le produit**. Axion vend des **employés**, pas des modèles. C'est la différence entre AWS et un datacenter. Plus simple, plus cher, plus défensible.
3. **La traction**. 18 M€ ARR en 6 mois post-launch. NRR 151%. 96% renewal. Comparables historiques (Stripe, Notion, Datadog) : nous sommes 2-3× plus rapides à ce stade.
4. **L'équipe**. Trois fondateurs avec exits/rôles seniors dans Doctolib, Mistral, Linear. Leadership ex-Datadog, BNP, Stripe, DeepMind. Aucun gap.
5. **La sortie**. À 1,5% du SAM (= 270 Md$ d'ARR de la catégorie en 2031), Axion en capte 17% = 45 Md$. À 11× ARR (multiple historique des leaders SaaS), valorisation : **~500 Md$**.

---

## I. Pourquoi cette catégorie existe (et n'existait pas il y a 18 mois)

### 1.1 Les LLMs ne sont pas des produits

Un LLM est un **moteur** : remarquable, mais sans carrosserie ni siège. En 2024, des milliers d'entreprises ont essayé de "déployer ChatGPT" en interne. Résultat (étude BCG Q1 2026) :

- 67% ont abandonné dans les 6 mois
- 22% ont un usage marginal (Q&A interne)
- **11% seulement ont déployé un agent qui livre un résultat mesurable**

Pourquoi ? Six manques structurels :

1. **Pas de mémoire** persistante entre sessions
2. **Pas de connexion native** aux outils de l'entreprise (CRM, ERP, helpdesk)
3. **Pas de gouvernance** (qui peut faire quoi, avec quel budget)
4. **Pas d'audit** (impossible à passer en revue conformité)
5. **Pas de collaboration** entre agents (mono-bot)
6. **Pas de catalogue** (chaque entreprise réinvente ses prompts)

Un LLM est un *cerveau sans corps*. Axion fournit le corps : sens, muscles, squelette, système nerveux.

### 1.2 Le seuil de fiabilité a été franchi en 2025

GPT-5 (sept. 2025), Claude 4.6 (oct. 2025), Gemini 3 (déc. 2025), Mistral Large-2 (jan. 2026) : la **génération 2025 de modèles** a franchi simultanément trois seuils :

- **Tool-use à 95%+** sur les benchmarks complexes (vs. ~70% en 2024)
- **Raisonnement long** (15-30 étapes) sans dérive
- **Function calling parallèle** avec consistance d'état

Avant 2025, un agent de prod nécessitait 6-12 mois de R&D pour atteindre 80% de fiabilité. **En 2026, on l'atteint en 60 secondes** sur Axion.

### 1.3 La pression réglementaire force la professionnalisation

L'AI Act européen (entrée en vigueur août 2026), GDPR, NIS2, le Cyber Resilience Act, et leurs équivalents US (Executive Orders + state laws CA/NY/IL) imposent que les agents IA soient :
- **Auditables** (chaque décision tracée)
- **Limités en autonomie** (escalade humaine sur risque)
- **Documentés** (model cards, DPIA, risk assessment)

Aucune entreprise sérieuse ne déploiera un agent qui n'est pas conforme. Cette barrière à l'entrée est notre meilleur ami.

---

## II. La thèse à 500 Md$ — décomposition

### 2.1 Le calcul du marché

| Métrique | Valeur | Source |
|---|---|---|
| **Knowledge work mondial (salaires)** | 30 000 Md$/an | ILO 2025 + McKinsey 2026 |
| Part automatisable (60-80% des tâches) | 18 000 Md$/an | BCG/MIT estimates |
| Capture par AI workforce d'ici 2031 | ~5% | nous (estimation conservative) |
| **Marché annuel "AI workforce" en 2031** | **~900 Md$ de salaires absorbés** | dérivé |
| Conversion en revenus SaaS (15% du salaire absorbé) | **~135 Md$ de revenus catégorie** | économie unitaire prouvée |
| Multiple ARR moyen leaders SaaS | 11× | médiane Salesforce/ServiceNow/Datadog 5y |
| **Capitalisation totale catégorie en 2031** | **~1 500 Md$** | dérivé |

Sur cette catégorie, Axion vise **30%** (premier mouvement, marque, intégrations, conformité) :
- Revenu : **~45 Md$ d'ARR**
- Valorisation : **~500 Md$**

C'est ambitieux. Ce n'est pas absurde. Salesforce vaut 350 Md$ aujourd'hui sur un marché plus petit (CRM = ~80 Md$). ServiceNow vaut 170 Md$ sur l'ITSM. Stripe est valorisée 95 Md$ privée sur les paiements. **Axion attaque la couche au-dessus de tout ça.**

### 2.2 Pourquoi nous capturerons une part disproportionnée

Cinq raisons :

**a. Premier mouvement avec produit fini, pas démo**
La fenêtre s'est ouverte début 2025. Nous avons lancé en septembre 2025. À 14 mois post-fondation, nous sommes **le seul acteur multi-agent avec gouvernance native** sur le marché. OpenAI a Operator (single-agent, pas de gouvernance). Anthropic a Claude (modèle, pas plateforme). Nos concurrents directs (Adept, Cognition, AutoGen, Cerebral) sont soit des outils dev soit des chatbots single-purpose.

**b. Network effects à trois niveaux**
- *Marketplace* : plus de clients → plus d'agents demandés → plus de spécialisation → plus de clients
- *Données d'orchestration* : 11 800 agents en prod génèrent ~2 Md de traces/mois → patterns uniques
- *Mémoire d'entreprise* : la donnée client crée un switching cost massif

**c. Conformité = barrière à l'entrée**
SOC 2 Type II + ISO 27001 + HIPAA + AI Act prennent 18-30 mois minimum. Aucun nouvel entrant ne peut nous rattraper sur ce front avant 2028.

**d. Marque de souveraineté européenne**
Le marché EU (8 000 Md$ knowledge work) a une affinité forte pour un acteur EU non-US sur des sujets sensibles (data, IA, conformité). Axion est **le seul vrai challenger européen viable**.

**e. Distribution multi-canal**
- PLG (self-serve) → SMBs
- Sales-led → mid-market et enterprise
- Marketplaces (AWS, GCP, Azure) → procurement-friendly
- Channel partners (Capgemini, Accenture) → grands comptes

### 2.3 Comparables historiques

| Entreprise | Stade | ARR | Valuation | Multiple |
|---|---|---|---|---|
| Salesforce | T+10 | ~5 Md$ | ~50 Md$ | 10× |
| ServiceNow | T+10 | ~3 Md$ | ~25 Md$ | 8× |
| Stripe | T+10 | ~7 Md$ | ~95 Md$ | 14× |
| Datadog | T+10 | ~1 Md$ | ~10 Md$ | 10× |
| **Axion (projection T+10 = 2035)** | T+10 | **45 Md$** | **~500 Md$** | **11×** |

Axion à T+10 doit avoir **6× le revenu de Salesforce à T+10**. Réaliste si :
- AI workforce remplace progressivement ~5% du knowledge work mondial (vs. CRM qui n'a remplacé qu'une fraction du commercial)
- Axion garde une croissance >70% YoY pendant 8 ans (Stripe a tenu cette croissance pendant 12 ans)

---

## III. Pourquoi nous (et pas un autre)

### 3.1 Trois moats qui se renforcent l'un l'autre

```
            DONNÉES D'ORCHESTRATION
                      ↑
         CONFORMITÉ ←──┴──→ MARKETPLACE D'AGENTS
              ↑              ↑
              └─→ MÉMOIRE D'ENTREPRISE ←─┘
```

Chaque pilier renforce les autres :
- Plus de clients = plus de traces = meilleurs agents = plus de clients
- Plus de conformité = plus d'enterprise = plus d'argent = plus de R&D conformité
- Plus d'agents = plus d'intégrations = plus de stickyness = plus de ARPU

### 3.2 Capital efficiency

Comparé à nos pairs sur la même fenêtre temps :

| Entreprise | Capital levé pour 10 M€ ARR |
|---|---|
| OpenAI (équivalent enterprise) | ~3 Md$ |
| Cognition Labs | ~210 M$ |
| Adept | ~415 M$ |
| **Axion** | **42,5 M$** (4,5 pre-seed + 38 M$ série A) |

Nous sommes **5-50× plus capital-efficient** que la moyenne de la catégorie. C'est le signe que nous résolvons un problème vrai, pas que nous nourrissons un fantasme.

### 3.3 L'équipe

| Rôle | Personne | Background pertinent |
|---|---|---|
| CEO | Maxime Vasseur | A construit l'agent IA interne de Doctolib (#5 employé) — déjà vendu un produit similaire à 2 800 utilisateurs internes |
| CTO | Nour Abichou | A travaillé sur les modèles foundation chez Mistral — comprend les modèles de l'intérieur |
| CPO | Théo Martelli | A façonné Linear UX — sait construire des produits magiquement utilisables |

Les trois se connaissent depuis HEC/X-EAU 2017. Pas une équipe de circonstance — une équipe qui a déjà fait 5 ans ensemble dans des side-projets.

---

## IV. Risques (et comment on les gère)

### 4.1 Big Tech entre sur le marché

**Scénario** : OpenAI, Microsoft, ou Google lance une plateforme d'agents enterprise.

**Probabilité** : Élevée. OpenAI a déjà annoncé "Agentic Workforce" pour Q4 2026.

**Notre défense :**
1. **Souveraineté EU** : aucune entreprise européenne sérieuse ne mettra ses données chez OpenAI/MS/Google sur le long terme.
2. **Multi-modèle** : Axion ne dépend d'aucun fournisseur. Nous routons vers Claude, GPT, Gemini, Mistral, Llama selon la tâche. OpenAI ne pourra pas nous concurrencer sur l'agnostique.
3. **Marketplace** : OpenAI vendra ses propres agents. Nous vendons ceux des **développeurs tiers**. Network effect de la longue traîne.
4. **Conformité** : OpenAI a 18 mois pour rattraper notre stack conformité. Nous avons 36 mois d'avance.

### 4.2 Régulation hostile

**Scénario** : L'AI Act est interprété sévèrement, des restrictions massives sur les agents autonomes en EU.

**Notre défense :**
1. Axion est **conçu pour l'AI Act**. C'est notre spec produit, pas notre frein.
2. Lina Bensoussan (CSO) siège au comité de standardisation AI Act au CEN. Insider seat.
3. Notre architecture (audit, escalation, kill-switch) répond aux exigences les plus strictes.

### 4.3 Saturation du marché des agents

**Scénario** : Trop d'acteurs, prix qui s'écrasent, commodification.

**Notre défense :**
1. La complexité enterprise (gouvernance, intégrations, conformité) **n'est pas commoditisable**.
2. Le forfait "par agent" + outcomes nous protège : si les modèles deviennent gratuits, notre valeur (orchestration, mémoire, intégrations) reste.
3. Multi-modèle = nous bénéficions de la baisse des prix d'inférence côté COGS.

### 4.4 Mauvais usage / scandale

**Scénario** : Un client utilise Axion pour de la surveillance, désinformation, manipulation. Scandale presse.

**Notre défense :**
1. **Acceptable Use Policy** stricte, vérifiée à l'onboarding par humain pour Enterprise.
2. **Refus de certains use cases** publiquement assumés (manifesto principe VII).
3. Lina + équipe sécurité dédient 2 FTE à la détection d'usages contraires aux conditions.
4. Insurance produit + RC pro + cellule crisis comm.

### 4.5 Brûlure cash

**Scénario** : Croissance ralentit, la course aux talents fait exploser les coûts.

**Notre défense :**
1. **Path to default-alive Q4 2026** : à brûlure actuelle, atteignable avec 27 M€ ARR (notre projection : 32 M€).
2. **Discipline cap table** : pas de crash spending, rétention 92%, comp packages compétitifs sans exagérer.
3. **Hedge de revenus** : 38% Enterprise (recurring contracts longue durée), 42% Growth (mensuel mais rétention 96%), 20% Solo.

---

## V. Ce qu'on demande

### 5.1 Series A — 38 M$ (closé)

- Valuation : 280 M$ post-money
- Lead : Sequoia (Luciana Lixandru)
- Suivis : Index, Lightspeed, Headline (re-up)
- Conditions : 1× preferred non-participating, board 5 (2 founders, 1 Sequoia, 2 indep), no anti-dilution above weighted avg

### 5.2 Use of funds

| Catégorie | % | Montant | Cible |
|---|---|---|---|
| Engineering & Research | 45% | 17,1 M$ | 80 ingés/researchers · 36 mois |
| Go-to-market | 25% | 9,5 M$ | 60 commerciaux · marketing perf · events |
| Customer Success | 15% | 5,7 M$ | Solutions engineering · CSM Enterprise |
| Sécurité & Conformité | 10% | 3,8 M$ | SOC 2 Type II · ISO 27701 · HIPAA · FedRAMP |
| Réserve M&A | 5% | 1,9 M$ | Acquisitions opportunistes (agents verticaux) |

### 5.3 Milestones 24 mois

| Q | Milestone | Mesurable |
|---|---|---|
| Q3 2026 | Bureau SF opérationnel | 30 personnes US |
| Q4 2026 | 30 M€ ARR | NRR ≥ 140% |
| Q1 2027 | FedRAMP Moderate | Premier deal gouv US |
| Q2 2027 | 60 M€ ARR · default-alive | EBITDA breakeven |
| Q3 2027 | 100 M€ ARR | Series B opportuniste à 2 Md$+ |
| Q4 2027 | Listing AWS, GCP, Azure marketplaces | 30% des deals via marketplaces |

---

## VI. Conclusion

Axion est une thèse simple : **les agents IA sont la prochaine couche d'abstraction logicielle, comme le cloud, comme le mobile, comme l'API REST**. Cette couche aura ses propres champions, ses propres standards, sa propre marque morale.

Nous avons l'équipe, le timing, la traction, les moats, le capital. Il manque l'exécution sur 5 ans. Et c'est le seul risque que nous savons gérer.

Le pari Series A : nous donnez 38 M$, nous vous rendons 35× en 6 ans.
Le pari long : nous construisons une entreprise qui pèse 500 Md$ en 2031.

Si vous trouvez ça absurde, vous avez probablement raison. Si vous trouvez ça inévitable, vous avez probablement aussi raison. C'est notre travail de transformer le second en réalité.

— *Maxime, Nour, Théo*

---

*Investor memo · Mai 2026 · Strictement confidentiel*
