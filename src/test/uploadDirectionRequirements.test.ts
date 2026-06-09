import { describe, expect, it } from 'vitest';
import { analyzeFile } from '@/components/upload/FileAnalysis';

describe('upload structural requirements by direction', () => {
  it('requires supplier_id on AP header files', () => {
    const rows = [
      {
        invoice_id: 'INV-1',
        invoice_number: 'INV-1',
        issue_date: '2026-01-01',
        seller_trn: '100000000000001',
        buyer_id: 'CUST-1',
        currency: 'AED',
      },
    ];
    const file = new File(['test'], 'headers.csv', { type: 'text/csv' });
    const analysis = analyzeFile(rows, file, 'headers', 'AP');

    expect(analysis.requiredMissing).toContain('supplier_id');
  });

  it('does not require supplier_id on AR header files', () => {
    const rows = [
      {
        invoice_id: 'INV-1',
        invoice_number: 'INV-1',
        issue_date: '2026-01-01',
        seller_trn: '100000000000001',
        buyer_id: 'CUST-1',
        currency: 'AED',
      },
    ];
    const file = new File(['test'], 'headers.csv', { type: 'text/csv' });
    const analysis = analyzeFile(rows, file, 'headers', 'AR');

    expect(analysis.requiredMissing).not.toContain('supplier_id');
  });

  it('infers supplier_id as the primary key candidate for AP party files', () => {
    const rows = [
      {
        supplier_id: 'SUP-1',
        supplier_name: 'Vendor One',
        supplier_trn: '100000000000003',
      },
    ];
    const file = new File(['test'], 'suppliers.csv', { type: 'text/csv' });
    const analysis = analyzeFile(rows, file, 'buyers', 'AP');

    expect(analysis.inferredPK).toBe('supplier_id');
    expect(analysis.requiredMissing).not.toContain('supplier_id');
  });

  it('keeps header columns visible when no valid data rows are parsed', () => {
    const file = new File(['test'], 'headers.csv', { type: 'text/csv' });
    const analysis = analyzeFile(
      [],
      file,
      'headers',
      'AR',
      'invoice_id,invoice_number,issue_date\n'
    );

    expect(analysis.columnCount).toBe(3);
    expect(analysis.columns).toEqual(['invoice_id', 'invoice_number', 'issue_date']);
  });
});

