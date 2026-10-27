import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canUseWebAdmin,
} from "@/lib/auth/permissions";

describe("role permission matrix", () => {
  it("allows every operational role into web admin", () => {
    expect(canUseWebAdmin("owner")).toBe(true);
    expect(canUseWebAdmin("admin")).toBe(true);
    expect(canUseWebAdmin("manager")).toBe(true);
    expect(canUseWebAdmin("cashier")).toBe(true);
    expect(canUseWebAdmin("warehouse")).toBe(true);
    expect(canUseWebAdmin("unknown")).toBe(false);
  });

  it("gives the owner every permission", () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(Object.values(PERMISSIONS).length);
  });

  it("lets admins manage users but not exceed the owner-only role rules", () => {
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.userInvite);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.userUpdate);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.userDeactivate);
  });

  it("limits managers to operational access without settings control", () => {
    expect(ROLE_PERMISSIONS.manager).toContain(PERMISSIONS.dashboardView);
    expect(ROLE_PERMISSIONS.manager).toContain(PERMISSIONS.catalogView);
    expect(ROLE_PERMISSIONS.manager).toContain(PERMISSIONS.inventoryAdjust);
    expect(ROLE_PERMISSIONS.manager).toContain(PERMISSIONS.saleVoid);
    expect(ROLE_PERMISSIONS.manager).toContain(PERMISSIONS.reportView);
    expect(ROLE_PERMISSIONS.manager).not.toContain(PERMISSIONS.settingsManage);
    expect(ROLE_PERMISSIONS.manager).not.toContain(PERMISSIONS.shiftManage);
    expect(ROLE_PERMISSIONS.manager).not.toContain(PERMISSIONS.catalogManage);
    expect(ROLE_PERMISSIONS.manager).not.toContain(PERMISSIONS.purchaseManage);
  });

  it("gives cashiers the POS and shift workspace only", () => {
    expect(ROLE_PERMISSIONS.cashier).toContain(PERMISSIONS.saleCreate);
    expect(ROLE_PERMISSIONS.cashier).toContain(PERMISSIONS.shiftManage);
    expect(ROLE_PERMISSIONS.cashier).toContain(PERMISSIONS.catalogView);
    expect(ROLE_PERMISSIONS.cashier).not.toContain(PERMISSIONS.settingsManage);
    expect(ROLE_PERMISSIONS.cashier).not.toContain(PERMISSIONS.reportView);
    expect(ROLE_PERMISSIONS.cashier).not.toContain(PERMISSIONS.inventoryAdjust);
  });

  it("gives warehouse staff stock and purchasing access without sales", () => {
    expect(ROLE_PERMISSIONS.warehouse).toContain(PERMISSIONS.inventoryView);
    expect(ROLE_PERMISSIONS.warehouse).toContain(PERMISSIONS.purchaseReceive);
    expect(ROLE_PERMISSIONS.warehouse).toContain(PERMISSIONS.reportView);
    expect(ROLE_PERMISSIONS.warehouse).not.toContain(PERMISSIONS.saleCreate);
    expect(ROLE_PERMISSIONS.warehouse).not.toContain(PERMISSIONS.settingsManage);
  });
});
