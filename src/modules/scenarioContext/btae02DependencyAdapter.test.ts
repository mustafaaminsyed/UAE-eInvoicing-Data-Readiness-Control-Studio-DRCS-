import { describe, expect, it } from 'vitest';
import { buildBtae02Assessment } from './btae02Assessment';
import { projectBtae02Dependencies } from './btae02DependencyAdapter';

const identity = { invoiceId: 'INV-1', invoiceNumber: 'A-1001' };
const result = (ruleId: string, status: 'passed' | 'failed' | 'not_applicable' | 'not_evaluated', invoiceId = 'INV-1') => ({
  ruleId, status, invoiceId, invoiceNumber: 'A-1001',
});

function status(assessment: ReturnType<typeof buildBtae02Assessment>, flag: string) {
  return assessment.declaration.positions.find((p) => p.flag === flag)?.dependency.status;
}

describe('BTAE-02 dependency adapter', () => {
  it('projects explicit statuses without changing declaration, evidence, or consistency', () => {
    const assessment = buildBtae02Assessment('00010000');
    const projected = projectBtae02Dependencies(assessment, [result('IBR-138-AE', 'passed')], identity);
    expect(projected.declaration.positions.find((p) => p.flag === 'summary_invoice')?.dependency).toMatchObject({ status: 'satisfied', ruleId: 'IBR-138-AE' });
    expect(projected.declaration.raw).toBe('00010000');
    expect(projected.consistency).toBe('not_evaluated');
    expect(projected.declaration.positions.every((p) => p.evidence.length === 0)).toBe(true);
    expect(assessment.declaration.positions.every((p) => p.dependency.status === 'not_evaluated')).toBe(true);
  });

  it.each([
    ['00010000', 'summary_invoice', 'IBR-138-AE'],
    ['00000100', 'disclosed_agent_billing', 'IBR-137-AE'],
    ['00000001', 'exports', 'IBR-152-AE'],
  ])('projects failed status for %s', (raw, flag, ruleId) => {
    const projected = projectBtae02Dependencies(buildBtae02Assessment(raw), [result(ruleId, 'failed')], identity);
    expect(status(projected, flag)).toBe('failed');
  });

  it('leaves inactive and unmapped positions appropriately isolated', () => {
    const projected = projectBtae02Dependencies(
      buildBtae02Assessment('00000000'),
      [result('IBR-138-AE', 'not_applicable'), result('IBR-137-AE', 'not_applicable'), result('IBR-152-AE', 'not_applicable')],
      identity,
    );
    expect(projected.declaration.positions.filter((p) => ['summary_invoice', 'disclosed_agent_billing', 'exports'].includes(p.flag)).every((p) => p.dependency.status === 'not_applicable')).toBe(true);
    expect(projected.declaration.positions.filter((p) => !['summary_invoice', 'disclosed_agent_billing', 'exports'].includes(p.flag)).every((p) => p.dependency.status === 'not_evaluated')).toBe(true);
  });

  it('does not match wrong invoices, unknown rules, or duplicate contradictory results', () => {
    const projected = projectBtae02Dependencies(buildBtae02Assessment('00010000'), [
      result('IBR-138-AE', 'passed', 'INV-OTHER'),
      result('IBR-999-AE', 'failed'),
      result('IBR-138-AE', 'failed'),
      result('IBR-138-AE', 'passed'),
    ], identity);
    expect(status(projected, 'summary_invoice')).toBe('not_evaluated');
  });
});
