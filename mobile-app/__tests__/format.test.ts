import {
  averagePerTransaction,
  deltaLabel,
  firstName,
  formatCompactMoney,
  formatDateHeader,
  formatMoney,
  formatTime,
} from "@/lib/format";

const jakartaMorning = new Date("2026-10-27T03:24:00.000Z");
const jakartaTimeZone = "Asia/Jakarta";

describe("formatMoney", () => {
  it("formats rupiah with dot thousands separators", () => {
    expect(formatMoney(1250000)).toBe("Rp 1.250.000");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("Rp 0");
  });
});

describe("formatCompactMoney", () => {
  it("uses M for millions with a comma decimal", () => {
    expect(formatCompactMoney(2450000)).toBe("Rp 2,45 M");
  });

  it("falls back to full rupiah below a million", () => {
    expect(formatCompactMoney(245000)).toBe("Rp 245.000");
  });
});

describe("formatTime", () => {
  it("formats the hour in the organization timezone with a dot", () => {
    expect(formatTime(jakartaMorning, jakartaTimeZone)).toBe("10.24");
  });
});

describe("formatDateHeader", () => {
  it("formats date and time in Indonesian", () => {
    expect(formatDateHeader(jakartaMorning, jakartaTimeZone)).toBe("27 Okt 2026 · 10.24");
  });
});

describe("firstName", () => {
  it("returns the first word of the name", () => {
    expect(firstName("Rani Kusuma")).toBe("Rani");
  });

  it("trims surrounding whitespace", () => {
    expect(firstName("  Rani  ")).toBe("Rani");
  });
});

describe("averagePerTransaction", () => {
  it("formats the average with one comma decimal", () => {
    expect(averagePerTransaction(87, 32)).toBe("2,7");
  });

  it("returns zero when there are no transactions", () => {
    expect(averagePerTransaction(87, 0)).toBe("0");
  });
});

describe("deltaLabel", () => {
  it("explains that no comparison data exists", () => {
    expect(deltaLabel(null)).toBe("tanpa data pembanding");
  });

  it("prefixes positive changes with a plus", () => {
    expect(deltaLabel(12.5)).toBe("+12,5%");
  });

  it("keeps the minus sign on negative changes", () => {
    expect(deltaLabel(-50)).toBe("-50%");
  });

  it("shows zero without a sign", () => {
    expect(deltaLabel(0)).toBe("0%");
  });
});
