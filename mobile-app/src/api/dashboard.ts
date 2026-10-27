import { apiRequest } from "./client";
import type { DashboardPayload } from "./types";

export function getDashboard(token: string) {
  return apiRequest<DashboardPayload>("/api/mobile/dashboard", { token });
}
