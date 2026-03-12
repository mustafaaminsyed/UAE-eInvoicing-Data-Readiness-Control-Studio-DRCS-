import path from 'node:path';
import { expect, test } from '@playwright/test';

const FIXTURES = {
  buyers: path.resolve('e2e/fixtures/buyers.csv'),
  headers: path.resolve('e2e/fixtures/headers_invalid_codelist.csv'),
  lines: path.resolve('e2e/fixtures/lines_invalid_codelist.csv'),
};

test('smoke: upload -> run checks -> exceptions shows codelist failures', async ({ page }) => {
  await page.goto('/upload');

  await page.setInputFiles('input[aria-label="Buyers File CSV upload"]', FIXTURES.buyers);
  await page.setInputFiles('input[aria-label="Invoice Headers File CSV upload"]', FIXTURES.headers);
  await page.setInputFiles('input[aria-label="Invoice Lines File CSV upload"]', FIXTURES.lines);

  const loadButton = page.getByRole('button', { name: 'Load Data & Continue' });
  await expect(loadButton).toBeEnabled();
  await loadButton.click();

  await expect(page).toHaveURL(/\/run$/);
  await expect(page.getByRole('heading', { name: 'Run Compliance Checks' })).toBeVisible();

  const runButton = page.getByRole('button', { name: /Run All Checks \(/ });
  await expect(runButton).toBeEnabled();
  await runButton.click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Exceptions' }).first().click();
  await expect(page).toHaveURL(/\/exceptions/);
  await expect(page.getByRole('heading', { name: 'Exceptions' })).toBeVisible();

  await expect(page.getByText('Seller Country Code ISO3166')).toBeVisible();
  await expect(page.getByText('Payment Means Code UNCL4461')).toBeVisible();
  await expect(page.getByText('Unit Of Measure Code UNECE Rec20')).toBeVisible();
});
