import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-redirect";

describe("safeNextPath", () => {
  it("keeps an internal path with its query and hash", () => {
    expect(safeNextPath("/users?page=2#top")).toBe("/users?page=2#top");
  });

  it("falls back for absolute URLs", () => {
    expect(safeNextPath("https://evil.example/steal")).toBe("/dashboard");
  });

  it("falls back for protocol-relative URLs", () => {
    expect(safeNextPath("//evil.example/steal")).toBe("/dashboard");
  });

  it("falls back for backslash tricks", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/users\\..\\admin")).toBe("/dashboard");
  });

  it("falls back for newlines", () => {
    expect(safeNextPath("/users\nSet-Cookie: x=y")).toBe("/dashboard");
  });

  it("refuses to loop back to login", () => {
    expect(safeNextPath("/login")).toBe("/dashboard");
  });

  it("refuses API paths", () => {
    expect(safeNextPath("/api/users")).toBe("/dashboard");
  });

  it("falls back for excessively long values", () => {
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/dashboard");
  });

  it("uses a custom fallback when provided", () => {
    expect(safeNextPath("https://evil.example", "/users")).toBe("/users");
  });
});
