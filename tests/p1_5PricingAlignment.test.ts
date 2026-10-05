import { describe, expect, it } from 'vitest';
import { generateMappingSuggestions } from '@/lib/mapping/mappingSuggester';
import { getDREntry } from '@/lib/registry/drRegistry';
import { getRegistryFieldByDR } from '@/lib/registry/specRegistry';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';

describe('P1.5 pricing alignment', () => {
  it('keeps source, optional source, derivation, and base quantity ownership distinct', () => {
    expect(getDREntry('IBT-146')?.internal_column_names).toEqual(['unit_price']);
    expect(getDREntry('IBT-147')?.internal_column_names).toEqual(['item_price_discount']);
    expect(getDREntry('IBT-148')).toMatchObject({ internal_column_names: ['unit_price', 'item_price_discount'], asp_derived: true });
    expect(getDREntry('IBT-149')?.internal_column_names).toEqual(['price_base_quantity']);
    expect(getRegistryFieldByDR('IBT-147')?.pint_ae_cardinality).toBe('0..1');
    expect(getRegistryFieldByDR('IBT-148')?.pint_ae_cardinality).toBe('1..1');
    expect(getRegistryFieldByDR('IBT-149')?.pint_ae_cardinality).toBe('1..1');
  });

  it('maps explicit price discount aliases but never legacy line_discount', () => {
    const suggestions = generateMappingSuggestions(
      ['item_price_discount', 'line_discount'],
      [{ item_price_discount: '40', line_discount: '10' }],
      'lines',
    );
    expect(suggestions.find((item) => item.erpColumn === 'item_price_discount')?.targetField.ibtReference).toBe('IBT-147');
    expect(suggestions.find((item) => item.erpColumn === 'line_discount')?.targetField.ibtReference).not.toBe('IBT-147');
  });

  it('does not collapse gross price into the net-price target', () => {
    const suggestions = generateMappingSuggestions(['gross_price'], [{ gross_price: '450' }], 'lines');
    expect(suggestions.find((item) => item.targetField.ibtReference === 'IBT-146')).toBeUndefined();
  });

  it('traces the pricing control to all four terms without treating allowance as price discount', () => {
    const targets = getValidationDRTargets('UAE-UC1-CHK-062');
    expect(targets.map((target) => target.dr_id)).toEqual(['IBT-146', 'IBT-147', 'IBT-148']);
    expect(targets.flatMap((target) => target.validated_fields)).not.toContain('line_allowance_amount');
    expect(targets.flatMap((target) => target.validated_fields)).not.toContain('line_discount');
  });

  it('does not report derived IBT-148 as missing taxpayer-source population when discount is absent', () => {
    const result = computeTraceabilityMatrix([{
      dataset: 'lines',
      columns: [
        { column: 'unit_price', totalRows: 1, populatedCount: 1, populationPct: 100 },
        { column: 'item_price_discount', totalRows: 1, populatedCount: 0, populationPct: 0 },
      ],
    }]);
    const gross = result.rows.find((row) => row.dr_id === 'IBT-148');
    expect(gross).toMatchObject({ populationPct: null, dataResponsibility: 'DRCS derived from ERP pricing facts' });
  });
});
