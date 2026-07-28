import { expect, test } from '@playwright/test';

const HEADER_UPLOAD = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,principal_id,invoicing_period_start_date,invoicing_period_end_date,deliver_to_address_line_1,deliver_to_city,deliver_to_country_subdivision,deliver_to_country_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date
INV900,UAE-2025-0900,2025-01-15,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,,,,,,,,2025-02-14,30,1.000000,1000.00,50.00,1050.00,1050.00,S,5.00,,,,`;

const PARTY_UPLOAD = `buyer_id,buyer_name,buyer_trn,buyer_address,buyer_city,buyer_country,buyer_legal_reg_id,buyer_legal_reg_id_type
B001,Acme Trading LLC,100000000000123,Sheikh Zayed Road,Dubai,AE,LIC-1001,TL`;

const LINES_UPLOAD = `line_id,invoice_id,line_number,description,quantity,unit_of_measure,unit_price,line_discount,line_total_excl_vat,vat_rate,vat_amount,tax_category_code
L001,INV900,1,Consulting services,2,EA,500.00,0.00,1000.00,5.00,50.00,S`;

const COMBINED_UPLOAD = `invoice_id,invoice_number,issue_date,invoice_type,currency,buyer_id,line_id,line_number,description,quantity,unit_of_measure,unit_price,line_total_excl_vat,vat_rate,vat_amount
INV901,UAE-2025-0901,2025-01-20,380,AED,B001,L001,1,Implementation services,3,EA,250.00,750.00,5.00,37.50`;

const CREDIT_NOTE_UPLOAD = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date
CN901,CN-2025-0901,2025-01-22,381,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,2025-02-14,30,1.000000,-100.00,-5.00,-105.00,-105.00,S,5.00,95,Partial rebate,INV900,2025-01-15`;

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

  function getBuiltInTemplateRow(page: Parameters<typeof test>[1] extends never ? never : any, title: string) {
    return page
      .getByText(title, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-dashed")][1]');
  }

  test('built-in header template flows through upload, mapping, analysis, and save steps', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.getByRole('heading', { name: 'Field Mapping Assistant' })).toBeVisible();
    await expect(page.getByText('Upload ERP Extract')).toBeVisible();

    const headerTemplateRow = getBuiltInTemplateRow(page, 'Invoice Headers Template');
    await headerTemplateRow.getByRole('button', { name: /load sample data/i }).click();

    await expect(page.locator('#header')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Column Analysis')).toBeVisible();
    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.getByText('invoice_headers_template.csv', { exact: false }).first()).toBeVisible();

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

  test('built-in party template loads and routes to party mappings', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.getByRole('heading', { name: 'Field Mapping Assistant' })).toBeVisible();

    const partyTemplateRow = getBuiltInTemplateRow(page, 'Party Data Template');
    await partyTemplateRow.getByRole('button', { name: /load sample data/i }).click();

    await expect(page.locator('#parties')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('buyers_template.csv', { exact: false }).first()).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('buyer_name')).toBeVisible();
    await expect(page.getByText('buyer_trn')).toBeVisible();
  });

  test('built-in line template loads and routes to line mappings', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.getByRole('heading', { name: 'Field Mapping Assistant' })).toBeVisible();

    const linesTemplateRow = getBuiltInTemplateRow(page, 'Invoice Lines Template');
    await linesTemplateRow.getByRole('button', { name: /load sample data/i }).click();

    await expect(page.locator('#lines')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('invoice_lines_template.csv', { exact: false }).first()).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('line_number')).toBeVisible();
    await expect(page.getByText('unit_price')).toBeVisible();
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

  test('party upload auto-detects dataset type from canonical template columns', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'true');

    await page.setInputFiles('#erp-file-input', {
      name: 'buyers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(PARTY_UPLOAD),
    });

    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.getByText(/buyers\.csv/i)).toBeVisible();
    await expect(page.locator('#parties')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'false');

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('buyer_name')).toBeVisible();
  });

  test('line upload auto-detects dataset type from canonical template columns', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'true');

    await page.setInputFiles('#erp-file-input', {
      name: 'lines.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(LINES_UPLOAD),
    });

    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.getByText(/lines\.csv/i)).toBeVisible();
    await expect(page.locator('#lines')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'false');

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('line_number')).toBeVisible();
  });

  test('combined export upload stays in combined mode and exposes header plus line mappings', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'true');

    await page.setInputFiles('#erp-file-input', {
      name: 'combined.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(COMBINED_UPLOAD),
    });

    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.getByText(/combined\.csv/i)).toBeVisible();
    await expect(page.locator('#combined')).toHaveAttribute('aria-checked', 'true');

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('invoice_number')).toBeVisible();
    await expect(page.getByText('line_number')).toBeVisible();
  });

  test('credit-note baseline carries scenario guidance through analysis and save', async ({ page }) => {
    await page.goto('/mapping?tab=create');

    await page.locator('#doc-baseline-381').click();
    await expect(page.locator('#doc-baseline-381')).toBeChecked();

    await page.setInputFiles('#erp-file-input', {
      name: 'credit-note-headers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CREDIT_NOTE_UPLOAD),
    });

    await expect(page.getByText('Data Preview')).toBeVisible();
    await expect(page.locator('#header')).toHaveAttribute('aria-checked', 'true');

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Field Mappings')).toBeVisible();
    await expect(page.getByText('Credit Note Reason Code')).toBeVisible();
    await expect(page.getByText('Credit Note Reason Text')).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Validation Summary')).toBeVisible();
    await expect(page.getByText('Declared baseline:')).toBeVisible();
    await expect(page.getByText('381 Credit Note')).toBeVisible();
    await expect(page.getByText('Credit Note Scenario Readiness')).toBeVisible();
    await expect(page.getByText('Observed invoice types in sample rows: 381')).toBeVisible();

    await goNext(page);
    await expectNoRuntimeErrors(page);

    await expect(page.getByText('Template Details')).toBeVisible();
    await expect(page.getByText('Template baseline for this export:')).toBeVisible();
    await expect(page.getByText('Because the declared baseline is 381 Credit Note', { exact: false })).toBeVisible();
  });
});
