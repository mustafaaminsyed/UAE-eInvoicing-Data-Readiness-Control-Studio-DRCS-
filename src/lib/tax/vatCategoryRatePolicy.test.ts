import { describe, expect, it } from 'vitest';
import { validateVatCategoryRate } from './vatCategoryRatePolicy';

describe('PINT-AE 1.0.4 VAT category/rate policy', () => {
  it.each([
    ['S', 5, 'line'],
    ['Z', 0, 'line'],
    ['AE', 0, 'line'],
    ['E', undefined, 'line'],
    ['O', undefined, 'line'],
    ['N', 1, 'line'],
    ['S', 5, 'adjustment'],
    ['Z', 0, 'adjustment'],
    ['AE', 0, 'adjustment'],
    ['E', 0, 'adjustment'],
    ['O', undefined, 'adjustment'],
  ] as const)('accepts %s/%s in %s context', (category, rate, context) => {
    expect(validateVatCategoryRate(category, rate, context)).toMatchObject({ valid: true });
  });

  it.each([
    ['S', 0, 'line'],
    ['S', 10, 'line'],
    ['Z', 5, 'line'],
    ['AE', 5, 'line'],
    ['E', 0, 'line'],
    ['O', 0, 'line'],
    ['E', undefined, 'adjustment'],
    ['O', 0, 'adjustment'],
    ['N', 5, 'adjustment'],
  ] as const)('rejects %s/%s in %s context', (category, rate, context) => {
    expect(validateVatCategoryRate(category, rate, context)).toMatchObject({ valid: false });
  });

  it('normalizes reverse-charge aliases before applying the rate rule', () => {
    expect(validateVatCategoryRate('RC', 0, 'line')).toMatchObject({
      valid: true,
      category: 'AE',
      normalization: 'RC->AE',
    });
  });
});
