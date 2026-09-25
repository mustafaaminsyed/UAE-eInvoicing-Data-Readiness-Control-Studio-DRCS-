import { describe, expect, it } from 'vitest';
import { runAllPintAEChecks, runPintAECheck } from './pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';
import { DataContext } from '@/types/compliance';

const empty: DataContext = { buyers: [], headers: [], lines: [], buyerMap: new Map(), headerMap: new Map(), linesByInvoice: new Map() };
const check = (id: string) => ({ ...UAE_UC1_CHECK_PACK.find(item => item.check_id === id)! });

describe('PINT execution integrity', () => {
  it('rejects an empty enabled ruleset', () => {
    expect(() => runAllPintAEChecks([], empty)).toThrow(/enabled/i);
    expect(() => runAllPintAEChecks(UAE_UC1_CHECK_PACK.map(item => ({ ...item, is_enabled: false })), empty)).toThrow(/enabled/i);
  });
  it('rejects unsupported rules even with no records to evaluate', () => {
    expect(() => runPintAECheck({ ...check('UAE-UC1-CHK-021'), check_id: 'CUSTOM-MATH' }, empty)).toThrow(/CUSTOM-MATH/);
  });
  it.each(['UAE-UC1-CHK-001', 'UAE-UC1-CHK-003', 'UAE-UC1-CHK-016', 'UAE-UC1-CHK-022'])("rejects missing executor parameters for %s", id => {
    expect(() => runPintAECheck({ ...check(id), parameters: {} }, empty)).toThrow(id);
  });
  it('rejects unknown codelists instead of accepting an empty population', () => {
    expect(() => runPintAECheck({ ...check('UAE-UC1-CHK-006'), check_id: 'EXTRA-CODE', parameters: { field: 'currency', codelist: 'missing-list' } }, empty)).toThrow(/missing-list/);
  });
  it('rejects changed executor types on known IDs', () => {
    expect(() => runPintAECheck({ ...check('UAE-UC1-CHK-001'), rule_type: 'Math' }, empty)).toThrow(/UAE-UC1-CHK-001/);
  });
  it('accepts the complete built-in pack', () => {
    expect(() => runAllPintAEChecks(UAE_UC1_CHECK_PACK, empty)).not.toThrow();
  });
  it('rejects duplicate enabled IDs', () => {
    expect(() => runAllPintAEChecks([check('UAE-UC1-CHK-001'), check('UAE-UC1-CHK-001')], empty)).toThrow(/Duplicate/);
  });
  it('rejects a malformed pattern before evaluating records', () => {
    expect(() => runPintAECheck({ ...check('UAE-UC1-CHK-003'), parameters: { field: 'issue_date', pattern: '[' } }, empty)).toThrow(/regular expression/);
  });
  it.each([NaN, Infinity, -1, '0.01'])('rejects unsafe tolerance %s', tolerance => {
    expect(() => runPintAECheck({ ...check('UAE-UC1-CHK-021'), parameters: { tolerance } }, empty)).toThrow(/tolerance/);
  });
  it('ignores disabled unsupported rules', () => {
    expect(() => runAllPintAEChecks([...UAE_UC1_CHECK_PACK, { ...check('UAE-UC1-CHK-021'), check_id: 'DISABLED-MATH', is_enabled: false }], empty)).not.toThrow();
  });
});
