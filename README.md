# Axion (Axiyon) — L'OS de l'entreprise autonome

> 🟢 **LIVE** : https://axiyon-nine.vercel.app
>
> Application Next.js 15 production-ready. Postgres + Auth + Agents IA réels.
> `git push` → déploiement automatique sur Vercel.

## Activer les agents IA

L'app fonctionne déjà (signup, login, dashboard, admin, recrutement d'agents, audit chaîné).
Pour faire **tourner** les agents (run, chat streaming), ajoute une clé LLM :

1. Va sur https://vercel.com → projet **axiyon** → **Settings → Environment Variables**
2. Ajoute :
   - `ANTHROPIC_API_KEY` = ta clé Anthropic, **ou**
   - `OPENAI_API_KEY` = ta clé OpenAI
3. **Redeploy** (ou attends le prochain push).

Sans clé, l'API `/api/agents/[id]/run` retourne `error: "No LLM provider configured"` proprement.

## Compte super-admin créé

- **Email** : `sylvainlissanon64@gmail.com`
- **Org** : Pirabel Labs (slug `pirabel-labs`)
- **Rôle** : `owner` + super-admin (accès `/admin`)
- **Mot de passe** : défini lors du premier signup. Si oublié : reset via `DELETE` du user en DB Neon + nouveau signup.



---

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend & API | **Next.js 15** App Router + RSC | Une seule app, zéro frontend détaché |
| Auth | **Auth.js v5** (NextAuth) + Drizzle adapter | JWT stateless, support SSO trivial à ajouter |
| ORM | **Drizzle** + Vercel Postgres / Neon | Type-safe, migrations versionnées |
| IA | **Vercel AI SDK** + Anthropic + OpenAI | Streaming + tools natifs, multi-provider |
| Style | **Tailwind** + shadcn-style components | Cohérent et léger |
| Cron | **Vercel Cron** | Tâches récurrentes sans worker |
| Sécurité | bcryptjs + RBAC 5 niveaux + audit chain SHA-256 | Conformité par défaut |

## Ce qui marche réellement (pas de démo)

- **Inscription / connexion** réelle, mot de passe bcrypt 12 rounds, JWT signé
- **Création automatique d'organisation** au signup (multi-tenant)
- **RBAC 5 niveaux** : `viewer < operator < builder < admin < owner`
- **Recrutement d'agents** depuis le catalogue (8 templates par défaut)
- **Exécution réelle** d'agents via Anthropic Claude ou OpenAI GPT
- **15 outils branchés** : search_leads, send_email, book_meeting, fetch_revenue, calculate_margin, search_logs, search_kb, etc.
- **Chat live multi-agents streaming** (AI SDK `useChat`)
- **Mémoire vectorielle** persistée dans Postgres (cosine similarité)
- **Audit log immuable SHA-256 chaîné** vérifiable d'un clic
- **Console admin** super-admin (orgs, users, system)
- **Cron jobs** (rotation compteurs quotidiens, scheduler workflows)
- **API REST complète** : `/api/agents`, `/api/agents/[id]/run`, `/api/chat`, `/api/auth/signup`

---

## Lancement local

```bash
# 1. Installer les dépendances
pnpm install   # ou: npm install / yarn

# 2. Provisionner Postgres (Vercel Postgres / Neon / local)
cp .env.example .env.local
# éditer POSTGRES_URL, AUTH_SECRET, ANTHROPIC_API_KEY (ou OPENAI_API_KEY)

# 3. Appliquer la migration
pnpm db:migrate

# 4. (Optionnel) seed démo
pnpm db:seed
# → super-admin: founder@axiyon.local / axiyon-demo-2026!

# 5. Lancer le serveur
pnpm dev
# → http://localhost:3000
```

### Sans clé LLM ?
- Marketing, signup, login, recrutement d'agents, audit log : **OK**.
- `agents/[id]/run` et `chat` répondent `503 — No LLM provider configured`.
- Ajoutez **`ANTHROPIC_API_KEY`** ou **`OPENAI_API_KEY`** pour activer l'exécution.

---

## Déploiement Vercel — étape par étape

### A. Première fois

1. **Push le repo sur GitHub** (voir section "Pousser le code" ci-dessous).
2. Sur https://vercel.com, **Import Project** → `pirabellabs1-coder/axiyon`.
3. **Storage** → **Postgres** (Neon) → "Create" — Vercel injecte automatiquement `POSTGRES_URL` + variantes.
4. **Settings → Environment Variables** :
   - `AUTH_SECRET` : `openssl rand -hex 32`
   - `AUTH_URL` : URL prod (ex. `https://axiyon.vercel.app`)
   - `AUTH_TRUST_HOST` : `true`
   - `ANTHROPIC_API_KEY` (ou `OPENAI_API_KEY`)
   - `SUPER_ADMIN_EMAIL` : ton email — ce compte recevra le flag superuser au signup.
   - `CRON_SECRET` : `openssl rand -hex 32` (Vercel l'utilise pour signer les requêtes cron).
5. **Deploy**.
6. Une fois live, exécuter la migration SQL **une fois** :
   - Soit via le dashboard Vercel Postgres → SQL console → coller `lib/db/migrations/0000_initial.sql`.
   - Soit en local : `pnpm db:migrate` (avec le `POSTGRES_URL` Vercel dans `.env.local`).

### B. Mises à jour

```bash
git push origin main   # → Vercel redéploie automatiquement
```

---

## Pousser le code sur GitHub

```bash
cd axion
git init
git branch -M main
git add .
git commit -m "feat: production Axion app — Next.js 15 + Postgres + AI agents"
git remote add origin https://github.com/pirabellabs1-coder/axiyon.git
git push -u origin main
```

Si l'auth GitHub est demandée : génère un Personal Access Token (scope `repo`) ou utilise SSH.

---

## Sécurité

- **`.env.local` est ignoré** par git — ne jamais le committer.
- **Si un token a été partagé publiquement** (Vercel, OpenAI, Anthropic, ...), **révoque-le immédiatement** et regénère.
- **Audit chain** vérifiable en un clic depuis `/dashboard/audit`. Tampering détecté.
- **bcrypt** : 12 rounds.
- **Headers de sécurité** dans `next.config.mjs` (HSTS, X-Frame-Options, etc.).
- **RBAC** appliqué dans toutes les routes API + middleware.

## Structure

```
axion/
├── app/                       # Next.js routes + UI
│   ├── (auth)/                # login + signup
│   ├── admin/                 # super-admin panel (4 pages)
│   ├── dashboard/             # logged-in user space (7 pages)
│   ├── api/                   # REST + cron endpoints (6 routes)
│   ├── agents | pricing | manifesto | product
│   ├── page.tsx               # marketing landing
│   └── layout.tsx
├── lib/
│   ├── db/                    # Drizzle schema + client + migration
│   ├── agents/                # catalog + runtime + tools
│   ├── llm/router.ts          # Anthropic → OpenAI fallback
│   ├── memory/                # vector embed + recall
│   ├── audit.ts               # SHA-256 chained
│   └── utils.ts
├── components/                # UI building blocks
├── auth.ts · middleware.ts
├── drizzle.config.ts · next.config.mjs · tailwind.config.ts · vercel.json
├── scripts/                   # migrate + seed
└── legacy/                    # archived previous build (HTML + Python backend)
```

## Licence

Application : propriétaire (voir `legacy/LICENSE`).
SDKs et CLI archivés (`legacy/sdk`, `legacy/cli`) : MIT.
