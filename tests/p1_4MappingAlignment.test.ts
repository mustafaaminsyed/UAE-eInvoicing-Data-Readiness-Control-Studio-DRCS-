import { describe, expect, it } from 'vitest';
import { getDREntry } from '@/lib/registry/drRegistry';
import { generateMappingSuggestions } from '@/lib/mapping/mappingSuggester';
import { PINT_AE_UC1_FIELDS } from '@/types/fieldMapping';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

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

  it('does not expose the single header compatibility rate as authoritative repeatable IBT-119', () => {
    const field = PINT_AE_UC1_FIELDS.find((item) => item.id === 'tax_category_rate')!;
    expect(field.ibtReference).toBe('SYS-HEADER-TAX-CATEGORY-RATE');
    expect(field.description).toContain('compatibility');
    expect(field.description).toContain('derived from grouped line vat_rate');
  });

  it('removes stale CHK-041 attribution while retaining its compatibility-field validation purpose', () => {
    const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === 'UAE-UC1-CHK-041')!;
    expect(check.pint_reference_terms).toEqual([]);
    expect(check.mof_rule_reference).toBeUndefined();
    expect(check.description).toContain('legacy header');
    expect(check.description).toContain('IBT-118 is derived');
    expect(getValidationDRTargets(check.check_id, { includeReferenceOnly: true })).toEqual([]);
  });
});
