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
});

