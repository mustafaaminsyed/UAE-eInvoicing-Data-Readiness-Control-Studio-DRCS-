import Decimal from 'decimal.js';
import { DocumentAdjustment, InvoiceHeader, InvoiceLine, TaxBreakdown } from '@/types/compliance';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_CEIL });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const sum = (values: number[]) => values.reduce((total, value) => total.plus(value), new D(0));
export interface AmountResult { matches: boolean; expected?: string; reason?: string; unevaluated?: boolean }
const unavailable = (reason: string): AmountResult => ({ matches: false, unevaluated: true, reason });
const failure = (reason: string): AmountResult => ({ matches: false, reason });
const compare = (actual: number, expected: Decimal): AmountResult => ({ matches: new D(actual).eq(expected), expected: expected.toFixed(2) });

function adjustmentTotal(items: DocumentAdjustment[] | undefined, total: number | undefined): Decimal | AmountResult {
  if (total !== undefined && !finite(total)) return unavailable('Document adjustment total must be finite');
  if (total !== undefined && total < 0) return failure('Document adjustment totals must be non-negative');
  if (items === undefined) return new D(total ?? 0);
  if (!Array.isArray(items) || items.some(item => !item || !finite(item.amount))) return unavailable('Document adjustment amounts must be finite');
  if (items.some(item => item.amount < 0)) return failure('Document adjustment amounts must be non-negative');
  const calculated = sum(items.map(item => item.amount));
  if (total !== undefined && !calculated.eq(total)) return failure('Document adjustment detail does not match its declared total');
  return calculated;
}

export function evaluateInvoiceNet(header: InvoiceHeader, lines: InvoiceLine[]): AmountResult {
  if (!finite(header.total_excl_vat) || !lines.length || lines.some(line => !finite(line.line_total_excl_vat))) return unavailable('Invoice net reconciliation requires a total and numeric line amounts');
  const allowances = adjustmentTotal(header.document_allowances, header.document_level_allowance_total);
  const charges = adjustmentTotal(header.document_charges, header.document_level_charge_total);
  if (!(allowances instanceof D)) return allowances;
  if (!(charges instanceof D)) return charges;
  return compare(header.total_excl_vat, sum(lines.map(line => line.line_total_excl_vat)).minus(allowances).plus(charges).toDecimalPlaces(2));
}

export function evaluateInvoiceGross(header: InvoiceHeader): AmountResult {
  if (![header.total_incl_vat, header.total_excl_vat, header.vat_total].every(finite)) return unavailable('Gross reconciliation requires net, VAT and gross totals');
  return compare(header.total_incl_vat!, new D(header.total_excl_vat!).plus(header.vat_total!).toDecimalPlaces(2));
}

export function evaluatePayable(header: InvoiceHeader): AmountResult {
  if (![header.amount_due, header.total_incl_vat, header.paid_amount ?? 0, header.rounding_amount ?? 0].every(finite)) return unavailable('Payable reconciliation requires numeric amount due, gross, paid and rounding amounts');
  const paid = new D(header.paid_amount ?? 0);
  const rounding = new D(header.rounding_amount ?? 0);
  const gross = new D(header.total_incl_vat!);
  // IBR-CO-16 rounds payable minus rounding, not the rounding amount itself.
  const expected = paid.isZero() ? gross : gross.minus(paid).toDecimalPlaces(2);
  const actual = rounding.isZero() ? new D(header.amount_due!) : new D(header.amount_due!).minus(rounding).toDecimalPlaces(2);
  return { matches: actual.eq(expected), expected: expected.plus(rounding).toFixed(2) };
}

// Existing flat header fields represent one supplied category, not a derived one.
export function suppliedBreakdowns(header: InvoiceHeader): TaxBreakdown[] | undefined {
  if (header.tax_breakdowns !== undefined) return header.tax_breakdowns;
  if (header.tax_category_code && finite(header.total_excl_vat) && finite(header.vat_total)) {
    return [{ tax_category_code: header.tax_category_code, tax_category_rate: header.tax_category_rate, taxable_amount: header.total_excl_vat, tax_amount: header.vat_total }];
  }
  return undefined;
}

