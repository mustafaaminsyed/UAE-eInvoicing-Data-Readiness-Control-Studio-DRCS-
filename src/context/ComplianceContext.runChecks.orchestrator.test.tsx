import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComplianceProvider, useCompliance } from '@/context/ComplianceContext';
import { ParsedData } from '@/types/compliance';
import { runChecksOrchestrator } from '@/engine/orchestrator';
import { saveCheckRun, saveEntityScores } from '@/lib/api/checksApi';
import {
  calculateClientScores,
  generateRunSummary,
  saveClientRiskScores,
  saveExceptions,
  saveRunSummary,
} from '@/lib/api/pintAEApi';

vi.mock('@/engine/orchestrator', () => ({
  runChecksOrchestrator: vi.fn(),
}));

vi.mock('@/lib/api/checksApi', () => ({
  saveCheckRun: vi.fn(),
  saveEntityScores: vi.fn(),
}));

vi.mock('@/lib/api/pintAEApi', () => ({
  saveExceptions: vi.fn(),
  saveRunSummary: vi.fn(),
  saveClientRiskScores: vi.fn(),
  calculateClientScores: vi.fn(),
  generateRunSummary: vi.fn(),
}));

const arData: ParsedData = {
  buyers: [{ buyer_id: 'B-1', buyer_name: 'Buyer One' }],
  headers: [
    {
      invoice_id: 'INV-1',
      invoice_number: 'A-1001',
      issue_date: '2026-03-11',
      seller_trn: '123456789012345',
      buyer_id: 'B-1',
      currency: 'AED',
    },
  ],
  lines: [
    {
      line_id: 'L-1',
      invoice_id: 'INV-1',
      line_number: 1,
      quantity: 1,
      unit_price: 100,
      line_total_excl_vat: 100,
      vat_rate: 5,
      vat_amount: 5,
    },
  ],
};

function Harness() {
  const context = useCompliance();
  return (
    <div>
      <button type="button" onClick={() => context.setData(arData, 'AR')}>set-data</button>
      <button type="button" onClick={() => context.runChecks()}>run-checks</button>
      <span data-testid="exceptions-count">{context.exceptions.length}</span>
      <span data-testid="check-results-count">{context.checkResults.length}</span>
      <span data-testid="pint-count">{context.pintAEExceptions.length}</span>
    </div>
  );
}

