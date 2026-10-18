import path from 'node:path';
import { expect, test } from '@playwright/test';

const FIXTURES = {
  buyers: path.resolve('e2e/fixtures/buyers.csv'),
  headers: path.resolve('e2e/fixtures/headers_invalid_codelist.csv'),
};

const STRUCTURALLY_VALID_LINES = `line_id,invoice_id,line_number,description,item_name,quantity,unit_of_measure,unit_price,item_price_discount,price_base_quantity,line_discount,line_total_excl_vat,vat_rate,vat_amount,tax_category_code
L001,INV001,1,Consulting Services - Tax Advisory,Tax advisory service,10,BAD,100.00,0.00,1,0.00,1000.00,5.00,50.00,S
L002,INV002,1,E-Invoicing Integration Package,E-Invoicing package,1,EA,2000.00,0.00,1,0.00,2000.00,5.00,100.00,S
L003,INV003,1,Compliance Readiness Assessment,Readiness assessment,5,EA,100.00,0.00,1,0.00,500.00,5.00,25.00,S`;

test('SPA navigation preserves uploaded invoices and completed validation context in Traceability', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[aria-label="Buyers File CSV upload"]', FIXTURES.buyers);
  await page.setInputFiles('input[aria-label="Invoice Headers File CSV upload"]', FIXTURES.headers);
  await page.setInputFiles('input[aria-label="Invoice Lines File CSV upload"]', {
    name: 'lines_structurally_valid_runtime_invalid.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(STRUCTURALLY_VALID_LINES),
  });

  const loadButton = page.getByRole('button', { name: 'Load Data & Continue' });
  await expect(loadButton).toBeEnabled();
  await loadButton.click();

  await expect(page).toHaveURL(/\/run$/);
  const runButton = page.getByRole('button', { name: /Run All Checks \(/ });
  await expect(runButton).toBeEnabled();
  await runButton.click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByLabel('Primary navigation').getByRole('link', { name: 'Traceability' }).click();

  await expect(page).toHaveURL(/\/traceability$/);
  await expect(page.getByText('Invoices in selection: 3')).toBeVisible();
  await expect(page.getByLabel('Primary navigation').getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  await expect(page.getByLabel('Primary navigation').getByRole('link', { name: 'Exceptions' })).toHaveAttribute('href', '/exceptions');
  await expect(page.getByText(/Upload data on the/)).toHaveCount(0);
});

test('direct Traceability access without active in-memory context shows the empty state', async ({ page }) => {
  await page.goto('/traceability');

  await expect(page.getByText('Loading data context. Upload invoice data to activate Scenario Lens.')).toBeVisible();
  await expect(page.getByText(/Upload data on the/)).toBeVisible();
  await expect(page.getByText('Invoices in selection: 0')).toBeVisible();
  await expect(page.getByLabel('Primary navigation').getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('href', '/dashboard');
});
