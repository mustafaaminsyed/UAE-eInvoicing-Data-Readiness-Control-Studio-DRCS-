import { describe, expect, it } from 'vitest';
import { buildEvidencePackData } from './evidenceDataBuilder';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { RuleExecution } from '@/types/executionLedger';
import { DataContext } from '@/types/compliance';

const data: DataContext = { buyers: [], headers: [{ invoice_id: 'I1', invoice_number: '1', issue_date: '', seller_trn: '', buyer_id: '', currency: 'AED' }], lines: [], buyerMap: new Map(), headerMap: new Map(), linesByInvoice: new Map() };

describe('evidence execution provenance', () => {
  it('does not infer execution from populated datasets or exception absence', () => {
    const evidence = buildEvidencePackData('old-run', '2026-01-01', [], data.headers, [], [], []);
    expect(evidence.ruleExecution.every(row => row.execution_count === 0 && row.status === 'not_evaluated' && row.execution_source === 'unavailable')).toBe(true);
    expect(evidence.traceabilityRows.every(row => row.lastRunPassRate === null)).toBe(true);
  });
  it('uses failed records, retains finding counts, and leaves unexecuted rules unavailable', () => {
    const ledger: RuleExecution[] = [];
    const check = UAE_UC1_CHECK_PACK.find(check => check.check_id.endsWith('015'))!;
    const exceptions = runAllPintAEChecks([check], data, { onExecution: row => ledger.push(row) });
    const evidence = buildEvidencePackData('run', '2026-01-01', [], data.headers, [], exceptions, [], ledger);
    expect(evidence.ruleExecution.find(row => row.rule_id === check.check_id)).toMatchObject({ execution_count: 1, failure_count: 1, exception_count: 3, status: 'fail', execution_source: 'recorded' });
    expect(evidence.ruleExecution.find(row => row.rule_id.endsWith('001'))).toMatchObject({ execution_count: 0, status: 'not_evaluated' });
  });
  it('includes executed database-only rules with their recorded metadata', () => {
    const ledger: RuleExecution[] = [];
    const check = { ...UAE_UC1_CHECK_PACK[0], check_id: 'EXTRA-PRESENCE', check_name: 'Recorded name' };
    runAllPintAEChecks([check], data, { onExecution: row => ledger.push(row) });
    const evidence = buildEvidencePackData('run', '2026-01-01', [], data.headers, [], [], [], ledger);
    expect(evidence.ruleExecution.find(row => row.rule_id === check.check_id)).toMatchObject({ rule_name: 'Recorded name', pass_count: 1, status: 'pass' });
  });
  it('keeps traceability pass rate unavailable for skipped comparisons', () => {
    const ledger: RuleExecution[] = [];
    const check = UAE_UC1_CHECK_PACK.find(check => check.check_id.endsWith('025'))!;
    runAllPintAEChecks([check], data, { onExecution: row => ledger.push(row) });
    const evidence = buildEvidencePackData('run', '2026-01-01', [], data.headers, [], [], [], ledger);
    expect(evidence.ruleExecution.find(row => row.rule_id === check.check_id)).toMatchObject({ execution_count: 0, not_evaluated_count: 1, status: 'not_evaluated' });
    expect(evidence.traceabilityRows.every(row => row.lastRunPassRate === null)).toBe(true);
  });
});
