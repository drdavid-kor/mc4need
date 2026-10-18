import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  use: {
    baseURL: process.env.UI_BASE || "http://127.0.0.1:8787",
    ...devices["Desktop Chrome"],
    locale: "zh-CN",
  },
  reporter: [["list"], ["json", { outputFile: "reports/ui-results.json" }]],
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
