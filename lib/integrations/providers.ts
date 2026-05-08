/**
 * Provider catalog — declares every third-party service Axion can connect to.
 *
 * For OAuth providers: declares authorize URL, token URL, scopes, and how to
 * extract the user's account info from the API after the token exchange.
 * For API-key providers (Twilio, OpenAI, ...): declares the credentials shape.
 */
import type { LucideIcon } from "lucide-react";
import {
  Mail,
  Calendar,
  Phone,
  MessagesSquare,
  Briefcase,
  Github,
  FileText,
  CreditCard,
  Cloud,
  Linkedin,
  Building2,
  Users,
} from "lucide-react";

export type OauthFlow = {
  type: "oauth2";
  authorizeUrl: string;
  tokenUrl: string;
  /** Default scopes to request. */
  scopes: string[];
  /** Where to fetch the user's profile after exchange (for accountId/email). */
  profileUrl?: string;
  /** Header to send when calling profileUrl: 'Bearer <access_token>' */
  profileAuth?: "bearer" | "basic";
  /** Maps the provider's profile JSON → axion's accountId/email/name. */
  profileMap?: (json: Record<string, unknown>) => {
    accountId?: string;
    accountEmail?: string;
    accountName?: string;
  };
  /** Whether to include `prompt=consent` and `access_type=offline` for refresh tokens. */
  forceRefresh?: boolean;
  /** Extra params to append to authorize URL. */
  authorizeExtraParams?: Record<string, string>;
};

export type ApiKeyFlow = {
  type: "api_key";
  fields: Array<{ name: string; label: string; secret: boolean; placeholder?: string }>;
  /** Optional verifier hit at connect time. Throws on bad creds. */
  verifyUrl?: string;
};

export interface ProviderDef {
  /** Stable slug stored in DB (e.g. 'google'). */
  slug: string;
  /** Display name. */
  name: string;
  /** What this connection enables. */
  description: string;
  category: "email" | "calendar" | "voice" | "messaging" | "crm" | "docs" | "code" | "payments" | "social";
  icon: LucideIcon;
  flow: OauthFlow | ApiKeyFlow;
  /** Tools (by name in lib/agents/tools.ts) that become real once connected. */
  unlocksTools: string[];
}