export function evaluateVatTotal(header: InvoiceHeader): AmountResult {
  // Flat single-category input reuses vat_total as the category tax amount.
  // Comparing that adapter to vat_total would be a circular, fabricated pass.
  const breakdowns = header.tax_breakdowns;
  if (!finite(header.vat_total) || !Array.isArray(breakdowns) || !breakdowns.length || breakdowns.some(row => !row || !finite(row.tax_amount))) return unavailable('VAT total reconciliation requires independent category tax amounts in tax_breakdowns');
  return compare(header.vat_total, sum(breakdowns.map(row => row.tax_amount)).toDecimalPlaces(2));
}

function categoryKey(code: string | undefined, rate: number | undefined): string | undefined {
  if (!code || !['S', 'Z', 'E', 'O', 'AE'].includes(code)) return undefined;
  if (!finite(rate) && !['E', 'O'].includes(code)) return undefined;
  if (rate !== undefined && (!finite(rate) || rate < 0)) return undefined;
  return `${code}:${['E', 'O'].includes(code) ? 0 : rate}`;
}

export function evaluateVatBreakdowns(header: InvoiceHeader, lines: InvoiceLine[]): AmountResult {
  const breakdowns = suppliedBreakdowns(header);
  if (!Array.isArray(breakdowns) || !breakdowns.length || !lines.length) return unavailable('VAT calculation requires supplied breakdowns and invoice lines');
  const allowances = adjustmentTotal(header.document_allowances, header.document_level_allowance_total);
  const charges = adjustmentTotal(header.document_charges, header.document_level_charge_total);
  if (!(allowances instanceof D)) return allowances;
  if (!(charges instanceof D)) return charges;
  if ((header.document_allowances === undefined && !allowances.isZero()) || (header.document_charges === undefined && !charges.isZero())) return unavailable('Provide category allocation for document allowances and charges');
  const groups = new Map<string, Decimal>();
  const add = (code: string | undefined, rate: number | undefined, amount: number) => {
    const key = categoryKey(code, rate);
    if (!key || !finite(amount)) return false;
    groups.set(key, (groups.get(key) ?? new D(0)).plus(amount));
    return true;
  };
  for (const line of lines) if (!add(line.tax_category_code, line.vat_rate, line.line_total_excl_vat)) return unavailable('Missing or unsupported line VAT category, rate or amount');
  for (const item of header.document_allowances ?? []) if (!add(item.tax_category_code, item.tax_category_rate, -item.amount)) return unavailable('Missing or unsupported allowance VAT category or rate');
  for (const item of header.document_charges ?? []) if (!add(item.tax_category_code, item.tax_category_rate, item.amount)) return unavailable('Missing or unsupported charge VAT category or rate');
  const seen = new Set<string>();
  for (const row of breakdowns) {
    if (!row) return unavailable('Invalid VAT breakdown');
    const key = categoryKey(row.tax_category_code, row.tax_category_rate);
    if (!key || !finite(row.taxable_amount) || !finite(row.tax_amount)) return unavailable('Missing or unsupported breakdown category, rate or amount');
    if (seen.has(key)) return failure(`Duplicate VAT breakdown ${key}`);
    seen.add(key);
    const base = groups.get(key);
    if (!base) return failure(`VAT breakdown ${key} has no matching lines or adjustments`);
    const tolerance = row.tax_category_code === 'S' ? new D('0.02') : new D(0);
    if (new D(row.taxable_amount).minus(base).abs().gt(tolerance)) return failure(`VAT breakdown ${key}: taxable amount must reconcile to ${base.toFixed(2)}`);
    // Standard-rated rule compares absolute amounts; reverse charge, exempt,
    // zero-rated and out-of-scope categories carry zero supplier VAT.
    const tax = row.tax_category_code === 'S' ? new D(row.taxable_amount).abs().times(row.tax_category_rate!).div(100).toDecimalPlaces(2) : new D(0);
    if (new D(row.tax_amount).abs().minus(tax).abs().gt(tolerance)) return failure(`VAT breakdown ${key}: category tax must reconcile to ${tax.toFixed(2)}`);
  }
  if (seen.size !== groups.size) return failure('A VAT category/rate used by lines or document adjustments has no breakdown');
  return { matches: true };
}
