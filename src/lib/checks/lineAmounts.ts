import Decimal from 'decimal.js';
import { InvoiceLine } from '@/types/compliance';

const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_CEIL });

// IBR-147-AE rounds the complete expression to cents (XPath round).
// The legacy discount column is a line allowance, never an item price discount.
export function evaluateLineAmount(line: InvoiceLine): { expected?: number; matches: boolean; reason?: string; unevaluated?: boolean } {
  const base = line.price_base_quantity ?? 1;
  const allowance = line.line_allowance_amount ?? line.line_discount ?? 0;
  const charge = line.line_charge_amount ?? 0;
  if (![line.quantity, line.unit_price, line.line_total_excl_vat, base, allowance, charge, line.line_discount ?? 0].every(Number.isFinite)) {
    return { matches: false, unevaluated: true, reason: 'Line calculation inputs must be finite numbers' };
  }
  if (base <= 0) return { matches: false, reason: 'Price base quantity must be greater than zero' };
  if (line.line_allowance_amount !== undefined && line.line_discount !== undefined && line.line_allowance_amount !== line.line_discount) {
    return { matches: false, reason: 'Conflicting line allowance and legacy line_discount; supply one amount or matching aliases' };
  }
  const expected = new Money(line.quantity).times(new Money(line.unit_price).div(base)).plus(charge).minus(allowance).toDecimalPlaces(2);
  return { expected: expected.toNumber(), matches: new Money(line.line_total_excl_vat).toDecimalPlaces(2).eq(expected) };
}
