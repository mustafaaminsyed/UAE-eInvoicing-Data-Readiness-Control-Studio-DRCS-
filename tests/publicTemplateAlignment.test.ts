import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCSV } from '@/lib/csvParser';
import { TEMPLATE_MANIFEST } from '@/lib/sampleData';

function readTemplate(fileName: string) {
  return readFileSync(join(process.cwd(), 'public', 'templates', fileName), 'utf8');
}

describe('public template alignment', () => {
  it('keeps the shipped header template aligned with the current credit-note ingestion shape', () => {
    const rows = parseCSV(readTemplate('invoice_headers_template.csv'));
    const columns = Object.keys(rows[0] ?? {});

    expect(columns).toContain('credit_note_reason_code');
    expect(columns).toContain('credit_note_reason_text');
    expect(columns).toContain('preceding_invoice_reference');
    expect(columns).toContain('preceding_invoice_issue_date');
    expect(columns).toHaveLength(36);
  });

  it('keeps the shipped line template aligned with the current conditional line field shape', () => {
    const rows = parseCSV(readTemplate('invoice_lines_template.csv'));
    const columns = Object.keys(rows[0] ?? {});

    expect(columns).toContain('item_name');
    expect(columns).toContain('exemption_reason_code');
    expect(columns).toContain('exemption_reason_text');
    expect(columns).toContain('goods_service_type');
    expect(columns).toContain('line_allowance_amount');
    expect(columns).toContain('line_charge_amount');
    expect(columns).toHaveLength(18);
  });

  it('matches the in-app template manifest column counts', () => {
    const expected = new Map(TEMPLATE_MANIFEST.templates.map((template) => [template.file, template.columns]));

    for (const [fileName, count] of expected) {
      const rows = parseCSV(readTemplate(fileName));
      const columns = Object.keys(rows[0] ?? {});
      expect(columns).toHaveLength(count);
    }
  });
});
