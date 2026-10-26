import { expect, test } from "@playwright/test";
import { loadLocalEnv, requireEnv } from "./env";

const localEnv = loadLocalEnv();
const OWNER_EMAIL = requireEnv("SEED_OWNER_EMAIL", localEnv);
const OWNER_PASSWORD = requireEnv("SEED_OWNER_PASSWORD", localEnv);

const OWNER_PAGES = [
  "/dashboard",
  "/pos",
  "/sales",
  "/shifts",
  "/catalog",
  "/inventory",
  "/customers",
  "/suppliers",
  "/purchases",
  "/purchases/new",
  "/reports",
  "/users",
  "/settings",
  "/audit",
  "/account",
];

test("owner can open every back-office page without a server error", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.locator("#email").fill(OWNER_EMAIL);
  await page.locator("#password").fill(OWNER_PASSWORD);
  await expect(async () => {
    if (new URL(page.url()).pathname === "/login") {
      await page.locator("#email").fill(OWNER_EMAIL);
      await page.locator("#password").fill(OWNER_PASSWORD);
      await page.getByRole("button", { name: "Masuk", exact: true }).click();
    }
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 10_000 });
  }).toPass({ timeout: 45_000 });

  for (const path of OWNER_PAGES) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should not fail with a server error`).toBeLessThan(500);
    expect(new URL(page.url()).pathname, `${path} redirects away`).toBe(path);
    await expect(page.locator("body")).not.toContainText("Application error");
  }
});
