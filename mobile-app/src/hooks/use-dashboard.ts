import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getDashboard } from "@/api/dashboard";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";

export function useDashboard() {
  const { token, session, signOut } = useAuth();
  const userId = session?.user.id ?? null;

  const query = useQuery({
    // Scoped to the signed-in user so a new session never reads the previous
    // cashier's cached dashboard.
    queryKey: ["mobile-dashboard", userId],
    queryFn: () => getDashboard(token as string),
    enabled: Boolean(token && userId),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
  });

  const error = query.error;
  useEffect(() => {
    if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
      void signOut();
    }
  }, [error, signOut]);

  return query;
}
