# Configurer les intégrations tierces

Pour que les agents puissent **vraiment** envoyer des emails Gmail, créer des
événements Google Calendar, passer des appels Twilio, créer des contacts HubSpot,
poster sur Slack, etc., il faut configurer les credentials OAuth ou clés API
de chaque service tiers dans les variables d'environnement Vercel du projet.

## Vue d'ensemble

| Provider | Type | Variables d'env Vercel à ajouter | Tools débloqués |
|---|---|---|---|
| Google (Gmail + Calendar) | OAuth 2.0 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `send_email`, `search_emails`, `book_meeting`, `list_calendar_events` |
| Microsoft 365 (Outlook + Calendar + Teams) | OAuth 2.0 | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `send_email`, `search_emails`, `book_meeting`, `teams_post` |
| HubSpot CRM | OAuth 2.0 | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | `crm_create_contact`, `crm_create_deal`, `crm_search_contact`, `crm_create_note` |
| Salesforce | OAuth 2.0 | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` | `crm_create_contact`, `crm_search_contact`, `crm_create_deal` |
| Slack | OAuth 2.0 | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `slack_post`, `slack_list_channels`, `slack_dm` |
| GitHub | OAuth 2.0 | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `github_create_issue`, `github_list_prs`, `github_dispatch_workflow` |
| Notion | OAuth 2.0 | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` | `notion_create_page`, `notion_search` |
| LinkedIn | OAuth 2.0 | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | (pour future API) |
| Twilio (appels + SMS) | API key | (à entrer dans la UI directement par l'utilisateur) | `make_phone_call`, `send_sms`, `list_phone_numbers` |
| Stripe | API key | (à entrer dans la UI directement) | `stripe_create_invoice`, `stripe_create_customer`, `stripe_list_charges` |
| SendGrid | API key | (UI) | `send_email` (fallback transactionnel) |
| Apollo.io | API key | (UI) | `search_leads`, `enrich_lead`, `search_candidates` |

**Toutes les redirect URIs OAuth** doivent pointer vers :

```
https://axiyon-nine.vercel.app/api/integrations/<provider>/callback
```

(remplacer `<provider>` par `google`, `microsoft`, `hubspot`, etc.)

## Étape par étape — Google (Gmail + Calendar)

C'est le provider le plus important pour faire travailler les agents commerciaux.

### 1. Créer le projet OAuth Google

1. Va sur https://console.cloud.google.com/apis/credentials
2. Crée un projet "Axiyon" si nécessaire
3. **APIs & Services → Library** : active **Gmail API**, **Google Calendar API**, et **Google People API**
4. **APIs & Services → OAuth consent screen** :
   - Type d'utilisateur : **External**
   - Nom de l'app : `Axiyon`
   - Email de support : ton email
   - Scopes : ajoute
     - `.../auth/gmail.send`
     - `.../auth/gmail.readonly`
     - `.../auth/calendar.events`
     - `email`, `profile`, `openid`
   - Test users : ajoute ton email pour pouvoir tester en mode "Testing"

### 2. Créer les credentials OAuth

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Type : **Web application**
3. Nom : `Axiyon Production`
4. **Authorized redirect URIs** : ajoute exactement :

   ```
   https://axiyon-nine.vercel.app/api/integrations/google/callback
   ```

5. Note le **Client ID** et **Client secret**

### 3. Ajouter dans Vercel

```bash
# Via le dashboard Vercel : Settings → Environment Variables
GOOGLE_CLIENT_ID=<ton-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<ton-client-secret>
```

Targets : production + preview + development (les trois).

Redéploie le projet (ou push n'importe quel commit) pour que les nouvelles
variables soient disponibles au runtime.

### 4. Connecter ton compte

1. Va sur https://axiyon-nine.vercel.app/dashboard/integrations
2. Clique **Connecter** sur la carte Google
3. Tu es redirigé vers Google → autorise → tu reviens sur le dashboard
4. La carte montre maintenant ton email + bouton **Déconnecter**

## Twilio (appels + SMS)

Twilio est la pièce qui rend les agents capables de **passer de vrais appels**.

1. Crée un compte sur https://www.twilio.com/console
2. Récupère :
   - **Account SID** (commence par `AC...`)
   - **Auth Token**
   - Achète un numéro émetteur (>1€/mois) et note-le au format E.164 (ex `+33...`)
3. Dans le dashboard Axiyon : **Intégrations → Twilio → Connecter**
4. Colle les trois valeurs. Axiyon vérifie les credentials avec un appel à
   l'API Twilio avant de les chiffrer et stocker.

Note : tout appel passé par un agent passe par la **file d'approbation**
(`/dashboard/approvals`). Tu valides ou rejettes en un clic.

## Microsoft 365

1. https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**
2. Name : `Axiyon`
3. Supported account types : **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI : Web → `https://axiyon-nine.vercel.app/api/integrations/microsoft/callback`
5. Une fois créée :
   - **Certificates & secrets → New client secret** → note la valeur (visible une seule fois)
   - **API permissions → Add permission → Microsoft Graph → Delegated** :
     `User.Read`, `Mail.Send`, `Mail.Read`, `Calendars.ReadWrite`, `ChannelMessage.Send`, `offline_access`
   - Clique **Grant admin consent**
6. Vercel env vars :
   ```
   MICROSOFT_CLIENT_ID=<application id>
   MICROSOFT_CLIENT_SECRET=<secret value>
   ```

## HubSpot

1. https://developers.hubspot.com/ → Apps → Create app
2. Auth → Redirect URL : `https://axiyon-nine.vercel.app/api/integrations/hubspot/callback`
3. Scopes : `crm.objects.contacts.write`, `crm.objects.contacts.read`, `crm.objects.deals.write`, `crm.objects.deals.read`, `tickets`
4. Vercel env vars :
   ```
   HUBSPOT_CLIENT_ID=<id>
   HUBSPOT_CLIENT_SECRET=<secret>
   ```

## Slack

1. https://api.slack.com/apps → Create New App → From scratch
2. OAuth & Permissions → Redirect URLs : `https://axiyon-nine.vercel.app/api/integrations/slack/callback`
3. Bot Token Scopes : `chat:write`, `channels:read`, `groups:read`, `im:write`, `users:read`
4. Vercel env vars :
   ```
   SLACK_CLIENT_ID=<id>
   SLACK_CLIENT_SECRET=<secret>
   ```

## GitHub

1. https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Application name : `Axiyon`
3. Homepage URL : `https://axiyon-nine.vercel.app`
4. Authorization callback URL : `https://axiyon-nine.vercel.app/api/integrations/github/callback`
5. Vercel env vars :
   ```
   GITHUB_CLIENT_ID=<id>
   GITHUB_CLIENT_SECRET=<secret>
   ```

## Notion

1. https://www.notion.so/my-integrations → New integration → Public integration
2. Redirect URI : `https://axiyon-nine.vercel.app/api/integrations/notion/callback`
3. Capabilities : Read, Update, Insert content
4. Vercel env vars :
   ```
   NOTION_CLIENT_ID=<id>
   NOTION_CLIENT_SECRET=<secret>
   ```

## Stripe / SendGrid / Apollo

Pas d'OAuth — directement via la UI :

1. **Stripe** : https://dashboard.stripe.com/apikeys → copie ta clé secrète
2. **SendGrid** : https://app.sendgrid.com/settings/api_keys → crée une API key
3. **Apollo** : https://app.apollo.io/settings/integrations/api → copie ta clé

Puis colle-les dans `/dashboard/integrations` côté UI.

## Ce qu'il se passe quand un agent utilise un outil

1. L'utilisateur demande une tâche à un agent (ex : Iris → "envoie un mail à
   tous les leads qualifiés du Q1").
2. L'agent (Claude/GPT via OpenAI/Anthropic) décide d'appeler `send_email`.
3. Le runtime (`lib/agents/runtime.ts`) reçoit le tool call.
4. Le tool `send_email` essaie en cascade :
   - Gmail (si Google connecté pour cette org) → vrai email envoyé
   - Outlook (si Microsoft connecté)
   - SendGrid (si clé API stockée)
   - Sinon mode preview
5. Le résultat est journalisé (table `tasks` + audit chain SHA-256).
6. Si l'action est sensible (appel téléphonique, SMS, facture > 100€), l'agent
   crée d'abord une **demande d'approbation** dans `/dashboard/approvals` et
   attend le clic humain avant d'exécuter.

## Sécurité

- **Tous les tokens OAuth sont chiffrés** AES-256-GCM avec `AXION_ENCRYPTION_KEY`
  (32 bytes, généré aléatoirement, stocké dans Vercel encrypted env).
- **Refresh token automatique** quand l'access token expire dans <60 s.
- **Auto-révocation** sur déconnexion : la ligne est supprimée de la DB.
- **Audit log immuable** chaîné en SHA-256 trace chaque connexion / déconnexion /
  utilisation par un agent.
- **Approbations à seuil** : aucun appel téléphonique ni SMS sans clic humain.
  Configurable par action dans `lib/approvals.ts`.
