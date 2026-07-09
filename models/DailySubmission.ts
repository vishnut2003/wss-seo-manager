import { Schema, model, models, type Model } from "mongoose";

/**
 * A daily update posted by a signed-in user against a project — a free-text
 * note of what they did that day, plus optional file attachments (stored in
 * Vercel Blob; only public URLs are kept here). Append-only: each submission is
 * its own record, attributed to its author. Consumed by the daily-summary
 * email when the project enables "include daily submissions".
 */
export interface ISubmissionAttachment {
  /** Public Blob URL. */
  url: string;
  filename: string;
  contentType: string;
  /** Size in bytes. */
  size: number;
}

export interface IDailySubmission {
  projectId: string;
  /** Email of the user who submitted (app-wide attribution convention). */
  submittedBy: string;
  /** Display name of the submitter, when available. */
  submittedByName?: string;
  body: string;
  attachments: ISubmissionAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

type DailySubmissionModel = Model<IDailySubmission>;

const attachmentSchema = new Schema<ISubmissionAttachment>(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const dailySubmissionSchema = new Schema<
  IDailySubmission,
  DailySubmissionModel
>(
  {
    projectId: { type: String, required: true, index: true },
    submittedBy: { type: String, required: true },
    submittedByName: { type: String },
    body: { type: String, required: true, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true }
);

// Listing + previous-day window queries scope by project, newest first.
dailySubmissionSchema.index({ projectId: 1, createdAt: -1 });

const DailySubmission =
  (models.DailySubmission as DailySubmissionModel) ||
  model<IDailySubmission, DailySubmissionModel>(
    "DailySubmission",
    dailySubmissionSchema
  );

export default DailySubmission;
