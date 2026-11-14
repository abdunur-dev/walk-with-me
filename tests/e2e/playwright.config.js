// Run: start the API (see README), then `npm test` in tests/e2e.
// BASE_URL defaults to http://localhost:8000. BROWSER_CHANNEL can be "chrome" or "msedge" to use an installed browser
// instead of `npx playwright install chromium`.
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: ".",
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8000",
    channel: process.env.BROWSER_CHANNEL || undefined,
  },
});
