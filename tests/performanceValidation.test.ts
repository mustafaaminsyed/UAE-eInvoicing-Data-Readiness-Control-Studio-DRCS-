import { describe, expect, it } from 'vitest';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';

function buildSyntheticContext(invoiceCount = 75, linesPerInvoice = 3): DataContext {
  const headers: InvoiceHeader[] = [];
  const buyers = [];
  const lines: InvoiceLine[] = [];

  for (let index = 0; index < invoiceCount; index++) {
    const invoiceId = `INV-${index + 1}`;
    const buyerId = `BUY-${index + 1}`;
    buyers.push({
      buyer_id: buyerId,
      buyer_name: `Buyer ${index + 1}`,
      buyer_trn: `1000000000000${String(index % 10).padStart(2, '0')}`,
      buyer_country: 'AE',
      buyer_electronic_address: `ae:${buyerId}`,
      buyer_address: 'Abu Dhabi',
    });
    headers.push({
      invoice_id: invoiceId,
      invoice_number: `A-${1000 + index}`,
      issue_date: '2026-03-01',
      seller_trn: '100123456700003',
      buyer_id: buyerId,
      currency: 'AED',
      invoice_type: '380',
      seller_name: 'Seller LLC',
      seller_address: 'Dubai',
      seller_city: 'Dubai',
      seller_country: 'AE',
      seller_subdivision: 'AE-DU',
      seller_electronic_address: 'ae:seller',
      total_excl_vat: 315,
      vat_total: 15.75,
      total_incl_vat: 330.75,
      amount_due: 330.75,
      tax_category_code: 'S',
      tax_category_rate: 5,
      payment_due_date: '2026-03-31',
      payment_means_code: '30',
      spec_id: 'urn:peppol:pint:billing-1@ae-1',
      business_process: 'urn:peppol:bis:billing',
    } as InvoiceHeader);

    for (let lineIndex = 0; lineIndex < linesPerInvoice; lineIndex++) {
      lines.push({
        line_id: `${invoiceId}-L-${lineIndex + 1}`,
        invoice_id: invoiceId,
        line_number: lineIndex + 1,
        quantity: 1,
        unit_price: 100 + lineIndex,
        line_total_excl_vat: 100 + lineIndex,
        vat_rate: 5,
        vat_amount: Number(((100 + lineIndex) * 0.05).toFixed(2)),
        unit_of_measure: 'EA',
        tax_category_code: 'S',
        item_name: `Item ${lineIndex + 1}`,
        description: `Description ${lineIndex + 1}`,
      });
    }
  }

  const buyerMap = new Map(buyers.map((buyer) => [buyer.buyer_id, buyer]));
  const headerMap = new Map(headers.map((header) => [header.invoice_id, header]));
  const linesByInvoice = new Map<string, InvoiceLine[]>();
  for (const line of lines) {
    const invoiceLines = linesByInvoice.get(line.invoice_id) ?? [];
    invoiceLines.push(line);
    linesByInvoice.set(line.invoice_id, invoiceLines);
  }

  return { buyers, headers, lines, buyerMap, headerMap, linesByInvoice };
}

describe('validation performance guard', () => {
  it('keeps runtime validation within an acceptable bound for a medium invoice batch', () => {
    const context = buildSyntheticContext();
    const startedAt = Date.now();

    const exceptions = runAllPintAEChecks(UAE_UC1_CHECK_PACK, context);
    const elapsedMs = Date.now() - startedAt;

    expect(exceptions.length).toBeGreaterThanOrEqual(0);
    expect(elapsedMs).toBeLessThan(5000);
  });
});
