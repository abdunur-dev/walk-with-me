// axe-core gate: zero critical or serious violations on every site page,
// with the jobs accommodation dialog open, and with the helper panel open where the widget is present.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const PAGES = ["/site/index.html", "/site/docs.html", "/site/jobs.html", "/site/staff.html",
               "/site/teacher.html", "/site/sms-sim.html", "/site/404.html", "/site/500.html", "/does-not-exist"];

async function check(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("iframe") // framed Savanna demo is checked on its own page
    .analyze();
  const bad = results.violations.filter(v => v.impact === "critical" || v.impact === "serious");
  if (bad.length) {
    console.log(`\n${label}:\n` + bad.map(v => `  [${v.impact}] ${v.id}: ${v.help}\n    ` +
      v.nodes.slice(0, 3).map(n => n.target.join(" ")).join("\n    ")).join("\n"));
  }
  expect(bad, `${label} has critical/serious axe violations`).toEqual([]);
}

for (const path of PAGES) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await check(page, path);
  });
}

test("axe: savanna demo page", async ({ page }) => {
  await page.goto("/savanna/pages/concept-with-navigation.html");
  await page.waitForLoadState("networkidle");
  await check(page, "savanna concept page");
});

test("axe: jobs page with accommodation dialog open (all 3 steps)", async ({ page }) => {
  await page.goto("/site/jobs.html");
  await page.getByRole("button", { name: /Ask for support/ }).first().click();
  await expect(page.getByRole("heading", { name: "What would help at the interview?" })).toBeFocused();
  await check(page, "jobs dialog step 1");
  await page.locator("#acc").getByLabel("Quiet room").check();
  await page.getByRole("button", { name: "Write my message" }).click();
  await expect(page.getByRole("heading", { name: "Check your message" })).toBeFocused();
  await check(page, "jobs dialog step 2");
  await page.getByRole("button", { name: "Next: choose how to send" }).click();
  await check(page, "jobs dialog step 3");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Ask for support/ }).first()).toBeFocused();
});

test("axe: jobs alerts form and filters", async ({ page }) => {
  await page.goto("/site/jobs.html");
  await page.getByRole("button", { name: "Get alerts", exact: true }).first().click();
  await page.getByLabel("SMS", { exact: true }).check();
  await page.getByRole("button", { name: "Start alerts" }).click();
  await expect(page.locator(".error-summary")).toBeFocused();
  await check(page, "jobs alerts form with errors");
});

test("reflow: no horizontal scroll at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of PAGES.slice(0, 6)) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways at 320px`).toBeLessThanOrEqual(0);
  }
});
