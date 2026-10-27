import { expect, test } from "@playwright/test";

test("stale session cookie does not trap /dashboard in a redirect loop", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "pos_session",
      value: "stale-invalid-token",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Masuk ke POS Admin" }),
  ).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
});
