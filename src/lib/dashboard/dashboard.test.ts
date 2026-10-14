import { describe, expect, it } from 'vitest';

import {
  average,
  buildBlockingIssues,
  buildDashboardSnapshot,
  clampScore,
  computeCompleteness,
  computeConditionalCoverage,
  computeCreditNoteCoverage,
  computeCurrencyMismatchCount,
  computeDuplicateInvoiceRatio,
  computeInvalidCodelistCount,
  computeNullFieldRate,
  deriveExceptionThemes,
  describeReadiness,
  formatPercent,
  getRunModeBadge,
  readinessBand,
  weightedAverage,
} from './index';
import type { DashboardException } from './index';

const exception = (overrides: Partial<DashboardException>): DashboardException => ({
  id: 'e1',
  checkId: 'CHK-1',
  checkName: 'Generic check',
  severity: 'Low',
  message: '',
  ...overrides,
});

describe('scoring helpers', () => {
  it('clamps and rounds scores into 0-100', () => {
    expect(clampScore(120)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(72.6)).toBe(73);
  });

  it('averages finite values only', () => {
    expect(average([10, Number.NaN, 20])).toBe(15);
    expect(average([])).toBe(0);
  });

  it('weights scores and tolerates zero total weight', () => {
    expect(weightedAverage([])).toBe(0);
    expect(
      weightedAverage([
        { label: 'a', score: 100, weight: 1, summary: '' },
        { label: 'b', score: 50, weight: 3, summary: '' },
      ])
    ).toBe(62.5);
  });
});

describe('data quality metrics', () => {
  it('computes mandatory field completeness across records and fields', () => {
    const records = [
      { a: 'x', b: '' },
      { a: 'y', b: 'z' },
    ];
    expect(computeCompleteness(records, ['a', 'b'])).toBe(75);
    expect(computeCompleteness([], ['a'])).toBe(0);
  });

  it('computes the null field rate over all governed slots', () => {
    expect(computeNullFieldRate([{ records: [{ a: 'x', b: '' }], fields: ['a', 'b'] }])).toBe(50);
    expect(computeNullFieldRate([])).toBe(0);
  });

  it('counts extra rows sharing an invoice number as duplicates', () => {
    const headers = [{ invoice_number: 'A' }, { invoice_number: 'A' }, { invoice_number: 'B' }, { invoice_number: 'C' }];
    expect(computeDuplicateInvoiceRatio(headers)).toBe(25);
  });

  it('flags currency and tax-currency conflicts', () => {
    const headers = [
      { currency: 'AED', tax_currency: 'AED' },
      { currency: 'USD', tax_currency: 'AED', fx_rate: 3.67 },
      { currency: 'USD', tax_currency: 'USD', fx_rate: 1 },
      { currency: 'USD', tax_currency: 'AED', fx_rate: 0 },
      { currency: 'AED', tax_currency: 'USD' },
      { currency: '' },
    ];
    expect(computeCurrencyMismatchCount(headers)).toBe(3);
  });

  it('computes conditional field coverage and qualifying documents', () => {
    const headers = [
      { currency: 'USD', amount_due: 100, payment_due_date: '2026-01-01', fx_rate: 3.67, tax_currency: 'AED' },
      { invoice_type: '381', currency: 'AED', credit_note_reason_code: 'VD', credit_note_reason_text: '' },
    ];
    const buyers = [{ buyer_name: 'X', buyer_trn: '' }];
    const result = computeConditionalCoverage(headers, buyers);
    expect(result.qualifyingDocumentCount).toBe(2);
    expect(result.completeness).toBeCloseTo(66.67, 1);
    expect(computeConditionalCoverage([], [])).toEqual({ completeness: 100, qualifyingDocumentCount: 0 });
  });

  it('computes credit-note scenario coverage', () => {
    expect(computeCreditNoteCoverage([]).count).toBe(0);
    expect(computeCreditNoteCoverage([]).coverage).toBe(100);

    const voided = computeCreditNoteCoverage([
      { invoice_type: '381', credit_note_reason_code: 'VD', credit_note_reason_text: 'x' },
    ]);
    expect(voided.coverage).toBe(100);
    expect(voided.referenceCoverage).toBe(100);

    const unreferenced = computeCreditNoteCoverage([
      { invoice_type: '381', credit_note_reason_code: 'RT', credit_note_reason_text: 'x' },
    ]);
    expect(unreferenced.coverage).toBe(0);
    expect(unreferenced.reasonCoverage).toBe(100);
    expect(unreferenced.referenceCoverage).toBe(0);
  });
});

