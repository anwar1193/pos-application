import { apiRequest } from "./client";
import type { LoginPayload, LogoutPayload, SessionPayload } from "./types";

export function login(email: string, password: string, deviceName?: string) {
  return apiRequest<LoginPayload>("/api/mobile/auth/login", {
    method: "POST",
    body: { email, password, deviceName },
  });
}

export function getSession(token: string) {
  return apiRequest<SessionPayload>("/api/mobile/auth/session", { token });
}

export function logout(token: string) {
  return apiRequest<LogoutPayload>("/api/mobile/auth/logout", {
    method: "POST",
    token,
  });
}
