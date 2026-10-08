import { describe, expect, it } from 'vitest';
import { canonicalizeSourceRows } from '@/lib/mapping/canonicalizationEngine';
import type { CanonicalizationInput } from '@/types/canonicalIngestion';

function input(overrides: Partial<CanonicalizationInput> = {}): CanonicalizationInput {
  return {
    sourceFile: 'client-flat.csv',
    rows: [
      { customer: 'C100', customer_name: 'Example LLC', invoice: 'INV-1', line: '10', invoice_date: '01/10/2026', item: 'Consulting', quantity: '2', net: '1000' },
      { customer: 'C100', customer_name: 'Example LLC', invoice: 'INV-1', line: '20', invoice_date: '01/10/2026', item: 'Support', quantity: '1', net: '500' },
    ],
    mappings: [
      { id: 'buyer-name', sourceColumn: 'customer_name', targetDataset: 'buyers', targetField: 'buyer_name', targetDataType: 'string', transformations: [] },
      { id: 'invoice-number', sourceColumn: 'invoice', targetDataset: 'headers', targetField: 'invoice_number', targetDataType: 'string', transformations: [] },
      { id: 'invoice-date', sourceColumn: 'invoice_date', targetDataset: 'headers', targetField: 'issue_date', targetDataType: 'date', transformations: [{ type: 'date_parse', config: { inputFormat: 'DD/MM/YYYY', outputFormat: 'YYYY-MM-DD' } }] },
      { id: 'item-name', sourceColumn: 'item', targetDataset: 'lines', targetField: 'item_name', targetDataType: 'string', transformations: [] },
      { id: 'quantity', sourceColumn: 'quantity', targetDataset: 'lines', targetField: 'quantity', targetDataType: 'number', transformations: [] },
      { id: 'net', sourceColumn: 'net', targetDataset: 'lines', targetField: 'line_total_excl_vat', targetDataType: 'number', transformations: [] },
    ],
    relationships: {
      buyerKey: { mode: 'source', sourceColumns: ['customer'] },
      invoiceKey: { mode: 'source', sourceColumns: ['invoice'] },
      lineKey: { mode: 'source', sourceColumns: ['line'] },
      lineNumberColumn: 'line',
    },
    ...overrides,
  };
}

