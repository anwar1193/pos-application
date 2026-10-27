import { defineConfig } from "@playwright/test";
import { loadLocalEnv } from "./e2e/env";

const localEnv = loadLocalEnv();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3101",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  expect: {
    timeout: 30_000,
  },
  webServer: {
    command: "bash scripts/e2e-db.sh && npm run dev -- --port 3101",
    url: "http://localhost:3101/api/health",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...localEnv,
      TURSO_DATABASE_URL: "file:./e2e.db",
      APP_URL: "http://localhost:3101",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
