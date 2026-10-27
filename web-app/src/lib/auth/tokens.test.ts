import { describe, expect, it } from "vitest";
import {
  generateOpaqueToken,
  hashToken,
  normalizeEmail,
} from "@/lib/auth/tokens";

describe("token helpers", () => {
  it("generates unique opaque tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes tokens deterministically as 64 hex characters", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abcd"));
  });

  it("normalizes email before storage or comparison", () => {
    expect(normalizeEmail("  Owner@DemoStore.ID ")).toBe("owner@demostore.id");
  });
});
