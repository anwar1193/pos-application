export type SaleStatusTone = "success" | "warning" | "danger" | "neutral";

export function saleStatus(status: string): { label: string; tone: SaleStatusTone } {
  switch (status) {
    case "completed":
      return { label: "Selesai", tone: "success" };
    case "voided":
      return { label: "Dibatalkan", tone: "danger" };
    case "refunded":
      return { label: "Refund", tone: "warning" };
    case "held":
      return { label: "Ditahan", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}