describe('canonicalizeSourceRows', () => {
  it('splits a flat source into linked, deduplicated canonical records', () => {
    const result = canonicalizeSourceRows(input());
    expect(result.canExport).toBe(true);
    expect(result.buyers).toEqual([expect.objectContaining({ buyer_id: 'C100', buyer_name: 'Example LLC' })]);
    expect(result.headers).toEqual([expect.objectContaining({ invoice_id: 'INV-1', buyer_id: 'C100', issue_date: '2026-10-01' })]);
    expect(result.lines).toEqual([
      expect.objectContaining({ line_id: '10', invoice_id: 'INV-1', line_number: 10, item_name: 'Consulting', quantity: 2 }),
      expect.objectContaining({ line_id: '20', invoice_id: 'INV-1', line_number: 20, item_name: 'Support', quantity: 1 }),
    ]);
  });

  it('generates stable identifiers only when configured and records their provenance', () => {
    const configured = input({ keyScope: 'tenant-a|entity-1|mapping-v1', relationships: {
      buyerKey: { mode: 'generated', sourceColumns: ['customer_name'], prefix: 'BUY' },
      invoiceKey: { mode: 'generated', sourceColumns: ['invoice'], prefix: 'DOC' },
      lineKey: { mode: 'generated', sourceColumns: ['invoice', 'line'], prefix: 'ROW' },
    } });
    const first = canonicalizeSourceRows(configured);
    const second = canonicalizeSourceRows(configured);
    expect(first.buyers[0].buyer_id).toBe(second.buyers[0].buyer_id);
    expect(first.headers[0].invoice_id).toBe(second.headers[0].invoice_id);
    expect(first.lines.map((line) => line.line_id)).toEqual(second.lines.map((line) => line.line_id));
    expect(first.provenance).toContainEqual(expect.objectContaining({ targetField: 'buyer_id', origin: 'generated' }));
    const otherScope = canonicalizeSourceRows({ ...configured, keyScope: 'tenant-b|entity-1|mapping-v1' });
    expect(otherScope.buyers[0].buyer_id).not.toBe(first.buyers[0].buyer_id);
  });

  it('leaves absent mapped values absent and independently attributed', () => {
    const result = canonicalizeSourceRows(input({
      rows: [{ customer: 'C100', customer_name: 'Example LLC', invoice: 'INV-1', line: '1', item: 'Name only', description: '' }],
      mappings: [
        { id: 'name', sourceColumn: 'item', targetDataset: 'lines', targetField: 'item_name', transformations: [] },
        { id: 'description', sourceColumn: 'description', targetDataset: 'lines', targetField: 'description', transformations: [] },
      ],
    }));
    expect(result.lines[0].item_name).toBe('Name only');
    expect(result.lines[0].description).toBeUndefined();
    expect(result.provenance).toContainEqual(expect.objectContaining({ targetField: 'description', origin: 'missing', outputValue: '' }));
  });

  it('records line-number provenance and blocks invalid configured values', () => {
    const generated = canonicalizeSourceRows(input({
      relationships: {
        buyerKey: { mode: 'source', sourceColumns: ['customer'] },
        invoiceKey: { mode: 'source', sourceColumns: ['invoice'] },
        lineKey: { mode: 'source', sourceColumns: ['line'] },
      },
    }));
    expect(generated.provenance).toContainEqual(expect.objectContaining({
      targetField: 'line_number', outputValue: '1', origin: 'generated',
    }));

    const invalid = canonicalizeSourceRows(input({
      rows: [{ customer: 'C100', invoice: 'INV-1', line: 'line-a' }],
      mappings: [],
    }));
    expect(invalid.canExport).toBe(false);
    expect(invalid.lines[0].line_number).toBe(1);
    expect(invalid.diagnostics).toContainEqual(expect.objectContaining({
      code: 'invalid_number', targetField: 'line_number', sourceRow: 2,
    }));
    expect(invalid.provenance).toContainEqual(expect.objectContaining({
      targetField: 'line_number', sourceColumn: 'line', sourceValue: 'line-a',
      outputValue: '1', origin: 'generated',
    }));
  });

  it('blocks conflicting repeated header facts', () => {
    const result = canonicalizeSourceRows(input({
      rows: [
        { customer: 'C100', invoice: 'INV-1', line: '1', currency: 'AED' },
        { customer: 'C100', invoice: 'INV-1', line: '2', currency: 'USD' },
      ],
      mappings: [{ id: 'currency', sourceColumn: 'currency', targetDataset: 'headers', targetField: 'currency', transformations: [] }],
    }));
    expect(result.canExport).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'conflicting_record', targetField: 'currency' }));
  });

  it('blocks transformation failures instead of restoring the raw value', () => {
    const result = canonicalizeSourceRows(input({
      rows: [{ customer: 'C100', invoice: 'INV-1', line: '1', invoice_date: 'not-a-date' }],
      mappings: [{ id: 'date', sourceColumn: 'invoice_date', targetDataset: 'headers', targetField: 'issue_date', transformations: [{ type: 'date_parse', config: { inputFormat: 'DD/MM/YYYY', outputFormat: 'YYYY-MM-DD' } }] }],
    }));
    expect(result.canLoadDiagnosticDataset).toBe(false);
    expect(result.headers[0].issue_date).toBeUndefined();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'transformation_failed', targetField: 'issue_date' }));
  });

  it('blocks missing keys and duplicate line identifiers', () => {
    const missing = canonicalizeSourceRows(input({ rows: [{ customer: '', invoice: 'INV-1', line: '1' }], mappings: [] }));
    expect(missing.diagnostics).toContainEqual(expect.objectContaining({ code: 'missing_key_source', targetField: 'buyer_id' }));
    const duplicate = canonicalizeSourceRows(input({
      rows: [{ customer: 'C100', invoice: 'INV-1', line: '1' }, { customer: 'C100', invoice: 'INV-1', line: '1' }], mappings: [],
    }));
    expect(duplicate.diagnostics).toContainEqual(expect.objectContaining({ code: 'duplicate_line_id', recordId: '1' }));
  });

  it('prevents field mappings from overwriting relationship keys', () => {
    const result = canonicalizeSourceRows(input({
      mappings: [{ id: 'bad-key', sourceColumn: 'customer_name', targetDataset: 'headers', targetField: 'buyer_id', transformations: [] }],
    }));
    expect(result.canExport).toBe(false);
    expect(result.headers[0].buyer_id).toBe('C100');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'reserved_relationship_field', targetField: 'buyer_id' }));
  });
});
