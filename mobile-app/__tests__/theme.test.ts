import { colors, radii, spacing } from "@/theme/tokens";

describe("design tokens", () => {
  it("matches the blueprint palette", () => {
    expect(colors.primaryContainer).toBe("#14523B");
    expect(colors.primary).toBe("#003A27");
    expect(colors.surface).toBe("#EEFDF3");
    expect(colors.surfaceLowest).toBe("#FFFFFF");
  });

  it("matches the blueprint spacing and radii", () => {
    expect(spacing.lg).toBe(16);
    expect(spacing.md).toBe(12);
    expect(radii.card).toBe(12);
    expect(radii.control).toBe(8);
  });
});
