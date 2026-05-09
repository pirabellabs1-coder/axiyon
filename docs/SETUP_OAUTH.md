# Configuration des intégrations OAuth — Axion

Axion utilise OAuth 2.0 pour connecter Gmail, Microsoft 365, Google Calendar, HubSpot, Salesforce, Slack, GitHub, Notion et LinkedIn. Pour chaque service, tu dois créer une application OAuth chez le fournisseur, puis ajouter le `CLIENT_ID` et `CLIENT_SECRET` aux variables d'environnement Vercel.

## URL de callback à configurer chez chaque fournisseur

```
https://axiyon-nine.vercel.app/api/v1/integrations/{provider}/callback
```

Remplace `{provider}` par le slug du provider (`google`, `microsoft`, `hubspot`, `slack`, `github`, `notion`, `linkedin`, `salesforce`).

## Variables d'environnement à ajouter sur Vercel

Pour chaque provider connecté, ajoute deux variables (target = Production) :

| Provider     | Variables                                       |
| ------------ | ----------------------------------------------- |
| Google       | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`      |
| Microsoft    | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`|
| HubSpot      | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`    |
| Slack        | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`        |
| GitHub       | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`      |
| Notion       | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`      |
| LinkedIn     | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`  |
| Salesforce   | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` |

Pour les API key providers (Twilio, Stripe, SendGrid, Apollo) : la console te demandera la clé directement dans `/dashboard/integrations`.

---

## 1. Google Workspace (Gmail + Calendar + Drive)

1. Va sur https://console.cloud.google.com/
2. Crée un nouveau projet (ou réutilise un existant)
3. Active les APIs : **Gmail API**, **Google Calendar API**, **Google Drive API**, **People API**
4. APIs & Services → Credentials → "Create Credentials" → **OAuth client ID**
5. Application type : **Web application**
6. Authorized redirect URI :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/google/callback
   ```
7. Copie `Client ID` et `Client Secret` → Vercel env

---

## 2. Microsoft 365 (Outlook + Teams + OneDrive)

1. Va sur https://portal.azure.com/ → Azure Active Directory → App registrations
2. New registration → nom "Axion"
3. Supported account types : **Accounts in any organizational directory and personal accounts**
4. Redirect URI (Web) :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/microsoft/callback
   ```
5. API permissions → Microsoft Graph → Delegated :
   - `Mail.Send`, `Mail.Read`
   - `Calendars.ReadWrite`
   - `Files.ReadWrite`
   - `Chat.ReadWrite` (Teams)
   - `User.Read`
6. Certificates & secrets → New client secret → copie la valeur (24 mois)
7. Application (client) ID + secret → Vercel env

---

## 3. HubSpot

1. https://app.hubspot.com/developer → Manage apps → Create app
2. Auth → Redirect URL :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/hubspot/callback
   ```
3. Scopes : `crm.objects.contacts.read/write`, `crm.objects.deals.read/write`, `crm.objects.companies.read/write`
4. App info → Client ID / Client Secret → Vercel env

---

## 4. Slack

1. https://api.slack.com/apps → Create New App → From scratch
2. OAuth & Permissions → Redirect URLs :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/slack/callback
   ```
3. Bot Token Scopes : `chat:write`, `channels:read`, `groups:read`, `im:write`, `users:read`
4. Basic Information → Client ID / Client Secret → Vercel env
5. Install App → Install to your workspace

---

## 5. GitHub

1. https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Application name : Axion
3. Homepage URL : `https://axiyon-nine.vercel.app`
4. Authorization callback URL :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/github/callback
   ```
5. Generate a new client secret → Client ID + secret → Vercel env

---

## 6. Notion

1. https://www.notion.so/my-integrations → New integration → Public OAuth integration
2. OAuth Domain & URIs → Redirect URIs :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/notion/callback
   ```
3. Capabilities : Read content, Update content, Insert content
4. OAuth client ID + secret → Vercel env

---

## 7. LinkedIn

1. https://www.linkedin.com/developers/apps → Create app
2. Auth tab → OAuth 2.0 settings → Authorized redirect URLs :
   ```
   https://axiyon-nine.vercel.app/api/v1/integrations/linkedin/callback
   ```
3. Products → request `Sign In with LinkedIn` + `Marketing Developer Platform`
4. Auth → Application credentials → Client ID + secret → Vercel env

---

## 8. Twilio (API Key — pas OAuth)

Dans `/dashboard/integrations` clique sur Twilio puis renseigne directement :
- `Account SID` (commence par `AC...`)
- `Auth Token`

Récupérables sur https://console.twilio.com/

---

## 9. Stripe (API Key)

Dans `/dashboard/integrations` clique sur Stripe puis renseigne :
- `Secret Key` (commence par `sk_live_...`)

Récupérable sur https://dashboard.stripe.com/apikeys

---

## Vérifier qu'une intégration est connectée

Une fois dans `/dashboard/integrations`, clique "Connecter" sur le provider voulu. Tu seras redirigé chez le fournisseur pour autoriser, puis ramené sur Axion. La carte devient verte avec le badge "Connecté".

Les tokens sont **chiffrés AES-256-GCM** avant d'être stockés en base et déchiffrés à la volée pour chaque appel API. Aucun token n'est jamais retourné par l'API d'Axion.
