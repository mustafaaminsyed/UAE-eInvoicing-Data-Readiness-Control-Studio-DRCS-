import { describe, expect, it } from 'vitest';
import { InvoiceHeader, InvoiceLine, DataContext } from '@/types/compliance';
import { RuleExecution } from '@/types/executionLedger';
import { evaluateInvoiceNet, evaluateInvoiceGross, evaluatePayable, evaluateVatBreakdowns, evaluateVatTotal } from './invoiceAmounts';
import { runAllPintAEChecks } from './pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';
import { parseHeadersFile } from '@/lib/csvParser';
import { checksRegistry } from './checksRegistry';

const header: InvoiceHeader = { invoice_id: 'I1', invoice_number: '1', issue_date: '2026-09-26', seller_trn: '100000000000001', buyer_id: 'B1', currency: 'AED', total_excl_vat: 150, vat_total: 5, total_incl_vat: 155, amount_due: 155,
  tax_breakdowns: [ { tax_category_code: 'S', tax_category_rate: 5, taxable_amount: 100, tax_amount: 5 }, { tax_category_code: 'Z', tax_category_rate: 0, taxable_amount: 50, tax_amount: 0 } ] };
const line: InvoiceLine = { invoice_id: 'I1', line_id: 'L1', line_number: 1, quantity: 1, unit_price: 100, line_total_excl_vat: 100, vat_rate: 5, vat_amount: 5, tax_category_code: 'S' };
const lines = [line, { ...line, line_id: 'L2', line_number: 2, unit_price: 50, line_total_excl_vat: 50, vat_rate: 0, vat_amount: 0, tax_category_code: 'Z' }];
function context(h = header, ls = lines): DataContext { return { headers: [h], lines: ls, buyers: [], headerMap: new Map([['I1', h]]), buyerMap: new Map(), linesByInvoice: new Map([['I1', ls]]) }; }
function run(suffix: string, h = header, ls = lines) {
  const rows: RuleExecution[] = [];
  const findings = runAllPintAEChecks([UAE_UC1_CHECK_PACK.find(check => check.check_id.endsWith(suffix))!], context(h, ls), { onExecution: row => rows.push(row) });
  return { findings, row: rows[0] };
}

describe('invoice monetary reconciliation', () => {
  it('deducts document allowances and adds charges without double counting lines', () => {
    expect(evaluateInvoiceNet({ ...header, document_level_allowance_total: 10, document_level_charge_total: 2, total_excl_vat: 142 }, lines).matches).toBe(true);
    expect(run('021', { ...header, document_level_allowance_total: 10 }).row.failed).toBe(1);
  });
  it('uses detailed adjustments when totals are omitted and rejects mismatched totals', () => {
    const h = { ...header, total_excl_vat: 140, document_allowances: [{ amount: 10, tax_category_code: 'S', tax_category_rate: 5 }] };
    expect(evaluateInvoiceNet(h, lines).matches).toBe(true);
    expect(evaluateInvoiceNet({ ...h, document_level_allowance_total: 9 }, lines).reason).toContain('declared total');
  });
  it('does not fabricate zero totals or evaluate nonfinite adjustments', () => {
    expect(run('021', { ...header, total_excl_vat: undefined }).row.notEvaluated).toBe(1);
    expect(run('021', { ...header, document_level_charge_total: NaN }).row.notEvaluated).toBe(1);
    expect(run('021', header, []).row.notEvaluated).toBe(1);
  });
  it('shares exact gross calculation between both engines', () => {
    const h = { ...header, total_incl_vat: 155.01 };
    expect(evaluateInvoiceGross(h).matches).toBe(false);
    expect(run('025', h).findings).toHaveLength(1);
    expect(checksRegistry.find(check => check.id === 'header_totals_mismatch')!.run(context(h))).toHaveLength(1);
  });
  it.each([
    { paid_amount: 55, amount_due: 100 },
    { paid_amount: 155, amount_due: 0 },
    { paid_amount: 200, amount_due: -45 },
    { paid_amount: 55, rounding_amount: -0.01, amount_due: 99.99 },
    { rounding_amount: 0.01, amount_due: 155.01 },
  ])('reconciles paid and rounding amounts %j', amounts => {
    expect(evaluatePayable({ ...header, ...amounts }).matches).toBe(true);
    expect(run('035', { ...header, ...amounts }).row.passed).toBe(1);
  });
  it('fails wrong payable and does not pass absent amount due', () => {
    expect(run('035', { ...header, amount_due: 154.99 }).row.failed).toBe(1);
    expect(run('035', { ...header, amount_due: undefined }).row.notEvaluated).toBe(1);
  });
});

