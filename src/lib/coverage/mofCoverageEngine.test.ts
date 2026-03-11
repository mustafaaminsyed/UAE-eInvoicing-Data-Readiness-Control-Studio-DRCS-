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

  it('keeps field 24 and 25 semantics split by document type', () => {
    const tax = computeMoFCoverage('tax_invoice');
    const commercial = computeMoFCoverage('commercial_xml');

    const tax24 = tax.rows.find((row) => row.fieldId === 24);
    const commercial24 = commercial.rows.find((row) => row.fieldId === 24);
    const tax25 = tax.rows.find((row) => row.fieldId === 25);
    const commercial25 = commercial.rows.find((row) => row.fieldId === 25);

    expect(tax24?.fieldName).toBe('Buyer tax identifier');
    expect(commercial24?.fieldName).toBe('Buyer legal registration identifier');
    expect(tax25?.fieldName).toBe('Buyer tax scheme code');
    expect(commercial25?.fieldName).toBe('Buyer legal registration identifier type');
  });

  it('keeps field 38 mapping from crosswalk with explicit source columns', () => {
    const tax = computeMoFCoverage('tax_invoice');
    const commercial = computeMoFCoverage('commercial_xml');

    const tax38 = tax.rows.find((row) => row.fieldId === 38);
    const commercial38 = commercial.rows.find((row) => row.fieldId === 38);

    expect(tax38?.columns).toContain('tax_category_rate');
    expect(tax38?.columns).toContain('vat_rate');
    expect(commercial38?.columns).toContain('tax_category_rate');
    expect(commercial38?.columns).toContain('vat_rate');
  });

  it('maps commercial field 49 as item description instead of dropping bridge linkage', () => {
    const commercial = computeMoFCoverage('commercial_xml');
    const commercial49 = commercial.rows.find((row) => row.fieldId === 49);

    expect(commercial49).toBeDefined();
    expect(commercial49?.fieldName).toBe('Item description');
    expect(commercial49?.status).not.toBe('NO_BRIDGE');
    expect(commercial49?.columns[0]).toBe('description');
  });

  it('does not swap tax field 50 and 51 semantics', () => {
    const tax = computeMoFCoverage('tax_invoice');
    const tax50 = tax.rows.find((row) => row.fieldId === 50);
    const tax51 = tax.rows.find((row) => row.fieldId === 51);

    expect(tax50?.fieldName).toBe('Item name');
    expect(tax51?.fieldName).toBe('Item description');
    expect(tax50?.columns[0]).toBe('item_name');
    expect(tax51?.columns[0]).toBe('description');
  });
});

