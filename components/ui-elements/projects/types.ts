export type ProjectStatus = "active" | "paused" | "archived";

export interface ProjectView {
  id: string;
  name: string;
  domain: string;
  description?: string;
  status: ProjectStatus;
  metrics: {
    healthScore: number;
    keywords: number;
    organicTraffic: number;
    backlinks: number;
  };
  updatedAt: string;
  createdAt: string;
}
