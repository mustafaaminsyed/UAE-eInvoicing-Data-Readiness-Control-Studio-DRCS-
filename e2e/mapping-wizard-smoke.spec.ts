import { expect, test } from '@playwright/test';

const HEADER_UPLOAD = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,principal_id,invoicing_period_start_date,invoicing_period_end_date,deliver_to_address_line_1,deliver_to_city,deliver_to_country_subdivision,deliver_to_country_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date
INV900,UAE-2025-0900,2025-01-15,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,,,,,,,,2025-02-14,30,1.000000,1000.00,50.00,1050.00,1050.00,S,5.00,,,,`;

test.describe('mapping wizard smoke', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.exposeFunction('__getMappingSmokeErrors', () => ({
      pageErrors,
      consoleErrors,
    }));
  });

  async function expectNoRuntimeErrors(page: Parameters<typeof test>[1] extends never ? never : any) {
    const errors = await page.evaluate(async () => {
      return await (window as Window & {
        __getMappingSmokeErrors: () => Promise<{ pageErrors: string[]; consoleErrors: string[] }>;
      }).__getMappingSmokeErrors();
    });

    expect(errors.pageErrors, `Page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);
  }

  async function goNext(page: Parameters<typeof test>[1] extends never ? never : any) {
    const nextButton = page.getByRole('button', { name: /^next$/i });
    await expect(nextButton).toBeEnabled();
    await nextButton.evaluate((button: HTMLButtonElement) => button.click());
  }

  test('built-in header template flows through upload, mapping, analysis, and save steps', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.getByRole('heading', { name: 'Field Mapping Assistant' })).toBeVisible();
    await expect(page.getByText('Upload ERP Extract')).toBeVisible();

    await page.getByRole('button', { name: /load invoice headers template/i }).click();

    await expect(page.locator('#header')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Column Analysis')).toBeVisible();
    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.getByText('invoice_headers_template.csv', { exact: true }).first()).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('invoice_number')).toBeVisible();
    await expect(page.getByText('Credit Note Reason Code')).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Validation Summary')).toBeVisible();
    await expect(page.getByText('Business Scenario Questions')).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Template Details')).toBeVisible();
    await expect(page.getByRole('button', { name: /save as draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /approve & activate/i })).toBeVisible();
  });

  test('header upload auto-detects dataset type from canonical template columns', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'true');

    await page.setInputFiles('#erp-file-input', {
      name: 'headers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(HEADER_UPLOAD),
    });

    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.getByText(/headers\.csv/i)).toBeVisible();
    await expect(page.locator('#header')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'false');

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('invoice_number')).toBeVisible();
  });
});
