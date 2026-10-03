import { describe, expect, it } from 'vitest';
import { deriveVatBreakdowns, sumVatBreakdownTax } from './vatBreakdownDerivation';
import { InvoiceHeader, InvoiceLine } from '@/types/compliance';

const header = (overrides: Partial<InvoiceHeader> = {}): InvoiceHeader => ({
  invoice_id: 'INV-1',
  invoice_number: 'INV-1',
  issue_date: '2026-01-01',
  seller_trn: '100000000000001',
  buyer_id: 'B-1',
  currency: 'AED',
  document_level_allowance_total: 0,
  document_level_charge_total: 0,
  ...overrides,
});

const line = (id: string, amount: number, category: string, rate: number | undefined, vatAmount = 999): InvoiceLine => ({
  line_id: id,
  invoice_id: 'INV-1',
  line_number: Number(id.replace(/\D/g, '')) || 1,
  quantity: 1,
  unit_price: amount,
  line_total_excl_vat: amount,
  vat_rate: rate as number,
  vat_amount: vatAmount,
  tax_category_code: category,
});

describe('P1.4 VAT breakdown derivation', () => {
  it('derives one S/5 breakdown from one line using invoice-currency inputs, not line VAT', () => {
    const result = deriveVatBreakdowns(header({ currency: 'USD' }), [line('L1', 100, 'S', 5, 9999)]);
    expect(result.status).toBe('evaluated');
    expect(result.breakdowns).toMatchObject([{ groupingKey: 'S|5', taxableAmount: 100, taxAmount: 5, currency: 'USD' }]);
  });

  it('aggregates multiple equal category/rate lines and does not add line adjustments twice', () => {
    const first = { ...line('L1', 80, 'S', 5), line_allowance_amount: 20 };
    const second = { ...line('L2', 120, 'S', 5), line_charge_amount: 20 };
    const result = deriveVatBreakdowns(header(), [first, second]);
    expect(result.breakdowns[0]).toMatchObject({ taxableAmount: 200, taxAmount: 10, contributingLineIds: ['L1', 'L2'] });
  });

  it('creates separate category and rate breakdowns while normalizing numerically equal rates', () => {
    const result = deriveVatBreakdowns(header(), [
      line('L1', 100, 'S', 5),
      line('L2', 100, 'S', 5.00),
      line('L3', 100, 'S', 10),
      line('L4', 100, 'Z', 0),
    ]);
    expect(result.breakdowns.map(({ groupingKey, taxableAmount }) => [groupingKey, taxableAmount])).toEqual([
      ['S|10', 100], ['S|5', 200], ['Z|0', 100],
    ]);
  });

  it.each([
    ['Z', 0, 'Z', 0],
    ['E', undefined, 'E', null],
    ['O', undefined, 'O', null],
    ['AE', 5, 'AE', 5],
    ['N', 5, 'N', 5],
  ] as const)('applies pinned zero-tax treatment for %s without inventing a rate', (source, rate, category, expectedRate) => {
    const result = deriveVatBreakdowns(header(), [line('L1', 125, source, rate)]);
    expect(result.breakdowns[0]).toMatchObject({ category, rate: expectedRate, taxableAmount: 125, taxAmount: 0 });
  });

  it('normalizes the RC ingestion alias to official AE and records the normalization', () => {
    const result = deriveVatBreakdowns(header(), [line('L1', 100, 'RC', 5)]);
    expect(result.breakdowns[0]).toMatchObject({ category: 'AE', groupingKey: 'AE|5', taxAmount: 0, normalizations: ['RC->AE'] });
  });

  it('uses deterministic half-away-from-zero rounding at the group result', () => {
    const positive = deriveVatBreakdowns(header(), [line('L1', 0.1, 'S', 5)]);
    const negative = deriveVatBreakdowns(header(), [line('L1', -0.1, 'S', 5)]);
    expect(positive.breakdowns[0].taxAmount).toBe(0.01);
    expect(negative.breakdowns[0].taxAmount).toBe(-0.01);
  });

  it('preserves credit-note amount signs instead of blindly inverting them', () => {
    const result = deriveVatBreakdowns(header({ invoice_type: '381' }), [line('L1', -100, 'S', 5)]);
    expect(result.breakdowns[0]).toMatchObject({ taxableAmount: -100, taxAmount: -5 });
  });

  it.each([
    [{ document_level_allowance_total: 10, document_level_charge_total: 0 }, 'adjustments exist'],
    [{ document_level_allowance_total: 0, document_level_charge_total: 10 }, 'adjustments exist'],
    [{ document_level_allowance_total: undefined, document_level_charge_total: undefined }, 'not positively established'],
  ] as const)('returns the P1.7 dependency instead of a false result for %o', (adjustments, reason) => {
    const result = deriveVatBreakdowns(header(adjustments), [line('L1', 100, 'S', 5)]);
    expect(result).toMatchObject({ status: 'not_evaluated', breakdowns: [] });
    expect(result.dependencyReason).toContain(reason);
    expect(result.dependencyReason).not.toContain('missing IBT-116');
  });

  it('fails invalid grouping inputs deterministically', () => {
    expect(deriveVatBreakdowns(header(), [line('L1', 100, '', 5)]).status).toBe('failed');
    expect(deriveVatBreakdowns(header(), [line('L1', 100, 'S', undefined)]).status).toBe('failed');
  });

  it('rounds the sum of derived IBT-117 breakdowns for IBT-110 reconciliation', () => {
    const result = deriveVatBreakdowns(header(), [line('L1', 100, 'S', 5), line('L2', 100, 'S', 10)]);
    expect(sumVatBreakdownTax(result.breakdowns)).toBe(15);
  });
});
