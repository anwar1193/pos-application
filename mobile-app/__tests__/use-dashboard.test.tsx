import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ApiError } from "@/api/client";
import { useDashboard } from "@/hooks/use-dashboard";

const mockGetDashboard = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/api/dashboard", () => ({
  getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    token: "token-1",
    session: { user: { id: "usr_1" } },
    signOut: mockSignOut,
  }),
}));

const payload = {
  user: { name: "Rani" },
  organization: { name: "Demo Store", currency: "IDR", timezone: "Asia/Jakarta" },
  branch: { id: "brn_1", name: "Cabang Utama" },
  dateLabel: "2026-10-27",
  shift: null,
  today: {
    net: 0,
    transactions: 0,
    itemsSold: 0,
    comparison: { grossPercent: null, transactionsPercent: null },
  },
  recentSales: [],
};

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // React Query delivers observer notifications on a timer. Fake timers let
    // waitFor advance them inside act, which is the only place React commits.
    jest.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
          staleTime: 0,
          // useQuery only notifies about properties read during render, and
          // renderHook reads none. Notify on everything so hook state updates.
          notifyOnChangeProps: "all",
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads the mobile dashboard with the auth token", async () => {
    mockGetDashboard.mockResolvedValue(payload);

    const { result } = await renderHook(() => useDashboard(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(payload);
    expect(mockGetDashboard).toHaveBeenCalledWith("token-1");
  });

  it("scopes the cached dashboard to the signed-in user", async () => {
    mockGetDashboard.mockResolvedValue(payload);

    const { result } = await renderHook(() => useDashboard(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(["mobile-dashboard", "usr_1"])).toBeDefined();
  });

  it("signs out when the session has expired", async () => {
    mockGetDashboard.mockRejectedValue(
      new ApiError("Sesi Anda berakhir.", {
        code: "AUTH_SESSION_EXPIRED",
        status: 401,
      }),
    );

    const { result } = await renderHook(() => useDashboard(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
