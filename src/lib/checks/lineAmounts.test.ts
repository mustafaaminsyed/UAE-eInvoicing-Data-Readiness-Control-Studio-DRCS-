import { describe, expect, it } from 'vitest';
import { evaluateLineAmount } from './lineAmounts';
import { InvoiceLine, DataContext } from '@/types/compliance';
import { runAllPintAEChecks } from './pintAECheckRunner';
import { checksRegistry } from './checksRegistry';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';
import { RuleExecution } from '@/types/executionLedger';
import { parseLinesFile } from '@/lib/csvParser';

const line: InvoiceLine = { invoice_id: 'I1', line_id: 'L1', line_number: 1, quantity: 10, unit_price: 200, price_base_quantity: 2, line_allowance_amount: 50, line_charge_amount: 20, line_total_excl_vat: 970, vat_rate: 5, vat_amount: 48.5 };
function data(value: InvoiceLine): DataContext {
  return { headers: [], buyers: [], lines: [value], headerMap: new Map(), buyerMap: new Map(), linesByInvoice: new Map([['I1', [value]]]) };
}
const check = UAE_UC1_CHECK_PACK.find(rule => rule.check_id.endsWith('034'))!;

describe('PINT-AE line net amount', () => {
  it('accounts for base quantity, charges and allowances in both engines', () => {
    expect(evaluateLineAmount(line)).toEqual({ expected: 970, matches: true });
    expect(runAllPintAEChecks([check], data(line))).toHaveLength(0);
    expect(checksRegistry.find(rule => rule.id === 'line_totals_mismatch')!.run(data(line))).toHaveLength(0);
  });
  it('defaults omitted base quantity to one and supports the legacy allowance alias', () => {
    expect(evaluateLineAmount({ ...line, price_base_quantity: undefined, line_allowance_amount: undefined, line_discount: 50, line_total_excl_vat: 1970 }).matches).toBe(true);
  });
  it('does not subtract matching allowance aliases twice', () => {
    expect(evaluateLineAmount({ ...line, line_discount: 50 }).matches).toBe(true);
    expect(evaluateLineAmount({ ...line, line_discount: 10 }).reason).toContain('Conflicting');
  });
  it.each([0, -1])('rejects invalid base quantity %s as a failed record', base => {
    const rows: RuleExecution[] = [];
    expect(runAllPintAEChecks([check], data({ ...line, price_base_quantity: base }), { onExecution: row => rows.push(row) })).toHaveLength(1);
    expect(rows[0]).toMatchObject({ failed: 1, passed: 0 });
  });
  it('records nonfinite adjustment inputs as unevaluated', () => {
    const rows: RuleExecution[] = [];
    runAllPintAEChecks([check], data({ ...line, line_charge_amount: NaN }), { onExecution: row => rows.push(row) });
    expect(rows[0]).toMatchObject({ notEvaluated: 1, passed: 0 });
  });
  it.each([[1.005, 1.01], [-1.005, -1]])('uses XPath rounding for %s', (price, expected) => {
    expect(evaluateLineAmount({ ...line, quantity: 1, unit_price: price, price_base_quantity: 1, line_charge_amount: 0, line_allowance_amount: 0, line_total_excl_vat: expected }).matches).toBe(true);
  });
  it('rejects a one-cent difference even with a legacy tolerance setting', () => {
    expect(runAllPintAEChecks([{ ...check, parameters: { tolerance: 0.01 } }], data({ ...line, line_total_excl_vat: 970.01 }))).toHaveLength(1);
  });
  it('imports base quantities through CSV', async () => {
    const parsed = await parseLinesFile({ text: async () => 'invoice_id,line_id,line_number,quantity,unit_price,price_base_quantity,line_total_excl_vat,vat_rate,vat_amount\nI1,L1,1,10,200,2,1000,5,50' } as File);
    expect(parsed[0].price_base_quantity).toBe(2);
    expect(evaluateLineAmount(parsed[0]).matches).toBe(true);
  });
});
