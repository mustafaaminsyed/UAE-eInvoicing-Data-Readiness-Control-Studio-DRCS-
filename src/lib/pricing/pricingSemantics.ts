import type { InvoiceLine } from '@/types/compliance';

export type PricingSemanticStatus = 'SOURCE' | 'DERIVED' | 'DEFAULTED' | 'NOT_APPLICABLE' | 'UNRESOLVED' | 'CONTRADICTORY';

export interface PricingResolution {
  itemNetPrice: number;
  itemPriceDiscount?: number;
  itemGrossPrice?: number;
  priceBaseQuantity?: number;
  netStatus: PricingSemanticStatus;
  discountStatus: PricingSemanticStatus;
  grossStatus: PricingSemanticStatus;
  baseQuantityStatus: PricingSemanticStatus;
  valid: boolean;
  reason?: string;
  derivation?: string;
}

function decimalParts(value: number): { coefficient: bigint; scale: number } | null {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? 0);
  let coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

export function addExactDecimals(left: number, right: number): number {
  const a = decimalParts(left);
  const b = decimalParts(right);
  if (!a || !b) return Number.NaN;
  const scale = Math.max(a.scale, b.scale);
  const coefficient = a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale);
  return Number(coefficient) / 10 ** scale;
}

/** Resolves IBT-146/147/148/149 without ever treating a line allowance as a price discount. */
export function resolvePricingSemantics(line: Pick<InvoiceLine, 'unit_price' | 'item_price_discount' | 'price_base_quantity'>): PricingResolution {
  const net = line.unit_price;
  const discount = line.item_price_discount;
  const explicitBase = line.price_base_quantity;
  const base = explicitBase ?? 1;

  if (!Number.isFinite(net) || net < 0) {
    return { itemNetPrice: net, itemPriceDiscount: discount, priceBaseQuantity: base, netStatus: 'CONTRADICTORY', discountStatus: discount === undefined ? 'NOT_APPLICABLE' : 'SOURCE', grossStatus: 'UNRESOLVED', baseQuantityStatus: explicitBase === undefined ? 'DEFAULTED' : 'SOURCE', valid: false, reason: 'Item net price must be non-negative.' };
  }
  if (!Number.isFinite(base) || base <= 0) {
    return { itemNetPrice: net, itemPriceDiscount: discount, priceBaseQuantity: base, netStatus: 'SOURCE', discountStatus: discount === undefined ? 'NOT_APPLICABLE' : 'SOURCE', grossStatus: 'UNRESOLVED', baseQuantityStatus: 'CONTRADICTORY', valid: false, reason: 'Item price base quantity must be greater than zero.' };
  }
  if (discount !== undefined && (!Number.isFinite(discount) || discount < 0)) {
    return { itemNetPrice: net, itemPriceDiscount: discount, priceBaseQuantity: base, netStatus: 'SOURCE', discountStatus: 'CONTRADICTORY', grossStatus: 'UNRESOLVED', baseQuantityStatus: explicitBase === undefined ? 'DEFAULTED' : 'SOURCE', valid: false, reason: 'Item price discount must be non-negative.' };
  }

  const gross = discount === undefined ? net : addExactDecimals(net, discount);
  return {
    itemNetPrice: net,
    itemPriceDiscount: discount,
    itemGrossPrice: gross,
    priceBaseQuantity: base,
    netStatus: 'SOURCE',
    discountStatus: discount === undefined ? 'NOT_APPLICABLE' : 'SOURCE',
    grossStatus: 'DERIVED',
    baseQuantityStatus: explicitBase === undefined ? 'DEFAULTED' : 'SOURCE',
    valid: Number.isFinite(gross) && gross >= 0,
    derivation: discount === undefined ? `${net} = ${gross} (governed no-discount)` : `${net} + ${discount} = ${gross}`,
  };
}
