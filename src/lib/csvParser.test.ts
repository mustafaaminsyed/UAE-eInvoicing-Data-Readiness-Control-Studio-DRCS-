import { describe, expect, it } from 'vitest';
import { analyzeFile } from '@/components/upload/FileAnalysis';
import { parseCSV, parseHeadersFile } from '@/lib/csvParser';
import { headersNegativeSample } from '@/lib/sampleData';

describe('negative headers template upload path', () => {
  it('parses rows and columns for the downloadable negative headers template', () => {
    const rows = parseCSV(headersNegativeSample);
    const file = new File([headersNegativeSample], 'invoice_headers_template_negative.csv', { type: 'text/csv' });
    const analysis = analyzeFile(rows, file, 'headers', 'AR', headersNegativeSample);

    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0] ?? {})).toHaveLength(36);
    expect(analysis.rowCount).toBe(3);
    expect(analysis.columnCount).toBe(36);
    expect(analysis.columns).toContain('invoice_id');
    expect(analysis.columns).toContain('buyer_id');
  });

  it('maps credit note header fields when present', async () => {
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,seller_trn,buyer_id,currency,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date',
      'INV-CN-001,CN-001,2026-06-10,381,100000000000003,BUY-001,AED,ADJ,Price adjustment,INV-0001,2026-05-31',
    ].join('\n');

    const file = {
      text: async () => csv,
    } as File;
    const [header] = await parseHeadersFile(file);

    expect(header.credit_note_reason_code).toBe('ADJ');
    expect(header.credit_note_reason_text).toBe('Price adjustment');
    expect(header.preceding_invoice_reference).toBe('INV-0001');
    expect(header.preceding_invoice_issue_date).toBe('2026-05-31');
  });

  it('maps credit note reason text aliases when description is used as the header name', async () => {
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,seller_trn,buyer_id,currency,credit_note_reason_code,credit_note_reason_description',
      'INV-CN-002,CN-002,2026-06-10,381,100000000000003,BUY-001,AED,ADJ,Commercial adjustment narrative',
    ].join('\n');

    const file = {
      text: async () => csv,
    } as File;
    const [header] = await parseHeadersFile(file);

    expect(header.credit_note_reason_text).toBe('Commercial adjustment narrative');
  });
});
