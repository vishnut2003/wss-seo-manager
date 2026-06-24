import { Schema, model, models, type Model } from "mongoose";

export type ProjectStatus = "active" | "paused" | "archived";

export interface IProjectMetrics {
  healthScore: number;
  keywords: number;
  organicTraffic: number;
  backlinks: number;
}

export interface IProject {
  name: string;
  domain: string;
  description?: string;
  status: ProjectStatus;
  metrics: IProjectMetrics;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type ProjectModel = Model<IProject>;

const metricsSchema = new Schema<IProjectMetrics>(
  {
    healthScore: { type: Number, default: 0, min: 0, max: 100 },
    keywords: { type: Number, default: 0, min: 0 },
    organicTraffic: { type: Number, default: 0, min: 0 },
    backlinks: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const projectSchema = new Schema<IProject, ProjectModel>(
  {
    name: { type: String, required: true, trim: true },
    domain: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "paused", "archived"],
      default: "active",
    },
    metrics: { type: metricsSchema, default: () => ({}) },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

const Project =
  (models.Project as ProjectModel) ||
  model<IProject, ProjectModel>("Project", projectSchema);

export default Project;
