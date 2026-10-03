import { describe, expect, it } from 'vitest';
import { getDREntry } from '@/lib/registry/drRegistry';
import { generateMappingSuggestions } from '@/lib/mapping/mappingSuggester';

describe('P1.4 derived-field mapping alignment', () => {
  it.each([
    ['IBT-116', 'total_excl_vat'],
    ['IBT-117', 'vat_total'],
  ])('%s is derived from line grouping prerequisites, not document total %s', (term, forbidden) => {
    const entry = getDREntry(term)!;
    expect(entry.asp_derived).toBe(true);
    expect(entry.dataset_file).toBe('lines');
    expect(entry.internal_column_names).toEqual(['line_total_excl_vat', 'tax_category_code', 'vat_rate']);
    expect(entry.internal_column_names).not.toContain(forbidden);
  });

  it('keeps document-total heuristic suggestions on IBT-109/110 canonical fields', () => {
    const suggestions = generateMappingSuggestions(
      ['total_excl_vat', 'vat_total'],
      [{ total_excl_vat: '100', vat_total: '5' }],
      'header'
    );
    expect(suggestions.map((item) => item.targetField.ibtReference)).toEqual(expect.arrayContaining(['IBT-109', 'IBT-110']));
    expect(suggestions.map((item) => item.targetField.ibtReference)).not.toEqual(expect.arrayContaining(['IBT-116', 'IBT-117']));
  });
});
