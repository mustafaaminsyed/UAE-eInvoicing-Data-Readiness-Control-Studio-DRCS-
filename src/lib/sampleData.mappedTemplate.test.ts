import { describe, expect, it } from 'vitest';
import { buildMappedTemplateExport } from '@/lib/sampleData';

describe('buildMappedTemplateExport', () => {
  it('keeps AR header exports in canonical template order', () => {
    const result = buildMappedTemplateExport(
      'headers',
      ['seller_name', 'invoice_number', 'issue_date'],
      'AR',
      'ACME Header Mapping'
    );

    expect(result.columns).toEqual(['invoice_number', 'issue_date', 'seller_name']);
    expect(result.content).toBe('invoice_number,issue_date,seller_name\n');
    expect(result.filename).toBe('acme_header_mapping_invoice_headers_template_mapped.csv');
  });

  it('maps AP supplier template columns back to canonical buyer fields before export', () => {
    const result = buildMappedTemplateExport(
      'buyers',
      ['buyer_name', 'buyer_trn', 'buyer_country'],
      'AP',
      'AP Party Mapping'
    );

    expect(result.columns).toEqual(['supplier_name', 'supplier_trn', 'supplier_country']);
    expect(result.content).toBe('supplier_name,supplier_trn,supplier_country\n');
  });

  it('returns an empty export when no mapped fields belong to the requested dataset', () => {
    const result = buildMappedTemplateExport('lines', ['invoice_number', 'issue_date'], 'AR');

    expect(result.columns).toEqual([]);
    expect(result.content).toBe('');
  });
});
