/** Timezone-aware day/period helpers. Falls back to UTC for invalid zones. */

export type DateRange = { from: Date; to: Date; label: string };

function partsInZone(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const map: Record<string, string> = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: map.hour === "24" ? 0 : Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
}

/** Wall-clock time of `date` in `timeZone`, expressed as a UTC timestamp. */
function wallClockAsUtc(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Milliseconds that `timeZone` is ahead of UTC at `date`. */
export function timeZoneOffset(date: Date, timeZone: string): number {
  return wallClockAsUtc(date, timeZone) - date.getTime();
}

export function localDateString(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(
    p.day,
  ).padStart(2, "0")}`;
}

export function localDateTimeString(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${localDateString(date, timeZone)} ${String(p.hour).padStart(2, "0")}:${String(
    p.minute,
  ).padStart(2, "0")}`;
}

/** UTC instant of a local date's midnight. */
export function startOfLocalDay(dateString: string, timeZone: string): Date {
  const guess = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(guess.getTime())) return guess;
  const offset = timeZoneOffset(guess, timeZone);
  let result = new Date(guess.getTime() - offset);
  // Re-check once to absorb offset changes around DST boundaries.
  const corrected = timeZoneOffset(result, timeZone);
  if (corrected !== offset) result = new Date(guess.getTime() - corrected);
  return result;
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayRange(date: Date, timeZone: string): DateRange {
  const today = localDateString(date, timeZone);
  const from = startOfLocalDay(today, timeZone);
  const to = startOfLocalDay(addDays(today, 1), timeZone);
  return { from, to, label: today };
}

export type PeriodKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "custom";

export function parsePeriod(
  input: {
    period?: string | null;
    from?: string | null;
    to?: string | null;
  },
  timeZone: string,
  now: Date = new Date(),
): { key: PeriodKey; from: Date; to: Date; fromDate: string; toDate: string } {
  const period = (input.period ?? "today") as PeriodKey;
  const today = localDateString(now, timeZone);

  if (input.from && input.to) {
    const fromDate = input.from;
    const toDate = input.to;
    return {
      key: "custom",
      from: startOfLocalDay(fromDate, timeZone),
      to: startOfLocalDay(addDays(toDate, 1), timeZone),
      fromDate,
      toDate,
    };
  }

  if (period === "yesterday") {
    const date = addDays(today, -1);
    return {
      key: period,
      from: startOfLocalDay(date, timeZone),
      to: startOfLocalDay(today, timeZone),
      fromDate: date,
      toDate: date,
    };
  }

  if (period === "7d" || period === "30d") {
    const days = period === "7d" ? 7 : 30;
    const fromDate = addDays(today, -(days - 1));
    return {
      key: period,
      from: startOfLocalDay(fromDate, timeZone),
      to: startOfLocalDay(addDays(today, 1), timeZone),
      fromDate,
      toDate: today,
    };
  }

  if (period === "this_month" || period === "last_month") {
    const [yearText, monthText] = today.split("-");
    let year = Number(yearText);
    let month = Number(monthText);
    if (period === "last_month") {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }
    const firstDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextDate = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
    const lastDay = addDays(nextDate, -1);
    return {
      key: period,
      from: startOfLocalDay(firstDate, timeZone),
      to: startOfLocalDay(nextDate, timeZone),
      fromDate: firstDate,
      toDate: lastDay,
    };
  }

  return {
    key: "today",
    from: startOfLocalDay(today, timeZone),
    to: startOfLocalDay(addDays(today, 1), timeZone),
    fromDate: today,
    toDate: today,
  };
}
