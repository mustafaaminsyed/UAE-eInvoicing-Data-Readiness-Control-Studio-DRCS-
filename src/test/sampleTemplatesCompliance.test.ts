import { describe, expect, it } from 'vitest';
import { parseCSV } from '@/lib/csvParser';
import { buyersSample, headersSample, linesSample } from '@/lib/sampleData';
import { runAllChecks } from '@/lib/checks/checksRegistry';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';

function buildContext(data: Awaited<ReturnType<typeof loadSamples>>): DataContext {
  const buyerMap = new Map(data.buyers.map((b) => [b.buyer_id, b]));
  const headerMap = new Map(data.headers.map((h) => [h.invoice_id, h]));
  const linesByInvoice = new Map<string, typeof data.lines>();
  data.lines.forEach((line) => {
    const existing = linesByInvoice.get(line.invoice_id) ?? [];
    existing.push(line);
    linesByInvoice.set(line.invoice_id, existing);
  });

  return {
    buyers: data.buyers,
    headers: data.headers,
    lines: data.lines,
    buyerMap,
    headerMap,
    linesByInvoice,
  };
}

async function loadSamples() {
  const buyerRows = parseCSV(buyersSample);
  const headerRows = parseCSV(headersSample);
  const lineRows = parseCSV(linesSample);

  const buyers: Buyer[] = buyerRows.map((r) => ({
    buyer_id: r.buyer_id,
    buyer_name: r.buyer_name,
    buyer_trn: r.buyer_trn,
    buyer_address: r.buyer_address,
    buyer_country: r.buyer_country,
    buyer_city: r.buyer_city,
    buyer_subdivision: r.buyer_subdivision,
    buyer_electronic_address: r.buyer_electronic_address,
  }));

  const headers: InvoiceHeader[] = headerRows.map((r) => ({
    invoice_id: r.invoice_id,
    invoice_number: r.invoice_number,
    issue_date: r.issue_date,
    invoice_type: r.invoice_type,
    seller_trn: r.seller_trn,
    seller_name: r.seller_name,
    seller_address: r.seller_address,
    seller_city: r.seller_city,
    seller_country: r.seller_country,
    seller_subdivision: r.seller_subdivision,
    seller_electronic_address: r.seller_electronic_address,
    seller_legal_reg_id: r.seller_legal_reg_id,
    seller_legal_reg_id_type: r.seller_legal_reg_id_type,
    buyer_id: r.buyer_id,
    currency: r.currency,
    transaction_type_code: r.transaction_type_code,
    payment_due_date: r.payment_due_date,
    payment_means_code: r.payment_means_code,
    fx_rate: Number(r.fx_rate),
    total_excl_vat: Number(r.total_excl_vat),
    vat_total: Number(r.vat_total),
    total_incl_vat: Number(r.total_incl_vat),
    amount_due: Number(r.amount_due),
    tax_category_code: r.tax_category_code,
    tax_category_rate: Number(r.tax_category_rate),
  }));

  const lines: InvoiceLine[] = lineRows.map((r) => ({
    line_id: r.line_id,
    invoice_id: r.invoice_id,
    line_number: Number(r.line_number),
    description: r.description,
    quantity: Number(r.quantity),
    unit_of_measure: r.unit_of_measure,
    unit_price: Number(r.unit_price),
    line_discount: Number(r.line_discount),
    line_total_excl_vat: Number(r.line_total_excl_vat),
    vat_rate: Number(r.vat_rate),
    vat_amount: Number(r.vat_amount),
    tax_category_code: r.tax_category_code,
  }));

  return { buyers, headers, lines };
}

describe('Downloadable sample templates', () => {
  it('pass built-in and PINT-AE checks without exceptions', async () => {
    const parsed = await loadSamples();
    const context = buildContext(parsed);

    const builtInExceptions = runAllChecks(context).flatMap((r) => r.exceptions);
    const pintExceptions = runAllPintAEChecks(UAE_UC1_CHECK_PACK, context);

    expect(builtInExceptions).toHaveLength(0);
    expect(pintExceptions).toHaveLength(0);
  });
});
