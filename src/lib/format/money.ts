/**
 * Money is stored as integer rupiah. Tax rates are basis points
 * (1100 = 11%). All rounding is half-up on the final amount.
 */
export const TAX_BASIS_POINTS = 10_000;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value + Number.EPSILON);
}

export function taxAmount(base: number, rateBasisPoints: number): number {
  if (rateBasisPoints <= 0) return 0;
  return roundMoney((base * rateBasisPoints) / TAX_BASIS_POINTS);
}

export function formatMoney(amount: number, currency = "IDR"): string {
  const rounded = roundMoney(amount);
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `Rp ${rounded.toLocaleString("id-ID")}`;
  }
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits }).format(value);
}

/** Allocate a transaction-level discount across line bases without losing a rupiah. */
export function allocateProportionally(
  total: number,
  bases: number[],
): number[] {
  const baseSum = bases.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || baseSum <= 0) return bases.map(() => 0);
  const capped = Math.min(total, baseSum);
  const shares = bases.map((base) => Math.floor((capped * base) / baseSum));
  let remainder = capped - shares.reduce((sum, value) => sum + value, 0);
  for (let index = shares.length - 1; index >= 0 && remainder > 0; index -= 1) {
    if (bases[index]! > 0) {
      shares[index] = shares[index]! + remainder;
      remainder = 0;
    }
  }
  return shares;
}

export function effectivePrice(product: {
  sellingPrice: number;
  promoPrice: number | null;
}): number {
  if (product.promoPrice !== null && product.promoPrice >= 0) {
    return product.promoPrice;
  }
  return product.sellingPrice;
}
