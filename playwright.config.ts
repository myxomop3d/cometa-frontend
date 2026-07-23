import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:5199",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host --port 5199",
    url: "http://localhost:5199/login",
    reuseExistingServer: !process.env.CI,
    env: { VITE_MOCK_API: "true" },
    timeout: 120_000,
  },
});