describe('exception helpers', () => {
  it('counts codelist-style exceptions by text match', () => {
    const list = [exception({ checkName: 'Currency code invalid', message: 'x' }), exception({ checkName: 'Seller name missing', message: 'x' })];
    expect(computeInvalidCodelistCount(list)).toBe(1);
  });

  it('groups exceptions into themes', () => {
    const themes = deriveExceptionThemes([
      exception({ checkName: 'Buyer TRN invalid' }),
      exception({ checkName: 'VAT amount mismatch' }),
      exception({ checkName: 'Invoice number sequence' }),
    ]);
    expect(themes.map((theme) => theme.value)).toEqual(['1', '1', '1']);
  });

  it('groups blocking issues by check, keeps the highest severity, and sorts by count', () => {
    const issues = buildBlockingIssues([
      exception({ id: '1', checkId: 'A', checkName: 'A', severity: 'High', invoiceId: 'inv1' }),
      exception({ id: '2', checkId: 'A', checkName: 'A', severity: 'Critical', invoiceId: 'inv2' }),
      exception({ id: '3', checkId: 'B', checkName: 'B', severity: 'Low' }),
    ]);
    expect(issues[0]).toMatchObject({ key: 'A', count: 2, affectedInvoices: 2, severity: 'Critical', hasInvoiceCoverage: true });
    expect(issues[1]).toMatchObject({ key: 'B', count: 1, affectedInvoices: 0, hasInvoiceCoverage: false });
  });
});

describe('presentation helpers', () => {
  it('bands readiness scores', () => {
    expect(readinessBand(null).label).toBe('Awaiting data');
    expect(readinessBand(95).label).toBe('Ready');
    expect(readinessBand(80).label).toBe('Watch');
    expect(readinessBand(50).label).toBe('Blocked');
  });

  it('formats percentages and handles null', () => {
    expect(formatPercent(null)).toBe('N/A');
    expect(formatPercent(12.345, 1)).toBe('12.3%');
  });

  it('treats active critical issues as remediation-first', () => {
    expect(describeReadiness(80, 2)).toMatch(/remediation-first/);
  });

  it('describes the run mode badge', () => {
    expect(getRunModeBadge(null)).toBeNull();
    expect(getRunModeBadge({ run_mode: 'diagnostic_mapping', mapping_coverage_percent: 66.4 })).toMatchObject({
      label: 'Diagnostic run',
      detail: 'Mapped coverage 66%',
    });
  });
});

describe('buildDashboardSnapshot', () => {
  const baseInput = {
    dataset: 'AR' as const,
    isChecksRun: false,
    isDataLoaded: false,
    stats: { totalInvoices: 0, exceptionsBySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 } },
    checkResults: [],
    exceptions: [],
    buyers: [],
    headers: [],
    lines: [],
    validationExecutions: [],
  };
  type SnapshotInput = Parameters<typeof buildDashboardSnapshot>[0];

  it('returns an empty snapshot when no live data exists', () => {
    const snapshot = buildDashboardSnapshot(baseInput as unknown as SnapshotInput);
    expect(snapshot.hasLiveSignals).toBe(false);
    expect(snapshot.modeLabel).toBe('No live data loaded');
    expect(snapshot.totalInvoices).toBe(0);
    expect(snapshot.complianceReadiness).toBeNull();
    expect(snapshot.goLiveReadiness).toBeNull();
    expect(snapshot.blockingIssues).toEqual([]);
  });

  it('builds a live snapshot from loaded headers', () => {
    const header = {
      invoice_id: 'I1',
      invoice_number: 'N1',
      issue_date: '2026-01-01',
      invoice_type: '380',
      currency: 'AED',
      buyer_id: 'B1',
    };
    const snapshot = buildDashboardSnapshot({
      ...baseInput,
      isDataLoaded: true,
      stats: { totalInvoices: 2, exceptionsBySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 } },
      headers: [header, { ...header, invoice_id: 'I2', invoice_number: 'N2' }],
    } as unknown as SnapshotInput);

    expect(snapshot.hasLiveSignals).toBe(true);
    expect(snapshot.modeLabel).toBe('Live data loaded');
    expect(snapshot.totalInvoices).toBe(2);
    expect(snapshot.headerCompleteness).toBe(100);
    expect(snapshot.duplicateInvoiceRatio).toBe(0);
    expect(snapshot.complianceReadiness).toBeGreaterThanOrEqual(0);
    expect(snapshot.complianceReadiness).toBeLessThanOrEqual(100);
    expect(snapshot.goLiveReadiness).not.toBeNull();
  });
});
