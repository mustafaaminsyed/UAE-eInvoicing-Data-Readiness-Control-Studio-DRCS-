import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1440, height: 1400, name: "desktop-1440" },
  { width: 1024, height: 1360, name: "laptop-1024" },
  { width: 768, height: 1400, name: "tablet-768" },
  { width: 390, height: 1600, name: "mobile-390" },
];

test.describe("landing page responsive layout", () => {
  for (const viewport of viewports) {
    test(`renders cleanly at ${viewport.name}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.route("https://test-project.supabase.co/**", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "networkidle" });

      expect(consoleErrors, `Browser console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
      expect(pageErrors, `Browser page errors: ${pageErrors.join(" | ")}`).toEqual([]);

      await expect(page.getByRole("heading", { name: /from source data to regulatory readiness/i })).toBeVisible();
      await expect(page.getByText(/illustrative sample metrics/i)).toBeVisible();
      await expect(page.getByText("Readiness score")).toBeVisible();
      await expect(page.getByText(/UAE Enterprise/)).toBeVisible();
      await expect(page.getByText(/Engro/i)).toHaveCount(0);
      await expect(page.getByText(/IBR-\d+/i)).toHaveCount(0);
      await expect(page.getByText(/Peppol interoperability framework/i)).toBeVisible();
      await expect(page.getByRole("img", { name: /uae ministry of finance emblem/i })).toBeVisible();
      await expect(page.getByRole("img", { name: /uae federal tax authority logo/i })).toBeVisible();
      await expect(page.getByRole("img", { name: /peppol logo/i })).toBeVisible();
      await expect(page.getByText(/not endorsed by/i)).toBeVisible();
      await expect(page.getByRole("link", { name: /phase 1 mandatory implementation countdown/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "DEV" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "PROD" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /get started/i }).first()).toHaveAttribute("href", "/upload");

      const preview = page.getByTestId("hero-dashboard-preview");
      const previewBox = await preview.boundingBox();
      const viewportWidth = page.viewportSize()?.width ?? viewport.width;
      expect(previewBox).not.toBeNull();
      expect(previewBox!.x).toBeGreaterThanOrEqual(0);
      expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(viewportWidth + 1);
      if (viewport.width >= 1024) {
        const copyBox = await page.getByTestId("hero-copy").boundingBox();
        expect(copyBox).not.toBeNull();
        expect(previewBox!.x).toBeGreaterThanOrEqual(copyBox!.x + copyBox!.width);
      }

      if (viewport.width < 1280) {
        await page.getByRole("button", { name: /toggle navigation/i }).click();
        await expect(page.getByRole("navigation", { name: /mobile navigation/i })).toBeVisible();
        await page.getByRole("navigation", { name: /mobile navigation/i }).getByRole("button", { name: /resources/i }).click();
        const mobilePlaybook = page.getByRole("navigation", { name: /mobile navigation/i }).getByRole("link", { name: /pint data requirements playbook/i });
        await expect(mobilePlaybook).toBeVisible();
        await expect(mobilePlaybook).toHaveAttribute("target", "_blank");
      } else if (viewport.width >= 1280) {
        await page.getByRole("navigation", { name: /main navigation/i }).getByRole("button", { name: /resources/i }).click();
        const desktopPlaybook = page.getByRole("menuitem", { name: /pint data requirements playbook/i });
        await expect(desktopPlaybook).toBeVisible();
        await expect(desktopPlaybook).toHaveAttribute("href", "https://claude.ai/artifact/NDJhTZAmgYoDaLU46UYZUU");
      }

      const metrics = await page.locator("body").evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(consoleErrors).toEqual([]);

      await page.screenshot({
        path: `e2e/artifacts/landing-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});

test("landing CTAs use existing destinations", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const getStarted = page.getByRole("link", { name: /get started/i }).first();
  await expect(getStarted).toHaveAttribute("href", "/upload");

  const seeHowItWorks = page.getByRole("link", { name: /see how it works/i });
  await expect(seeHowItWorks).toHaveAttribute("href", "#workflow");
  await seeHowItWorks.click();
  await expect(page).toHaveURL(/#workflow$/);
  await expect(page.getByRole("heading", { name: /a controlled path to e-invoicing readiness/i })).toBeInViewport();

  const exploreWorkflow = page.getByRole("link", { name: /explore the workflow/i });
  await expect(exploreWorkflow).toHaveAttribute("href", "#workflow");
  await exploreWorkflow.click();
  await expect(page).toHaveURL(/#workflow$/);
  await expect(page.getByRole("heading", { name: /a controlled path to e-invoicing readiness/i })).toBeInViewport();
});

test("primary landing actions are keyboard accessible", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const getStarted = page.getByRole("link", { name: /get started/i }).first();
  await getStarted.focus();
  await expect(getStarted).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/upload$/);

  await page.goto("/", { waitUntil: "networkidle" });
  const seeHowItWorks = page.getByRole("link", { name: /see how it works/i });
  await seeHowItWorks.focus();
  await expect(seeHowItWorks).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#workflow$/);

  const exploreWorkflow = page.getByRole("link", { name: /explore the workflow/i });
  await exploreWorkflow.focus();
  await expect(exploreWorkflow).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#workflow$/);
});

test("Resources dropdown supports keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });

  const resources = page.getByRole("navigation", { name: /main navigation/i }).getByRole("button", { name: /resources/i });
  await resources.focus();
  await page.keyboard.press("ArrowDown");

  const playbook = page.getByRole("menuitem", { name: /pint data requirements playbook/i });
  await expect(playbook).toBeVisible();
  await expect(playbook).toBeFocused();
  await expect(playbook).toHaveAttribute("target", "_blank");
  await expect(playbook).toHaveAttribute("rel", /noopener/);

  await page.keyboard.press("Escape");
  await expect(playbook).toBeHidden();
  await expect(resources).toBeFocused();
});
