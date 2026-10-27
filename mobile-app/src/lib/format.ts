const idNumber = (options: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("id-ID", options);

const decimal = idNumber({ maximumFractionDigits: 1 });

function withComma(value: string): string {
  return value.replace(".", ",");
}

export function formatMoney(amount: number): string {
  const value = Math.round(Math.abs(amount));
  const formatted = idNumber({ maximumFractionDigits: 0 }).format(value);
  return amount < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatCompactMoney(amount: number): string {
  if (Math.abs(amount) < 1_000_000) return formatMoney(amount);
  const compact = idNumber({ maximumFractionDigits: 2 }).format(amount / 1_000_000);
  return `Rp ${withComma(compact)} M`;
}

export function formatTime(date: Date, timeZone: string): string {
  const value = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return value.replace(/:/g, ".");
}

export function formatDateHeader(date: Date, timeZone: string): string {
  const value = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${value} · ${formatTime(date, timeZone)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function averagePerTransaction(net: number, transactions: number): string {
  if (transactions <= 0) return "0";
  return withComma(decimal.format(net / transactions));
}

export function deltaLabel(percent: number | null): string {
  if (percent === null) return "tanpa data pembanding";
  const value = decimal.format(Math.abs(percent));
  if (percent > 0) return `+${value}%`;
  if (percent < 0) return `-${value}%`;
  return "0%";
}
