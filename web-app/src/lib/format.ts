export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDateLong(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function formatDateTime(date: Date, timeZone: string): string {
  return `${formatDateLong(date, timeZone)} · ${formatTime(date, timeZone)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatRelative(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
}
