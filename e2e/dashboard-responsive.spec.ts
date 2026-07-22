import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1440, height: 1400, name: "desktop-1440" },
  { width: 1024, height: 1360, name: "laptop-1024" },
  { width: 768, height: 1400, name: "tablet-768" },
  { width: 390, height: 1600, name: "mobile-390" },
];

test.describe("dashboard responsive layout", () => {
  for (const viewport of viewports) {
    test(`renders cleanly at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/dashboard", { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: /dashboard/i }).first()).toBeVisible();
      await expect(page.getByText(/executive compliance view/i)).toBeVisible();
      await expect(page.getByText(/source-data quality and integrity/i)).toBeVisible();

      const metrics = await page.locator("body").evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

      await page.screenshot({
        path: `e2e/artifacts/dashboard-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
