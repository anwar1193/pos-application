import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { DashboardPayload } from "@/api/types";
import DashboardScreen from "../app/(app)/dashboard";

const mockSignOut = jest.fn();
const mockRefetch = jest.fn();
let mockQuery: Record<string, unknown>;

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    status: "authenticated",
    token: "token-1",
    session: { user: { name: "Rani Lestari" } },
    signIn: jest.fn(),
    signOut: mockSignOut,
  }),
}));

jest.mock("@/hooks/use-dashboard", () => ({
  useDashboard: () => mockQuery,
}));

const payload: DashboardPayload = {
  user: { name: "Rani Lestari" },
  organization: { name: "Demo Store", currency: "IDR", timezone: "Asia/Jakarta" },
  branch: { id: "brn_1", name: "Cabang Utama" },
  dateLabel: "2026-10-27",
  shift: {
    id: "shf_1",
    openedAt: "2026-10-27T08:15:00.000Z",
    openingAmount: 500000,
    expectedAmount: 1250000,
    transactionCount: 12,
    grossTotal: 1840000,
    cashierName: "Rani",
    branchName: "Cabang Utama",
  },
  today: {
    net: 2450000,
    transactions: 32,
    itemsSold: 87,
    comparison: { grossPercent: 12, transactionsPercent: null },
  },
  recentSales: [
    {
      id: "sale_1",
      receiptNumber: "TRX-001",
      customerName: null,
      grandTotal: 85000,
      status: "completed",
      soldAt: "2026-10-27T03:24:00.000Z",
    },
    {
      id: "sale_2",
      receiptNumber: "TRX-002",
      customerName: "Meja 04",
      grandTotal: 42000,
      status: "refunded",
      soldAt: "2026-10-27T03:10:00.000Z",
    },
  ],
};

function loadedQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: payload,
    isPending: false,
    isError: false,
    error: null,
    isRefetching: false,
    refetch: mockRefetch,
    ...overrides,
  };
}

describe("DashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
    mockQuery = loadedQuery();
  });

  it("shows a loading state while the dashboard loads", async () => {
    mockQuery = {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      isRefetching: false,
      refetch: mockRefetch,
    };

    await render(<DashboardScreen />);

    expect(screen.getByTestId("screen-loading")).toBeTruthy();
  });

  it("greets the cashier with today's branch summary", async () => {
    await render(<DashboardScreen />);

    expect(screen.getByText("Selamat datang, Rani.")).toBeTruthy();
    expect(screen.getByText("Kinerja Cabang Utama hari ini.")).toBeTruthy();
    expect(screen.getByText("RINGKASAN OPERASIONAL")).toBeTruthy();
  });

  it("shows the shift, today's numbers and recent sales", async () => {
    await render(<DashboardScreen />);

    expect(screen.getByText("Shift terbuka")).toBeTruthy();
    expect(screen.getByText("Rp 1.250.000")).toBeTruthy();
    expect(screen.getByText("12 transaksi · Rp 1.840.000 penjualan")).toBeTruthy();
    expect(screen.getByText("Rp 2,45 M")).toBeTruthy();
    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByText("87")).toBeTruthy();
    expect(screen.getByText("TRX-001")).toBeTruthy();
    expect(screen.getByText("Rp 85.000")).toBeTruthy();
    expect(screen.getByText("Refund")).toBeTruthy();
  });

  it("offers the quick actions and the new sale shortcut", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    await render(<DashboardScreen />);

    expect(screen.getByText("AKSI CEPAT")).toBeTruthy();
    expect(screen.getByText("Pindai Barcode")).toBeTruthy();
    expect(screen.getByText("Pelanggan")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("new-sale-button"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Segera hadir",
      "Pembuatan transaksi belum tersedia di versi ini.",
    );
    alertSpy.mockRestore();
  });

  it("shows a retry state when the dashboard fails", async () => {
    mockQuery = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("Gagal"),
      isRefetching: false,
      refetch: mockRefetch,
    };

    await render(<DashboardScreen />);

    expect(screen.getByText("Gagal memuat data")).toBeTruthy();

    await fireEvent.press(screen.getByText("Coba Lagi"));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it("lets the user sign out from the error state", async () => {
    mockQuery = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("Gagal"),
      isRefetching: false,
      refetch: mockRefetch,
    };
    mockSignOut.mockResolvedValue(undefined);

    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByText("Keluar"));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("keeps the dashboard visible when a background refresh fails", async () => {
    mockQuery = loadedQuery({ isError: true, error: new Error("offline") });

    await render(<DashboardScreen />);

    expect(screen.queryByText("Gagal memuat data")).toBeNull();
    expect(screen.getByText("Selamat datang, Rani.")).toBeTruthy();
    expect(screen.getByText("TRX-001")).toBeTruthy();
  });

  it("refetches when the user pulls to refresh", async () => {
    await render(<DashboardScreen />);

    const scroll = screen.getByTestId("dashboard-scroll");
    const refreshControl = scroll.props.refreshControl as {
      props: { onRefresh: () => void };
    };

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it("signs out after the user confirms", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockSignOut.mockResolvedValue(undefined);

    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByTestId("logout-button"));

    const buttons = alertSpy.mock.calls[0]?.[2] as
      | { text: string; onPress?: () => void }[]
      | undefined;
    buttons?.find((button) => button.text === "Keluar")?.onPress?.();

    expect(mockSignOut).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});