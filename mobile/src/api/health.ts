import { apiFetch } from "./client";

export type HealthResponse = {
  status: string;
  dbConnected: boolean;
};

// Phase 0's milestone is a real network call succeeding against the local backend, not just a
// build that runs — GET /api/health is the cheapest endpoint that proves the whole path works:
// device → host networking → Express → Prisma → Postgres.
export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}