describe('ComplianceContext.runChecks delegation', () => {
  it('delegates to orchestrator and preserves persistence payload semantics', async () => {
    const mockedRunChecksOrchestrator = vi.mocked(runChecksOrchestrator);
    const mockedSaveCheckRun = vi.mocked(saveCheckRun);
    const mockedSaveEntityScores = vi.mocked(saveEntityScores);
    const mockedSaveExceptions = vi.mocked(saveExceptions);
    const mockedSaveClientRiskScores = vi.mocked(saveClientRiskScores);
    const mockedSaveRunSummary = vi.mocked(saveRunSummary);
    const mockedCalculateClientScores = vi.mocked(calculateClientScores);
    const mockedGenerateRunSummary = vi.mocked(generateRunSummary);

    mockedRunChecksOrchestrator.mockResolvedValue({
      dataContext: {
        buyers: arData.buyers,
        headers: arData.headers,
        lines: arData.lines,
        buyerMap: new Map([['B-1', arData.buyers[0]]]),
        headerMap: new Map([['INV-1', arData.headers[0]]]),
        linesByInvoice: new Map([['INV-1', [arData.lines[0]]]]),
      },
      builtInResults: [
        {
          checkId: 'buyer_trn_missing',
          checkName: 'Buyer TRN Missing',
          severity: 'Critical',
          passed: 0,
          failed: 1,
          exceptions: [
            {
              id: 'core-1',
              checkId: 'buyer_trn_missing',
              checkName: 'Buyer TRN Missing',
              severity: 'Critical',
              message: 'Missing TRN',
            },
          ],
        },
      ],
      coreTelemetry: [
        {
          rule_id: 'buyer_trn_missing',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
      pintAEChecks: [
        {
          check_id: 'UAE-UC1-CHK-001',
          check_name: 'Invoice Number Present',
          scope: 'Header',
          rule_type: 'structural_rule',
          execution_layer: 'schema',
          severity: 'Critical',
          pint_reference_terms: ['IBT-001'],
          owner_team_default: 'Client Finance',
          is_enabled: true,
          parameters: { field: 'invoice_number' },
        },
      ],
      pintExceptions: [
        {
          id: 'pint-1',
          timestamp: '2026-03-11T01:00:00.000Z',
          check_id: 'UAE-UC1-CHK-001',
          check_name: 'Invoice Number Present',
          severity: 'Critical',
          scope: 'Header',
          rule_type: 'structural_rule',
          execution_layer: 'schema',
          pint_reference_terms: ['IBT-001'],
          invoice_id: 'INV-1',
          invoice_number: 'A-1001',
          seller_trn: '123456789012345',
          buyer_id: 'B-1',
          field_name: 'invoice_number',
          observed_value: '(empty)',
          expected_value_or_rule: 'Required value',
          message: 'Missing invoice number',
          root_cause_category: 'Unclassified',
          owner_team: 'Client Finance',
          sla_target_hours: 4,
          case_status: 'Open',
        },
      ],
      pintTelemetry: [
        {
          rule_id: 'UAE-UC1-CHK-001',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
      legacyPintExceptions: [],
      orgProfileExceptions: [],
      orgProfileTelemetry: [
        {
          rule_id: 'org_profile_our_entity_alignment',
          execution_count: 1,
          failure_count: 0,
          execution_source: 'runtime',
        },
      ],
      allExceptions: [
        {
          id: 'core-1',
          checkId: 'buyer_trn_missing',
          checkName: 'Buyer TRN Missing',
          severity: 'Critical',
          message: 'Missing TRN',
          datasetType: 'AR',
          direction: 'AR',
          ruleId: 'buyer_trn_missing',
          rulesetVersion: 'v1.0.0',
          status: 'Open',
        },
      ],
      runArtifact: {
        startedAt: '2026-03-11T01:00:00.000Z',
        endedAt: '2026-03-11T01:00:01.000Z',
        scope: 'AR',
        layerResults: [],
        findings: [],
      },
    });

    mockedSaveCheckRun.mockResolvedValue('run-1');
    mockedSaveExceptions.mockResolvedValue(true);
    mockedSaveClientRiskScores.mockResolvedValue(true);
    mockedSaveRunSummary.mockResolvedValue(true);
    mockedSaveEntityScores.mockResolvedValue(true);
    mockedCalculateClientScores.mockReturnValue([]);
    mockedGenerateRunSummary.mockReturnValue({
      run_id: 'run-1',
      total_invoices_tested: 1,
      total_exceptions: 1,
      pass_rate_percent: 0,
      exceptions_by_severity: { Critical: 1, High: 0, Medium: 0, Low: 0 },
      top_10_failing_checks: [],
      top_10_clients_by_risk: [],
    });

    render(
      <ComplianceProvider>
        <Harness />
      </ComplianceProvider>
    );

    fireEvent.click(screen.getByText('set-data'));
    fireEvent.click(screen.getByText('run-checks'));

    await waitFor(() => {
      expect(mockedRunChecksOrchestrator).toHaveBeenCalledTimes(1);
    });

    expect(mockedSaveCheckRun).toHaveBeenCalledTimes(1);
    const saveCheckRunPayload = mockedSaveCheckRun.mock.calls[0][0];
    expect(saveCheckRunPayload.total_exceptions).toBe(1);
    expect(saveCheckRunPayload.results_summary.checkCount).toBe(2);
    expect(saveCheckRunPayload.results_summary.rulesetVersion).toBe('v1.0.0');
    expect(saveCheckRunPayload.results_summary.evidenceSnapshot).toMatchObject({
      version: 1,
      counts: {
        totalInvoices: 1,
        totalBuyers: 1,
        totalLines: 1,
      },
    });
    expect(saveCheckRunPayload.results_summary.evidenceRuleExecutionTelemetry).toEqual([
      {
        rule_id: 'buyer_trn_missing',
        execution_count: 1,
        failure_count: 1,
        execution_source: 'runtime',
      },
      {
        rule_id: 'UAE-UC1-CHK-001',
        execution_count: 1,
        failure_count: 1,
        execution_source: 'runtime',
      },
      {
        rule_id: 'org_profile_our_entity_alignment',
        execution_count: 1,
        failure_count: 0,
        execution_source: 'runtime',
      },
    ]);

    expect(mockedSaveExceptions).toHaveBeenCalledTimes(1);
    expect(mockedSaveClientRiskScores).toHaveBeenCalledTimes(1);
    expect(mockedSaveRunSummary).toHaveBeenCalledTimes(1);
    expect(mockedSaveEntityScores).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByTestId('exceptions-count').textContent).toBe('1');
      expect(screen.getByTestId('check-results-count').textContent).toBe('1');
      expect(screen.getByTestId('pint-count').textContent).toBe('1');
    });
  });
});