export const PROVIDERS: Record<string, ProviderDef> = {
  google: {
    slug: "google",
    name: "Google (Gmail + Agenda)",
    description: "Envoyer des emails Gmail, lire la boîte, créer des événements Agenda.",
    category: "email",
    icon: Mail,
    unlocksTools: ["gmail_send", "gmail_search", "calendar_book", "calendar_list"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: (j.sub as string) ?? (j.email as string),
        accountEmail: j.email as string | undefined,
        accountName: (j.name as string) ?? (j.email as string),
      }),
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
      forceRefresh: true,
      authorizeExtraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  },

  microsoft: {
    slug: "microsoft",
    name: "Microsoft 365 (Outlook + Agenda + Teams)",
    description: "Envoyer des emails Outlook, créer des événements, poster dans Teams.",
    category: "email",
    icon: Mail,
    unlocksTools: ["outlook_send", "outlook_search", "ms_calendar_book", "teams_post"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      profileUrl: "https://graph.microsoft.com/v1.0/me",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: j.id as string,
        accountEmail: (j.mail as string) ?? (j.userPrincipalName as string),
        accountName: (j.displayName as string) ?? (j.mail as string),
      }),
      scopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "User.Read",
        "Mail.Send",
        "Mail.Read",
        "Calendars.ReadWrite",
        "ChannelMessage.Send",
      ],
      forceRefresh: true,
    },
  },

  hubspot: {
    slug: "hubspot",
    name: "HubSpot CRM",
    description: "Créer des contacts, deals, tickets dans HubSpot.",
    category: "crm",
    icon: Briefcase,
    unlocksTools: [
      "hubspot_create_contact",
      "hubspot_create_deal",
      "hubspot_search_contact",
      "hubspot_create_note",
    ],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      profileUrl: "https://api.hubapi.com/oauth/v1/access-tokens",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: String(j.hub_id ?? j.user_id ?? "unknown"),
        accountEmail: j.user as string | undefined,
        accountName: (j.hub_domain as string) ?? (j.user as string),
      }),
      scopes: ["crm.objects.contacts.write", "crm.objects.contacts.read", "crm.objects.deals.write", "crm.objects.deals.read", "tickets"],
      forceRefresh: true,
    },
  },

  salesforce: {
    slug: "salesforce",
    name: "Salesforce",
    description: "Créer des leads, opportunités, comptes dans Salesforce.",
    category: "crm",
    icon: Building2,
    unlocksTools: ["sfdc_create_lead", "sfdc_search_account", "sfdc_create_opportunity"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://login.salesforce.com/services/oauth2/authorize",
      tokenUrl: "https://login.salesforce.com/services/oauth2/token",
      profileUrl: "https://login.salesforce.com/services/oauth2/userinfo",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: j.user_id as string,
        accountEmail: j.email as string | undefined,
        accountName: (j.name as string) ?? (j.email as string),
      }),
      scopes: ["api", "refresh_token", "openid", "email", "profile"],
      forceRefresh: true,
    },
  },

  slack: {
    slug: "slack",
    name: "Slack",
    description: "Poster des messages, notifier des canaux, ouvrir des DMs.",
    category: "messaging",
    icon: MessagesSquare,
    unlocksTools: ["slack_post_message", "slack_list_channels", "slack_send_dm"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      profileUrl: "https://slack.com/api/auth.test",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: j.team_id as string | undefined,
        accountEmail: undefined,
        accountName: (j.team as string) ?? (j.user as string),
      }),
      scopes: ["chat:write", "channels:read", "groups:read", "im:write", "users:read"],
    },
  },

  github: {
    slug: "github",
    name: "GitHub",
    description: "Créer des issues, lister les PRs, déclencher des workflows.",
    category: "code",
    icon: Github,
    unlocksTools: ["github_create_issue", "github_list_prs", "github_dispatch_workflow"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      profileUrl: "https://api.github.com/user",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: String(j.id ?? j.login ?? "unknown"),
        accountEmail: j.email as string | undefined,
        accountName: (j.name as string) ?? (j.login as string),
      }),
      scopes: ["repo", "read:org"],
    },
  },

  notion: {
    slug: "notion",
    name: "Notion",
    description: "Créer / mettre à jour des pages et bases de données Notion.",
    category: "docs",
    icon: FileText,
    unlocksTools: ["notion_create_page", "notion_search", "notion_update_page"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      profileUrl: "https://api.notion.com/v1/users/me",
      profileAuth: "bearer",
      profileMap: (j) => {
        const bot = (j.bot ?? {}) as { workspace_name?: string };
        return {
          accountId: j.id as string | undefined,
          accountEmail: undefined,
          accountName: bot.workspace_name ?? (j.name as string) ?? "Notion workspace",
        };
      },
      scopes: [],
      authorizeExtraParams: { owner: "user" },
    },
  },

  linkedin: {
    slug: "linkedin",
    name: "LinkedIn",
    description: "Lire le profil + publier sur le feed.",
    category: "social",
    icon: Linkedin,
    unlocksTools: ["linkedin_post"],
    flow: {
      type: "oauth2",
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      profileUrl: "https://api.linkedin.com/v2/userinfo",
      profileAuth: "bearer",
      profileMap: (j) => ({
        accountId: j.sub as string,
        accountEmail: j.email as string | undefined,
        accountName: (j.name as string) ?? (j.email as string),
      }),
      scopes: ["openid", "profile", "email", "w_member_social"],
    },
  },

  // ─── API-key providers (no OAuth dance) ──────────────────────────

  twilio: {
    slug: "twilio",
    name: "Twilio (appels + SMS)",
    description: "Passer des appels téléphoniques réels, envoyer des SMS, recevoir des numéros.",
    category: "voice",
    icon: Phone,
    unlocksTools: ["twilio_call", "twilio_sms", "twilio_list_numbers"],
    flow: {
      type: "api_key",
      fields: [
        { name: "account_sid", label: "Account SID", secret: false, placeholder: "AC..." },
        { name: "auth_token", label: "Auth Token", secret: true },
        { name: "from_number", label: "Numéro émetteur (E.164)", secret: false, placeholder: "+33..." },
      ],
      verifyUrl: "https://api.twilio.com/2010-04-01/Accounts/{account_sid}.json",
    },
  },

  stripe: {
    slug: "stripe",
    name: "Stripe",
    description: "Créer des factures, charger des cartes, lire les paiements.",
    category: "payments",
    icon: CreditCard,
    unlocksTools: ["stripe_create_invoice", "stripe_list_charges", "stripe_create_customer"],
    flow: {
      type: "api_key",
      fields: [
        { name: "secret_key", label: "Clé secrète Stripe", secret: true, placeholder: "sk_live_..." },
      ],
      verifyUrl: "https://api.stripe.com/v1/account",
    },
  },

  sendgrid: {
    slug: "sendgrid",
    name: "SendGrid (email transactionnel)",
    description: "Envoyer des emails transactionnels (relances, notifications) en masse.",
    category: "email",
    icon: Mail,
    unlocksTools: ["sendgrid_send"],
    flow: {
      type: "api_key",
      fields: [
        { name: "api_key", label: "Clé API SendGrid", secret: true, placeholder: "SG..." },
        { name: "from_email", label: "Adresse expéditeur (vérifiée)", secret: false },
        { name: "from_name", label: "Nom expéditeur", secret: false },
      ],
    },
  },

  apollo: {
    slug: "apollo",
    name: "Apollo.io (sourcing prospects)",
    description: "Recherche réelle de prospects B2B + enrichissement.",
    category: "crm",
    icon: Users,
    unlocksTools: ["apollo_search_people", "apollo_enrich_person"],
    flow: {
      type: "api_key",
      fields: [{ name: "api_key", label: "Clé API Apollo", secret: true }],
    },
  },

  cloud: {
    slug: "cloud",
    name: "Stockage S3-compatible",
    description: "Lire / écrire des fichiers dans un bucket S3 (AWS, R2, Backblaze).",
    category: "docs",
    icon: Cloud,
    unlocksTools: ["s3_put", "s3_get", "s3_list"],
    flow: {
      type: "api_key",
      fields: [
        { name: "endpoint", label: "Endpoint", secret: false, placeholder: "https://s3.eu-west-3.amazonaws.com" },
        { name: "region", label: "Région", secret: false, placeholder: "eu-west-3" },
        { name: "bucket", label: "Bucket", secret: false },
        { name: "access_key_id", label: "Access Key ID", secret: false },
        { name: "secret_access_key", label: "Secret Access Key", secret: true },
      ],
    },
  },
};

export const PROVIDER_LIST: ProviderDef[] = Object.values(PROVIDERS);

export function getProvider(slug: string): ProviderDef | undefined {
  return PROVIDERS[slug];
}

const CATEGORY_LABEL: Record<ProviderDef["category"], string> = {
  email: "Email",
  calendar: "Agenda",
  voice: "Voix",
  messaging: "Messagerie",
  crm: "CRM",
  docs: "Documents",
  code: "Code",
  payments: "Paiements",
  social: "Réseaux sociaux",
};

export function categoryLabel(c: ProviderDef["category"]): string {
  return CATEGORY_LABEL[c];
}
