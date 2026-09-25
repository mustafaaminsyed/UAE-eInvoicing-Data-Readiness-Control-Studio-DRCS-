import { describe, expect, it } from 'vitest';
import { runAllPintAEChecks, runPintAECheck } from './pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';
import { DataContext, InvoiceHeader } from '@/types/compliance';
import { RuleExecution } from '@/types/executionLedger';
import { parsePartiesFile, parseHeadersFile, parseLinesFile } from '@/lib/csvParser';
import { getSampleData } from '@/lib/sampleData';

const getCheck = (suffix: string) => UAE_UC1_CHECK_PACK.find(check => check.check_id.endsWith(suffix))!;
function context(headers: InvoiceHeader[] = []): DataContext {
  return { headers, buyers: [], lines: [], headerMap: new Map(headers.map(header => [header.invoice_id, header])), buyerMap: new Map(), linesByInvoice: new Map() };
}
const header: InvoiceHeader = { invoice_id: 'I1', invoice_number: '1', issue_date: '2026-01-01', seller_trn: '100000000000001', buyer_id: 'B1', currency: 'AED' };
function run(suffix: string, data: DataContext) {
  const ledger: RuleExecution[] = [];
  const exceptions = runAllPintAEChecks([getCheck(suffix)], data, { datasetType: 'AP', onExecution: row => ledger.push(row) });
  return { exceptions, row: ledger[0] };
}

describe('recorded execution ledger', () => {
  it('counts multiple findings against one seller as one failed record', () => {
    const { row, exceptions } = run('015', context([header]));
    expect(exceptions).toHaveLength(3);
    expect(row).toMatchObject({ datasetType: 'AP', candidateCount: 1, failed: 1, passed: 0, exceptionCount: 3, status: 'fail' });
  });
  it('counts buyers rather than invoices for buyer rules', () => {
    const data = context([header, { ...header, invoice_id: 'I2' }]);
    data.buyers = [{ buyer_id: 'B1', buyer_name: 'Buyer' }];
    expect(run('017', data).row).toMatchObject({ candidateCount: 1, passed: 1 });
  });
  it('does not turn missing comparison inputs into a pass', () => {
    expect(run('025', context([header])).row).toMatchObject({ passed: 0, notEvaluated: 1, status: 'not_evaluated' });
  });
  it('records empty populations without a pass', () => {
    expect(run('001', context()).row).toMatchObject({ candidateCount: 0, passed: 0, status: 'not_evaluated', reason: 'No candidate records' });
  });
  it('separates inapplicable domestic FX from evaluated foreign FX', () => {
    const data = context([header, { ...header, invoice_id: 'I2', currency: 'USD', fx_rate: 3.67 }]);
    expect(run('008', data).row).toMatchObject({ candidateCount: 2, notApplicable: 1, passed: 1, status: 'pass' });
  });
  it('records missing optional buyer TRN as not applicable to the format rule', () => {
    const data = context(); data.buyers = [{ buyer_id: 'B1', buyer_name: 'Buyer' }];
    expect(run('018', data).row).toMatchObject({ passed: 0, notApplicable: 1, status: 'not_applicable' });
  });
  it('snapshots rule metadata instead of retaining a mutable registry reference', () => {
    const check = { ...getCheck('001'), parameters: { field: 'invoice_number' } };
    const rows: RuleExecution[] = [];
    runAllPintAEChecks([check], context([header]), { onExecution: row => rows.push(row) });
    check.parameters.field = 'changed';
    expect(rows[0].check.parameters.field).toBe('invoice_number');
  });
  it('records execution errors and the remaining unevaluated population before stopping', () => {
    const broken = { ...header, spec_id: 'test' };
    const check = { ...getCheck('010'), parameters: { allowed_prefixes: [null] } };
    // A throwing getter models an unexpected runtime failure after preflight.
    Object.defineProperty(broken, 'spec_id', { get: () => { throw new Error('record unavailable'); } });
    const rows: RuleExecution[] = [];
    expect(() => runAllPintAEChecks([check], context([broken, header]), { onExecution: row => rows.push(row) })).toThrow('record unavailable');
    expect(rows[0]).toMatchObject({ status: 'error', errors: 1, notEvaluated: 1, passed: 0 });
  });
  it.each(['AR', 'AP'] as const)('preserves existing exception output for negative %s samples', async direction => {
    const file = (dataset: 'buyers' | 'headers' | 'lines') => ({ text: async () => getSampleData(dataset, 'negative', direction).content }) as File;
    const headers = await parseHeadersFile(file('headers'), { direction });
    const data = context(headers);
    data.buyers = await parsePartiesFile(file('buyers'), { direction });
    data.lines = await parseLinesFile(file('lines'), { direction });
    data.buyerMap = new Map(data.buyers.map(buyer => [buyer.buyer_id, buyer]));
    data.lines.forEach(line => data.linesByInvoice.set(line.invoice_id, [...(data.linesByInvoice.get(line.invoice_id) || []), line]));
    const expected = UAE_UC1_CHECK_PACK.flatMap(check => runPintAECheck(check, data));
    const actual = runAllPintAEChecks(UAE_UC1_CHECK_PACK, data);
    const stripVolatile = ({ id, timestamp, ...rest }: typeof actual[number]) => rest;
    expect(actual.map(stripVolatile)).toEqual(expected.map(stripVolatile));
  });
});
