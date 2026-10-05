import { describe, expect, it } from 'vitest';
import { resolvePricingSemantics } from './pricingSemantics';

describe('P1.5 pricing semantics', () => {
  it('derives gross from net plus an item price discount', () => {
    expect(resolvePricingSemantics({ unit_price: 410, item_price_discount: 40, price_base_quantity: 1 })).toMatchObject({
      itemNetPrice: 410, itemPriceDiscount: 40, itemGrossPrice: 450,
      netStatus: 'SOURCE', discountStatus: 'SOURCE', grossStatus: 'DERIVED', baseQuantityStatus: 'SOURCE', valid: true,
    });
  });

  it('derives gross equal to net without manufacturing IBT-147', () => {
    const result = resolvePricingSemantics({ unit_price: 200 });
    expect(result.itemPriceDiscount).toBeUndefined();
    expect(result).toMatchObject({ itemGrossPrice: 200, discountStatus: 'NOT_APPLICABLE', grossStatus: 'DERIVED', priceBaseQuantity: 1, baseQuantityStatus: 'DEFAULTED' });
  });

  it.each([
    [{ unit_price: -1 }, 'Item net price'],
    [{ unit_price: 10, item_price_discount: -1 }, 'Item price discount'],
    [{ unit_price: 10, price_base_quantity: 0 }, 'base quantity'],
  ])('rejects invalid pricing facts %#', (line, reason) => {
    const result = resolvePricingSemantics(line);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain(reason);
  });

  it('uses exact decimal addition for the gross-price derivation', () => {
    expect(resolvePricingSemantics({ unit_price: 0.1, item_price_discount: 0.2 }).itemGrossPrice).toBe(0.3);
  });
});
