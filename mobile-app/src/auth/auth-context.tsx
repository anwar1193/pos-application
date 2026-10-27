import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/api/client";
import { getSession, login as apiLogin, logout as apiLogout } from "@/api/auth";
import type { SessionPayload } from "@/api/types";
import { clearStoredToken, getStoredToken, storeToken } from "./token-store";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type SignInInput = {
  email: string;
  password: string;
  remember: boolean;
};

type AuthState = {
  status: AuthStatus;
  session: SessionPayload | null;
  token: string | null;
};

type AuthContextValue = AuthState & {
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
    token: null,
  });

  useEffect(() => {
    let active = true;

    async function restore() {
      const token = await getStoredToken();
      if (!token) {
        if (active) setState({ status: "unauthenticated", session: null, token: null });
        return;
      }

      try {
        const session = await getSession(token);
        if (active) setState({ status: "authenticated", session, token });
      } catch (error) {
        // Only an explicit auth rejection invalidates the saved token. A
        // network failure must not erase a terminal the user chose to remember.
        if (error instanceof ApiError && error.status === 401) {
          await clearStoredToken();
        }
        if (active) setState({ status: "unauthenticated", session: null, token: null });
      }
    }

    void restore();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async ({ email, password, remember }: SignInInput) => {
    const result = await apiLogin(email, password);
    await storeToken(result.token, remember);
    const session: SessionPayload = {
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      permissions: result.permissions,
    };
    setState({ status: "authenticated", session, token: result.token });
  }, []);

  const signOut = useCallback(async () => {
    const token = state.token ?? (await getStoredToken());
    setState({ status: "unauthenticated", session: null, token: null });
    await clearStoredToken();
    if (token) {
      try {
        await apiLogout(token);
      } catch {
        // A failed revoke must not trap the user in the app.
      }
    }
  }, [state.token]);

  const value = useMemo(
    () => ({ ...state, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
