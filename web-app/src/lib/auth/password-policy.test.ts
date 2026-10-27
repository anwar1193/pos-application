import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";

describe("password policy", () => {
  it("rejects passwords shorter than the minimum", () => {
    expect(validatePasswordPolicy("short")).toBe(
      `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`,
    );
  });

  it("rejects passwords longer than the maximum", () => {
    expect(validatePasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`,
    );
  });

  it("rejects a password equal to the email, case-insensitively", () => {
    expect(
      validatePasswordPolicy("owner@demostore.id", { email: "Owner@DemoStore.id" }),
    ).toBe("Password tidak boleh sama dengan email.");
  });

  it("rejects a password equal to the user's name, case-insensitively", () => {
    expect(validatePasswordPolicy("Rani Wahyuni", { name: "rani wahyuni" })).toBe(
      "Password tidak boleh sama dengan nama.",
    );
  });

  it("accepts a compliant password", () => {
    expect(validatePasswordPolicy("RahasiaToko2026!")).toBeNull();
  });
});
