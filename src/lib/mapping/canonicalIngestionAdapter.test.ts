import { describe, expect, it } from 'vitest';
import { getPintFieldById, type FieldMapping } from '@/types/fieldMapping';
import { buildCanonicalCsv, toCanonicalFieldMappings } from '@/lib/mapping/canonicalIngestionAdapter';
import { canonicalizeSourceRows } from '@/lib/mapping/canonicalizationEngine';

function mapping(sourceColumn: string, targetFieldId: string): FieldMapping {
  const targetField = getPintFieldById(targetFieldId);
  if (!targetField) throw new Error(`Unknown field ${targetFieldId}`);
  return {
    id: `${sourceColumn}-${targetFieldId}`,
    erpColumn: sourceColumn,
    erpColumnIndex: 0,
    targetField,
    confidence: 1,
    isConfirmed: true,
    transformations: [],
    sampleValues: [],
  };
}

describe('canonical ingestion adapter', () => {
  it('routes fields to canonical datasets and excludes relationship-controlled fields', () => {
    const result = toCanonicalFieldMappings([
      mapping('Customer', 'buyer_name'),
      mapping('Invoice', 'invoice_number'),
      mapping('Item', 'item_name'),
      mapping('TaxCode', 'tax_category_code'),
      mapping('InvoiceKey', 'invoice_id'),
    ], 'AR');

    expect(result.map(({ targetDataset, targetField }) => `${targetDataset}.${targetField}`)).toEqual([
      'buyers.buyer_name',
      'headers.invoice_number',
      'lines.item_name',
      'lines.tax_category_code',
    ]);
  });

  it('exports populated canonical CSVs in template order and escapes client values', () => {
    const result = canonicalizeSourceRows({
      sourceFile: 'client.csv',
      keyScope: 'tenant-a',
      rows: [{ buyer: 'B1', invoice: 'INV-1', line: '1', customer: 'Acme, LLC', number: '100', item: 'Service' }],
      mappings: toCanonicalFieldMappings([
        mapping('customer', 'buyer_name'),
        mapping('number', 'invoice_number'),
        mapping('item', 'item_name'),
      ], 'AR'),
      relationships: {
        buyerKey: { mode: 'source', sourceColumns: ['buyer'] },
        invoiceKey: { mode: 'source', sourceColumns: ['invoice'] },
        lineKey: { mode: 'generated', sourceColumns: ['invoice', 'line'] },
        lineNumberColumn: 'line',
      },
    });

    expect(result.canExport).toBe(true);
    const buyers = buildCanonicalCsv(result, 'buyers', 'AR').split('\n');
    const headers = buildCanonicalCsv(result, 'headers', 'AR').split('\n');
    const lines = buildCanonicalCsv(result, 'lines', 'AR').split('\n');
    expect(buyers[0]).toBe('buyer_id,buyer_name,buyer_trn,buyer_legal_reg_id,buyer_legal_reg_id_type,buyer_address,buyer_country,buyer_city,buyer_subdivision,buyer_electronic_address');
    expect(buyers[1]).toContain('B1,"Acme, LLC"');
    expect(headers[1]).toContain('INV-1,100');
    expect(lines[1]).toContain(',INV-1,1,');
  });

  it('uses supplier template labels for AP while retaining canonical buyer fields internally', () => {
    const result = canonicalizeSourceRows({
      sourceFile: 'ap.csv',
      rows: [{ supplier: 'S1', invoice: 'AP-1', line: '1', name: 'Supplier LLC' }],
      mappings: toCanonicalFieldMappings([mapping('name', 'buyer_name')], 'AP'),
      relationships: {
        buyerKey: { mode: 'source', sourceColumns: ['supplier'] },
        invoiceKey: { mode: 'source', sourceColumns: ['invoice'] },
        lineKey: { mode: 'generated', sourceColumns: ['invoice', 'line'] },
      },
    });

    const csv = buildCanonicalCsv(result, 'buyers', 'AP');
    expect(csv.split('\n')[0]).toMatch(/^supplier_id,supplier_name,/);
    expect(csv.split('\n')[1]).toMatch(/^S1,Supplier LLC,/);
  });
});
