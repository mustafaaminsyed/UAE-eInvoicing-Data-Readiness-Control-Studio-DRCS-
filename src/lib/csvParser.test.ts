import { describe, expect, it } from 'vitest';
import { analyzeFile } from '@/components/upload/FileAnalysis';
import { parseCSV } from '@/lib/csvParser';
import { headersNegativeSample } from '@/lib/sampleData';

describe('negative headers template upload path', () => {
  it('parses rows and columns for the downloadable negative headers template', () => {
    const rows = parseCSV(headersNegativeSample);
    const file = new File([headersNegativeSample], 'invoice_headers_template_negative.csv', { type: 'text/csv' });
    const analysis = analyzeFile(rows, file, 'headers', 'AR', headersNegativeSample);

    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0] ?? {})).toHaveLength(32);
    expect(analysis.rowCount).toBe(3);
    expect(analysis.columnCount).toBe(32);
    expect(analysis.columns).toContain('invoice_id');
    expect(analysis.columns).toContain('buyer_id');
  });
});
