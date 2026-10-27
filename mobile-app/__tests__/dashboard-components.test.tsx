import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BottomNav } from "@/components/BottomNav";
import { RecentSales } from "@/components/RecentSales";
import { ShiftCard } from "@/components/ShiftCard";
import { StatsStrip } from "@/components/StatsStrip";
import { StatusBadge } from "@/components/StatusBadge";
import type { DashboardRecentSale, DashboardShift, DashboardToday } from "@/api/types";

const timezone = "Asia/Jakarta";

const openShift: DashboardShift = {
  id: "shf_1",
  openedAt: "2026-10-27T01:15:00.000Z",
  openingAmount: 500000,
  expectedAmount: 1250000,
  transactionCount: 12,
  grossTotal: 1840000,
  cashierName: "Rani",
  branchName: "Cabang Utama",
};

const today: DashboardToday = {
  net: 2450000,
  transactions: 32,
  itemsSold: 87,
  comparison: { grossPercent: 12, transactionsPercent: null },
};

const sales: DashboardRecentSale[] = [
  {
    id: "sal_1",
    receiptNumber: "TRX-001",
    customerName: null,
    grandTotal: 85000,
    status: "completed",
    soldAt: "2026-10-27T03:24:00.000Z",
  },
  {
    id: "sal_2",
    receiptNumber: "TRX-002",
    customerName: "Meja 04",
    grandTotal: 42000,
    status: "voided",
    soldAt: "2026-10-27T03:10:00.000Z",
  },
  {
    id: "sal_3",
    receiptNumber: "TRX-003",
    customerName: "Pelanggan umum",
    grandTotal: 120000,
    status: "refunded",
    soldAt: "2026-10-27T02:52:00.000Z",
  },
];

describe("ShiftCard", () => {
  it("shows the expected cash and transaction count for an open shift", async () => {
    await render(<ShiftCard shift={openShift} timezone={timezone} />);

    expect(screen.getByText("KAS DIHARAPKAN")).toBeTruthy();
    expect(screen.getByText("Rp 1.250.000")).toBeTruthy();
    expect(screen.getByText("12 transaksi · Rp 1.840.000 penjualan")).toBeTruthy();
    expect(screen.getByText("Dibuka 08.15 oleh Rani")).toBeTruthy();
    expect(screen.getByText("Shift terbuka")).toBeTruthy();
  });

  it("explains that no shift is open", async () => {
    await render(<ShiftCard shift={null} timezone={timezone} />);

    expect(screen.getByText("Belum ada shift terbuka")).toBeTruthy();
  });
});

describe("StatsStrip", () => {
  it("renders today's totals and comparison labels", async () => {
    await render(<StatsStrip today={today} />);

    expect(screen.getByText("Penjualan bersih")).toBeTruthy();
    expect(screen.getByText("Rp 2,45 M")).toBeTruthy();
    expect(screen.getByText("+12% vs kmrn")).toBeTruthy();
    expect(screen.getByText("Transaksi")).toBeTruthy();
    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByText("Item terjual")).toBeTruthy();
    expect(screen.getByText("87")).toBeTruthy();
    expect(screen.getByText("2,7/transaksi")).toBeTruthy();
  });

  it("shows the no-comparison label when the delta is null", async () => {
    await render(
      <StatsStrip
        today={{ ...today, comparison: { grossPercent: null, transactionsPercent: null } }}
      />,
    );

    expect(screen.getAllByText("tanpa data pembanding").length).toBeGreaterThan(0);
  });
});

describe("StatusBadge", () => {
  it.each([
    ["completed", "Selesai"],
    ["voided", "Dibatalkan"],
    ["refunded", "Refund"],
  ])("maps %s to %s", async (status, label) => {
    await render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeTruthy();
  });
});

describe("RecentSales", () => {
  it("renders the latest sales with customer fallback and time", async () => {
    await render(<RecentSales sales={sales} timezone={timezone} />);

    expect(screen.getByText("Transaksi terakhir")).toBeTruthy();
    expect(screen.getByText("TRX-001")).toBeTruthy();
    expect(screen.getByText("10.24 · Pelanggan umum")).toBeTruthy();
    expect(screen.getByText("Rp 85.000")).toBeTruthy();
    expect(screen.getByText("10.10 · Meja 04")).toBeTruthy();
    expect(screen.getAllByText("Selesai").length).toBe(1);
    expect(screen.getByText("Dibatalkan")).toBeTruthy();
    expect(screen.getByText("Refund")).toBeTruthy();
  });

  it("shows the empty state when there are no sales", async () => {
    await render(<RecentSales sales={[]} timezone={timezone} />);

    expect(screen.getByText("Belum ada transaksi hari ini.")).toBeTruthy();
  });
});

describe("BottomNav", () => {
  it("marks Beranda as the active tab", async () => {
    await render(<BottomNav />);

    expect(screen.getByRole("tab", { name: "Beranda" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByText("Kasir")).toBeTruthy();
    expect(screen.getByText("Riwayat")).toBeTruthy();
    expect(screen.getByText("Akun")).toBeTruthy();
  });

  it("alerts when an unavailable tab is pressed", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<BottomNav />);

    await fireEvent.press(screen.getByRole("tab", { name: "Kasir" }));

    expect(alertSpy).toHaveBeenCalledWith("Segera hadir", expect.stringContaining("belum tersedia"));
    alertSpy.mockRestore();
  });
});
