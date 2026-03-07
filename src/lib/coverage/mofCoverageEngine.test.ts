import { describe, expect, it } from 'vitest';
import { computeMoFCoverage } from '@/lib/coverage/mofCoverageEngine';

describe('mofCoverageEngine', () => {
  it('uses MoF source-truth totals by document_type', () => {
    const tax = computeMoFCoverage('tax_invoice');
    const commercial = computeMoFCoverage('commercial_xml');

    expect(tax.totalFields).toBe(51);
    expect(tax.mandatoryFields).toBe(51);
    expect(commercial.totalFields).toBe(49);
    expect(commercial.mandatoryFields).toBe(49);
  });

  it('keeps tax/commercial divergence explicit at field tail', () => {
    const tax = computeMoFCoverage('tax_invoice');
    const commercial = computeMoFCoverage('commercial_xml');

    expect(tax.rows.some((row) => row.fieldId === 51)).toBe(true);
    expect(commercial.rows.some((row) => row.fieldId === 51)).toBe(false);
    expect(commercial.rows.some((row) => row.fieldId === 49)).toBe(true);
  });

  it('does not conflate document_type with AR/AP direction inputs', () => {
    const tax = computeMoFCoverage('tax_invoice', {
      buyers: ['buyer_name', 'buyer_trn'],
      headers: ['invoice_number', 'issue_date'],
      lines: ['line_id', 'quantity'],
    });
    expect(tax.documentType).toBe('tax_invoice');
    expect(tax.rows.every((row) => row.documentType === 'tax_invoice')).toBe(true);
  });

  it('marks fields as NOT_IN_TEMPLATE when provided mapped columns are incomplete', () => {
    const result = computeMoFCoverage('commercial_xml', {
      buyers: ['buyer_name'],
      headers: ['invoice_number'],
      lines: ['line_id'],
    });

    expect(result.mandatoryNotInTemplate).toBeGreaterThan(0);
    expect(result.rows.some((row) => row.status === 'NOT_IN_TEMPLATE')).toBe(true);
  });

  it('keeps commercial field 7 and 8 unresolved literals without hardcoding values', () => {
    const result = computeMoFCoverage('commercial_xml');
    const field7 = result.rows.find((row) => row.fieldId === 7);
    const field8 = result.rows.find((row) => row.fieldId === 8);

    expect(field7?.sourceStatus).toBe('source_literal_with_pending_literal_confirmation');
    expect(field8?.sourceStatus).toBe('source_literal_with_pending_literal_confirmation');
  });
});