describe('category VAT breakdown reconciliation', () => {
  it('reconciles every category and counts one header rather than line records', () => {
    expect(run('028').row).toMatchObject({ passed: 1, candidateCount: 1 });
    expect(evaluateVatTotal(header).matches).toBe(true);
  });
  it('allocates adjustments to their own categories', () => {
    const h = { ...header, document_allowances: [{ amount: 20, tax_category_code: 'S', tax_category_rate: 5 }], document_charges: [{ amount: 10, tax_category_code: 'Z', tax_category_rate: 0 }], tax_breakdowns: [{ tax_category_code: 'S', tax_category_rate: 5, taxable_amount: 80, tax_amount: 4 }, { tax_category_code: 'Z', tax_category_rate: 0, taxable_amount: 60, tax_amount: 0 }] };
    expect(evaluateVatBreakdowns(h, lines).matches).toBe(true);
    expect(run('028', { ...h, document_level_allowance_total: 19 }).row.failed).toBe(1);
  });
  it('leaves unallocated document adjustments unevaluated even for a single category', () => {
    expect(run('028', { ...header, document_level_allowance_total: 10 }).row).toMatchObject({ passed: 0, notEvaluated: 1 });
  });
  it('uses category VAT instead of the sum of rounded line VAT', () => {
    const h = { ...header, vat_total: 0.01, tax_breakdowns: [{ tax_category_code: 'S', tax_category_rate: 5, taxable_amount: 0.2, tax_amount: 0.01 }] };
    const ls = [1, 2].map(n => ({ ...line, line_id: `L${n}`, line_total_excl_vat: 0.1, vat_amount: 0.01 }));
    expect(run('029', h, ls).row.passed).toBe(1);
    expect(run('028', h, ls).row.passed).toBe(1);
    expect(run('029', { ...h, vat_total: 0.02 }, ls).row.failed).toBe(1);
  });
  it('rejects missing, duplicate and extra breakdown categories', () => {
    expect(run('028', { ...header, tax_breakdowns: header.tax_breakdowns!.slice(0, 1) }).row.failed).toBe(1);
    expect(run('028', { ...header, tax_breakdowns: [...header.tax_breakdowns!, header.tax_breakdowns![0]] }).row.failed).toBe(1);
    expect(run('028', header, [line]).row.failed).toBe(1);
  });
  it('does not treat a line category as a supplied breakdown', () => {
    expect(run('027', { ...header, tax_breakdowns: undefined }).row.failed).toBe(1);
    expect(run('029', { ...header, tax_breakdowns: undefined }).row.notEvaluated).toBe(1);
  });
  it('supports explicit flat single-category headers but detects hidden mixed categories', () => {
    const h = { ...header, tax_breakdowns: undefined, tax_category_code: 'S', tax_category_rate: 5, total_excl_vat: 100 };
    expect(run('028', h, [line]).row.passed).toBe(1);
    expect(run('029', h, [line]).row).toMatchObject({ passed: 0, notEvaluated: 1 });
    expect(run('028', h, lines).row.failed).toBe(1);
  });
  it.each(['Z', 'E', 'O', 'AE'])('requires zero supplier VAT for category %s', code => {
    const h = { ...header, tax_breakdowns: [{ tax_category_code: code, tax_category_rate: 0, taxable_amount: 100, tax_amount: 0 }] };
    const ls = [{ ...line, tax_category_code: code, vat_rate: 0 }];
    expect(evaluateVatBreakdowns(h, ls).matches).toBe(true);
    expect(evaluateVatBreakdowns({ ...h, tax_breakdowns: [{ ...h.tax_breakdowns[0], tax_amount: 0.01 }] }, ls).matches).toBe(false);
  });
  it('honors the standard category 0.02 boundary without binary float drift', () => {
    const base = { ...header, tax_breakdowns: [{ ...header.tax_breakdowns![0], tax_amount: 5.02 }] };
    expect(evaluateVatBreakdowns(base, [line]).matches).toBe(true);
    expect(evaluateVatBreakdowns({ ...base, tax_breakdowns: [{ ...base.tax_breakdowns[0], tax_amount: 5.03 }] }, [line]).matches).toBe(false);
  });
  it('marks unsupported category calculations unevaluated', () => {
    expect(run('028', header, [{ ...line, tax_category_code: 'UNKNOWN' }]).row).toMatchObject({ passed: 0, notEvaluated: 1 });
  });
  it('keeps the legacy VAT check consistent with the category engine', () => {
    const h = { ...header, tax_breakdowns: [{ ...header.tax_breakdowns![0], tax_amount: 8 }, header.tax_breakdowns![1]] };
    expect(checksRegistry.find(check => check.id === 'vat_calc_mismatch')!.run(context(h))).toHaveLength(1);
    expect(run('028', h).row.failed).toBe(1);
  });
});

describe('monetary CSV inputs', () => {
  const csv = (cell: string) => `invoice_id,paid_amount,tax_breakdowns\nI1,10,"${cell.replace(/"/g, '""')}"`;
  it('imports structured category amounts and prepayments', async () => {
    const parsed = await parseHeadersFile({ text: async () => csv(JSON.stringify(header.tax_breakdowns)) } as File);
    expect(parsed[0]).toMatchObject({ paid_amount: 10, tax_breakdowns: header.tax_breakdowns });
  });
  it.each(['{}', '[{"tax_category_code":"S","tax_amount":"5","taxable_amount":100}]', '[null]', 'bad json'])('rejects malformed structured input %s', async cell => {
    await expect(parseHeadersFile({ text: async () => csv(cell) } as File)).rejects.toThrow('CSV row 2: tax_breakdowns');
  });
});
