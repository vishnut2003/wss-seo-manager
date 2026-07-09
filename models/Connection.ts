import { Schema, model, models, type Model } from "mongoose";

/**
 * Third-party data-source connections, scoped per project. Generic on
 * `provider` so future connectors (Google Analytics, Semrush, …) can reuse
 * the same collection. Tokens are stored encrypted at rest (see `lib/crypto`).
 */
export type ConnectionProvider =
  | "google-search-console"
  | "google-analytics"
  | "windsor";

export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  "google-search-console",
  "google-analytics",
  "windsor",
];

/** Providers that authenticate with an app-wide API key rather than OAuth. */
export function isApiKeyProvider(provider: ConnectionProvider): boolean {
  return provider === "windsor";
}

/** One Windsor.ai account attached to a project (a project can attach many). */
export interface WindsorAccountSelection {
  /** Catalog source slug, e.g. `google_ads` or `searchconsole`. */
  source: string;
  /** Windsor account id, e.g. `283-440-7445` or a GSC site URL. */
  accountId: string;
  /** Display name when Windsor provides one. */
  accountName?: string;
  /** Per-account metric selection; defaults to the source's full set. */
  fields?: string[];
}

export interface IConnection {
  projectId: string;
  provider: ConnectionProvider;
  accountEmail: string;
  /** AES-256-GCM encrypted. Never expose to the client. */
  accessToken: string;
  /** AES-256-GCM encrypted. Never expose to the client. */
  refreshToken: string;
  /** Access-token expiry (absolute time). */
  expiresAt: Date;
  scope: string;
  /** Selected GSC property, e.g. `sc-domain:example.com` or a URL prefix. */
  siteUrl?: string;
  /** Selected GA4 property, e.g. `properties/123456789`. */
  propertyId?: string;
  /** Windsor.ai accounts attached to this project (across sources). */
  windsorAccounts?: WindsorAccountSelection[];
  /** Email of the user who created the connection. */
  connectedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type ConnectionModel = Model<IConnection>;

/** OAuth token fields are required only for OAuth providers (not Windsor). */
function oauthOnly(this: IConnection): boolean {
  return !isApiKeyProvider(this.provider);
}

const connectionSchema = new Schema<IConnection, ConnectionModel>(
  {
    projectId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: CONNECTION_PROVIDERS,
      required: true,
    },
    accountEmail: { type: String, required: true },
    // OAuth-only fields — not required for API-key providers (e.g. Windsor).
    accessToken: { type: String, required: oauthOnly },
    refreshToken: { type: String, required: oauthOnly },
    expiresAt: { type: Date, required: oauthOnly },
    scope: { type: String, required: oauthOnly },
    siteUrl: { type: String },
    propertyId: { type: String },
    windsorAccounts: {
      type: [
        new Schema<WindsorAccountSelection>(
          {
            source: { type: String, required: true },
            accountId: { type: String, required: true },
            accountName: { type: String },
            fields: { type: [String], default: undefined },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    connectedBy: { type: String, required: true },
  },
  { timestamps: true }
);

// One connection per provider per project.
connectionSchema.index({ projectId: 1, provider: 1 }, { unique: true });

const Connection =
  (models.Connection as ConnectionModel) ||
  model<IConnection, ConnectionModel>("Connection", connectionSchema);

export default Connection;
