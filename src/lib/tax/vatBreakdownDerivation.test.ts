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

  it('derives repeatable IBT-118/119 groups from line facts without a single header value overriding them', () => {
    const result = deriveVatBreakdowns(
      header({ tax_category_code: 'E', tax_category_rate: 99 }),
      [line('L1', 100, 'S', 5), line('L2', 40, 'Z', 0)]
    );
    expect(result.breakdowns.map(({ category, rate, taxableAmount }) => ({ category, rate, taxableAmount }))).toEqual([
      { category: 'S', rate: 5, taxableAmount: 100 },
      { category: 'Z', rate: 0, taxableAmount: 40 },
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

  it('normalizes the REVERSE_CHARGE ingestion alias to official AE', () => {
    const result = deriveVatBreakdowns(header(), [line('L1', 100, 'REVERSE_CHARGE', 5)]);
    expect(result.breakdowns[0]).toMatchObject({ category: 'AE', groupingKey: 'AE|5', normalizations: ['REVERSE_CHARGE->AE'] });
  });

  it('groups multiple rate-inapplicable E/O lines without inventing IBT-119', () => {
    const result = deriveVatBreakdowns(header(), [
      line('L1', 20, 'E', undefined), line('L2', 30, 'E', undefined), line('L3', 40, 'O', undefined),
    ]);
    expect(result.breakdowns.map(({ groupingKey, rate, taxableAmount }) => ({ groupingKey, rate, taxableAmount }))).toEqual([
      { groupingKey: 'E|NA', rate: null, taxableAmount: 50 },
      { groupingKey: 'O|NA', rate: null, taxableAmount: 40 },
    ]);
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
  ] as const)('returns the document-adjustment dependency instead of a false result for %o', (adjustments, reason) => {
    const result = deriveVatBreakdowns(header(adjustments), [line('L1', 100, 'S', 5)]);
    expect(result).toMatchObject({ status: 'not_evaluated', breakdowns: [] });
    expect(result.dependencyReason).toContain(reason);
    expect(result.dependencyReason).not.toContain('missing IBT-116');
  });

  it('allocates categorized document allowances and charges into their VAT groups', () => {
    const result = deriveVatBreakdowns(header({
      document_level_allowance_total: 20,
      document_level_charge_total: 10,
      document_level_adjustments: [
        { adjustment_id: 'A-1', kind: 'allowance', amount: 20, tax_category_code: 'S', vat_rate: 5, reason_text: 'Discount' },
        { adjustment_id: 'C-1', kind: 'charge', amount: 10, tax_category_code: 'Z', vat_rate: 0, reason_code: 'FC' },
      ],
    }), [line('L1', 100, 'S', 5), line('L2', 40, 'Z', 0)]);

    expect(result.status).toBe('evaluated');
    expect(result.breakdowns).toMatchObject([
      { groupingKey: 'S|5', taxableAmount: 80, taxAmount: 4, contributingAdjustmentIds: ['A-1'] },
      { groupingKey: 'Z|0', taxableAmount: 50, taxAmount: 0, contributingAdjustmentIds: ['C-1'] },
    ]);
    expect(result.breakdowns[0].lineage.formula).toContain('document allowances');
  });

  it('does not evaluate incomplete or unreconciled adjustment allocations', () => {
    const incomplete = deriveVatBreakdowns(header({
      document_level_allowance_total: 10,
      document_level_adjustments: [
        { adjustment_id: 'A-1', kind: 'allowance', amount: 10, tax_category_code: '', vat_rate: 5, reason_text: 'Discount' },
      ],
    }), [line('L1', 100, 'S', 5)]);
    expect(incomplete).toMatchObject({ status: 'not_evaluated' });
    expect(incomplete.dependencyReason).toContain('incomplete');

    const unreconciled = deriveVatBreakdowns(header({
      document_level_allowance_total: 10,
      document_level_adjustments: [
        { adjustment_id: 'A-1', kind: 'allowance', amount: 9, tax_category_code: 'S', vat_rate: 5, reason_text: 'Discount' },
      ],
    }), [line('L1', 100, 'S', 5)]);
    expect(unreconciled).toMatchObject({ status: 'not_evaluated' });
    expect(unreconciled.dependencyReason).toContain('do not reconcile');
  });

  it('does not evaluate duplicate adjustment identifiers or invalid rate/category pairs', () => {
    const duplicateIds = deriveVatBreakdowns(header({
      document_level_allowance_total: 10,
      document_level_adjustments: [
        { adjustment_id: 'A-1', kind: 'allowance', amount: 5, tax_category_code: 'S', vat_rate: 5, reason_text: 'Discount' },
        { adjustment_id: 'A-1', kind: 'allowance', amount: 5, tax_category_code: 'Z', vat_rate: 0, reason_text: 'Discount' },
      ],
    }), [line('L1', 100, 'S', 5)]);
    expect(duplicateIds).toMatchObject({ status: 'not_evaluated' });

    const exemptWithRate = deriveVatBreakdowns(header({
      document_level_charge_total: 5,
      document_level_adjustments: [
        { adjustment_id: 'C-1', kind: 'charge', amount: 5, tax_category_code: 'E', vat_rate: 5, reason_text: 'Charge' },
      ],
    }), [line('L1', 100, 'S', 5)]);
    expect(exemptWithRate).toMatchObject({ status: 'not_evaluated' });
    expect(exemptWithRate.dependencyReason).toContain('invalid VAT category/rate');
  });

  it('fails invalid grouping inputs deterministically', () => {
    expect(deriveVatBreakdowns(header(), [line('L1', 100, '', 5)]).status).toBe('failed');
    expect(deriveVatBreakdowns(header(), [line('L1', 100, 'S', undefined)]).status).toBe('failed');
  });

  it('returns no derived breakdown for an empty line set and rejects a negative applicable rate', () => {
    expect(deriveVatBreakdowns(header(), [])).toMatchObject({ status: 'evaluated', breakdowns: [] });
    expect(deriveVatBreakdowns(header(), [line('L1', 100, 'S', -5)])).toMatchObject({ status: 'failed' });
  });

  it('rounds the sum of derived IBT-117 breakdowns for IBT-110 reconciliation', () => {
    const result = deriveVatBreakdowns(header(), [line('L1', 100, 'S', 5), line('L2', 100, 'S', 10)]);
    expect(sumVatBreakdownTax(result.breakdowns)).toBe(15);
  });
});
