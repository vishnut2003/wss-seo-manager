import { Schema, model, models, type Model } from "mongoose";
import {
  CONNECTION_PROVIDERS,
  type ConnectionProvider,
} from "@/models/Connection";

/**
 * Per-project notification settings (e.g. the daily/monthly summary email).
 * Generic over `type` so each summary cadence is one document per project.
 */
export type NotificationType = "daily-summary" | "monthly-summary";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "daily-summary",
  "monthly-summary",
];

export interface INotificationSetting {
  projectId: string;
  type: NotificationType;
  enabled: boolean;
  recipients: string[];
  enabledConnectors: ConnectionProvider[];
  lastSentAt?: Date;
  lastStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

type NotificationSettingModel = Model<INotificationSetting>;

const notificationSettingSchema = new Schema<
  INotificationSetting,
  NotificationSettingModel
>(
  {
    projectId: { type: String, required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    enabled: { type: Boolean, default: false },
    recipients: { type: [String], default: [] },
    enabledConnectors: {
      type: [String],
      enum: CONNECTION_PROVIDERS,
      default: [],
    },
    lastSentAt: { type: Date },
    lastStatus: { type: String },
  },
  { timestamps: true }
);

// One settings document per type per project.
notificationSettingSchema.index({ projectId: 1, type: 1 }, { unique: true });

const NotificationSetting =
  (models.NotificationSetting as NotificationSettingModel) ||
  model<INotificationSetting, NotificationSettingModel>(
    "NotificationSetting",
    notificationSettingSchema
  );

export default NotificationSetting;
