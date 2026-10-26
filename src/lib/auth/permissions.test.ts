import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canUseWebAdmin,
} from "@/lib/auth/permissions";

describe("role permission matrix", () => {
  it("allows only owner, admin, and manager into web admin", () => {
    expect(canUseWebAdmin("owner")).toBe(true);
    expect(canUseWebAdmin("admin")).toBe(true);
    expect(canUseWebAdmin("manager")).toBe(true);
    expect(canUseWebAdmin("cashier")).toBe(false);
    expect(canUseWebAdmin("warehouse")).toBe(false);
  });

  it("gives the owner every permission", () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(Object.values(PERMISSIONS).length);
  });

  it("lets admins manage users but not exceed the owner-only role rules", () => {
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.userInvite);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.userUpdate);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.userDeactivate);
  });

  it("limits managers to read-only dashboard and user access", () => {
    expect(ROLE_PERMISSIONS.manager).toEqual([
      PERMISSIONS.dashboardView,
      PERMISSIONS.userView,
    ]);
  });

  it("gives cashiers and warehouse staff no web admin permissions", () => {
    expect(ROLE_PERMISSIONS.cashier).toEqual([]);
    expect(ROLE_PERMISSIONS.warehouse).toEqual([]);
  });
});
