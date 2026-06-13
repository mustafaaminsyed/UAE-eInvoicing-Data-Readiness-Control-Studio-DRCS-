import path from 'node:path';
import { expect, test } from '@playwright/test';

const FIXTURES = {
  buyers: path.resolve('e2e/fixtures/buyers.csv'),
  headers: path.resolve('e2e/fixtures/headers_invalid_codelist.csv'),
  lines: path.resolve('e2e/fixtures/lines_invalid_codelist.csv'),
};

const VALID_CREDIT_NOTE_HEADERS = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,principal_id,invoicing_period_start_date,invoicing_period_end_date,deliver_to_address_line_1,deliver_to_city,deliver_to_country_subdivision,deliver_to_country_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date
CN001,UAE-2025-CN-0001,2025-01-20,381,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,,,,,,,,2025-02-19,30,1.000000,500.00,25.00,525.00,525.00,S,5.00,ADJ,Price adjustment for original invoice,UAE-2024-1099,2024-12-31`;

const INVALID_CREDIT_NOTE_HEADERS = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,principal_id,invoicing_period_start_date,invoicing_period_end_date,deliver_to_address_line_1,deliver_to_city,deliver_to_country_subdivision,deliver_to_country_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date
CN002,UAE-2025-CN-0002,2025-01-21,381,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,,,,,,,,2025-02-20,30,1.000000,500.00,25.00,525.00,525.00,S,5.00,,,,`;

const PARTIAL_READINESS_CREDIT_NOTE_HEADERS = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,principal_id,invoicing_period_start_date,invoicing_period_end_date,deliver_to_address_line_1,deliver_to_city,deliver_to_country_subdivision,deliver_to_country_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date
CN003,UAE-2025-CN-0003,2025-01-22,381,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,,,,,,,,2025-02-21,30,1.000000,500.00,25.00,525.00,525.00,S,5.00,ADJ,,UAE-2024-1100,`;

const CREDIT_NOTE_LINES = `line_id,invoice_id,line_number,description,quantity,unit_of_measure,unit_price,line_discount,line_total_excl_vat,vat_rate,vat_amount,tax_category_code
LCN001,CN001,1,Credit adjustment for consulting services,5,EA,100.00,0.00,500.00,5.00,25.00,S`;

async function uploadAndRunChecks(
  page: Parameters<typeof test>[1] extends never ? never : any,
  input: { buyers: string; headers: string; lines: string } | { buyers: { name: string; mimeType: string; buffer: Buffer }; headers: { name: string; mimeType: string; buffer: Buffer }; lines: { name: string; mimeType: string; buffer: Buffer } }
) {
  await page.goto('/upload');

  await page.setInputFiles('input[aria-label="Buyers File CSV upload"]', input.buyers as any);
  await page.setInputFiles('input[aria-label="Invoice Headers File CSV upload"]', input.headers as any);
  await page.setInputFiles('input[aria-label="Invoice Lines File CSV upload"]', input.lines as any);

  const loadButton = page.getByRole('button', { name: 'Load Data & Continue' });
  await expect(loadButton).toBeEnabled();
  await loadButton.click();

  await expect(page).toHaveURL(/\/run$/);
  await expect(page.getByRole('heading', { name: 'Run Compliance Checks' })).toBeVisible();

  const runButton = page.getByRole('button', { name: /Run All Checks \(/ });
  await expect(runButton).toBeEnabled();
  await runButton.click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

test('smoke: upload -> run checks -> exceptions shows codelist failures', async ({ page }) => {
  await uploadAndRunChecks(page, FIXTURES);

  await page.getByRole('link', { name: 'Exceptions' }).first().click();
  await expect(page).toHaveURL(/\/exceptions/);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await expect(page.getByText('3 of 3 exceptions shown')).toBeVisible();

  await expect(page.getByText('Seller Country Code ISO3166')).toBeVisible();
  await expect(page.getByText('Payment Means Code UNCL4461')).toBeVisible();
  await expect(page.getByText('Unit Of Measure Code UNECE Rec20')).toBeVisible();
});

test('smoke: valid credit note passes without live exceptions', async ({ page }) => {
  await uploadAndRunChecks(page, {
    buyers: FIXTURES.buyers,
    headers: {
      name: 'credit_note_valid_headers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(VALID_CREDIT_NOTE_HEADERS),
    },
    lines: {
      name: 'credit_note_lines.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CREDIT_NOTE_LINES),
    },
  });

  await page.getByRole('link', { name: 'Exceptions' }).first().click();
  await expect(page).toHaveURL(/\/exceptions/);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await expect(page.getByText('0 of 0 exceptions shown')).toBeVisible();
  await expect(page.getByText('No exceptions match your filters')).toBeVisible();
});

test('smoke: credit-note dashboard widget reflects the new readiness fields', async ({ page }) => {
  await uploadAndRunChecks(page, {
    buyers: FIXTURES.buyers,
    headers: {
      name: 'credit_note_readiness_headers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(PARTIAL_READINESS_CREDIT_NOTE_HEADERS),
    },
    lines: {
      name: 'credit_note_lines.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CREDIT_NOTE_LINES.replaceAll('CN001', 'CN003')),
    },
  });

  const creditNoteCard = page.locator('section').filter({ hasText: 'Credit-Note Scenarios' }).first();
  await expect(creditNoteCard.getByText('Credit-Note Scenarios')).toBeVisible();
  await expect(creditNoteCard.getByText('Reason-code completeness 100%')).toBeVisible();
  await expect(creditNoteCard.getByText('Reason-text completeness 0%')).toBeVisible();
  await expect(creditNoteCard.getByText('Preceding reference completeness 100%')).toBeVisible();
  await expect(creditNoteCard.getByText('Preceding issue-date completeness 0%')).toBeVisible();
  await expect(creditNoteCard.getByText('Overall scenario coverage 0%')).toBeVisible();
});

test('smoke: invalid credit note shows new credit-note validation failures', async ({ page }) => {
  await uploadAndRunChecks(page, {
    buyers: FIXTURES.buyers,
    headers: {
      name: 'credit_note_invalid_headers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(INVALID_CREDIT_NOTE_HEADERS),
    },
    lines: {
      name: 'credit_note_lines.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CREDIT_NOTE_LINES.replaceAll('CN001', 'CN002')),
    },
  });

  await page.getByRole('link', { name: 'Exceptions' }).first().click();
  await expect(page).toHaveURL(/\/exceptions/);
  await expect(page.getByText('2 of 2 exceptions shown')).toBeVisible();
  await expect(page.getByText('Credit Note Reason Code Presence')).toBeVisible();
  await expect(page.getByText('Credit Note Preceding Invoice Reference Presence')).toBeVisible();
});
