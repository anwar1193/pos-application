import { expect, test, type Page } from "@playwright/test";
import { loadLocalEnv, requireEnv } from "./env";

const localEnv = loadLocalEnv();
const OWNER_EMAIL = requireEnv("SEED_OWNER_EMAIL", localEnv);
const OWNER_PASSWORD = requireEnv("SEED_OWNER_PASSWORD", localEnv);

const ADMIN_EMAIL = "e2e-admin@demostore.id";
const ADMIN_PASSWORD = "E2eAdminPass2026!";
const CASHIER_EMAIL = "e2e-cashier@demostore.id";
const CASHIER_PASSWORD = "E2eCashierPass2026!";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

async function inviteViaUi(
  page: Page,
  input: { name: string; email: string; role: string },
): Promise<string> {
  await page.goto("/users/invite");
  await page.locator("#name").fill(input.name);
  await page.locator("#email").fill(input.email);
  await page.locator("#roleId").selectOption({ label: input.role });
  await page.getByRole("button", { name: "Buat undangan" }).click();

  await expect(page.getByRole("heading", { name: "Undangan siap dikirim" })).toBeVisible();
  const url = (await page.getByText(/\/invite\/[A-Za-z0-9_-]+$/).textContent())?.trim();
  expect(url, "invitation URL should be displayed once").toBeTruthy();
  return url!;
}

async function acceptInvite(page: Page, inviteUrl: string, password: string) {
  await page.goto(inviteUrl);
  await expect(page.getByRole("heading", { name: "Selesaikan akun Anda" })).toBeVisible();
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.getByRole("button", { name: "Aktifkan akun" }).click();
  await expect(page.getByRole("heading", { name: "Akun aktif" })).toBeVisible();
}

test("owner invites admin, admin invites cashier, cashier is denied, owner logs out", async ({
  browser,
}) => {
  test.setTimeout(180_000);

  const ownerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const cashierContext = await browser.newContext();

  try {
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, OWNER_EMAIL, OWNER_PASSWORD);
    await expect(ownerPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const adminInviteUrl = await inviteViaUi(ownerPage, {
      name: "E2E Admin",
      email: ADMIN_EMAIL,
      role: "Admin",
    });

    const adminPage = await adminContext.newPage();
    await acceptInvite(adminPage, adminInviteUrl, ADMIN_PASSWORD);
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(adminPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const cashierInviteUrl = await inviteViaUi(adminPage, {
      name: "E2E Kasir",
      email: CASHIER_EMAIL,
      role: "Kasir",
    });

    const cashierPage = await cashierContext.newPage();
    await acceptInvite(cashierPage, cashierInviteUrl, CASHIER_PASSWORD);
    await login(cashierPage, CASHIER_EMAIL, CASHIER_PASSWORD);
    await expect(cashierPage.getByText("Akun Anda tidak aktif")).toBeVisible();
    await expect(cashierPage).toHaveURL(/\/login/);

    await ownerPage.getByRole("button", { name: "Menu profil" }).click();
    await ownerPage.getByRole("menuitem", { name: /Keluar$/ }).click();
    await expect(ownerPage).toHaveURL(/\/login/);

    await ownerPage.goto("/dashboard");
    await expect(ownerPage).toHaveURL(/\/login/);
    expect(new URL(ownerPage.url()).searchParams.get("next")).toBe("/dashboard");
  } finally {
    await ownerContext.close();
    await adminContext.close();
    await cashierContext.close();
  }
});
