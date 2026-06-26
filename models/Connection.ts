import { Schema, model, models, type Model } from "mongoose";

/**
 * Third-party data-source connections, scoped per project. Generic on
 * `provider` so future connectors (Google Analytics, Semrush, …) can reuse
 * the same collection. Tokens are stored encrypted at rest (see `lib/crypto`).
 */
export type ConnectionProvider = "google-search-console";

export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  "google-search-console",
];

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
  /** Email of the user who created the connection. */
  connectedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type ConnectionModel = Model<IConnection>;

const connectionSchema = new Schema<IConnection, ConnectionModel>(
  {
    projectId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: CONNECTION_PROVIDERS,
      required: true,
    },
    accountEmail: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: { type: String, required: true },
    siteUrl: { type: String },
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
