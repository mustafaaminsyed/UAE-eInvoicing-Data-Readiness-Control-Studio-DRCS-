import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComplianceProvider, useCompliance } from './ComplianceContext';
import { fetchEnabledPintAEChecks } from '@/lib/api/pintAEApi';
import { saveCheckRun } from '@/lib/api/checksApi';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

vi.mock('@/lib/api/pintAEApi', () => ({
  seedUC1CheckPack: vi.fn(async () => ({ success: true })),
  fetchEnabledPintAEChecks: vi.fn(),
  saveExceptions: vi.fn(), saveRunSummary: vi.fn(), saveClientRiskScores: vi.fn(),
  calculateClientScores: vi.fn(), generateRunSummary: vi.fn(),
}));
vi.mock('@/lib/api/checksApi', () => ({ saveCheckRun: vi.fn(async () => null), saveEntityScores: vi.fn() }));

function Harness() {
  const context = useCompliance();
  const [error, setError] = useState('');
  return <>
    <button onClick={() => context.setData({ buyers: [], lines: [], headers: [{ invoice_id: 'I1', invoice_number: '1', issue_date: '2026-01-01', seller_trn: '100000000000001', buyer_id: '', currency: 'AED' }] })}>load</button>
    <button onClick={() => { setError(''); void context.runChecks().catch(error => setError(error.message)); }}>run</button>
    <button onClick={() => context.setActiveDatasetType('AP')}>switch</button>
    <span data-testid="ledger">{context.executionSnapshot?.executions.length || 0}</span>
    <span data-testid="running">{String(context.isRunning)}</span>
    <span data-testid="complete">{String(context.isChecksRun)}</span>
    <span data-testid="exceptions">{context.exceptions.length}</span>
    <span data-testid="timestamp">{context.lastChecksRunAt ?? 'none'}</span>
    <span role="alert">{error}</span>
  </>;
}

describe('failed assessment state', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchEnabledPintAEChecks).mockResolvedValue(UAE_UC1_CHECK_PACK);
  });
  it('clears an earlier result, resets running state, and does not save when rules cannot load', async () => {
    render(<ComplianceProvider><Harness /></ComplianceProvider>);
    fireEvent.click(screen.getByText('load'));
    fireEvent.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByTestId('complete')).toHaveTextContent('true'));
    await waitFor(() => expect(screen.getByTestId('running')).toHaveTextContent('false'));
    expect(saveCheckRun).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ledger')).toHaveTextContent('35');
    expect(vi.mocked(saveCheckRun).mock.calls[0][0].results_summary).toMatchObject({ executionLedgerVersion: 1, pintAEExecutions: expect.arrayContaining([expect.objectContaining({ engineVersion: 'uc1-execution-v3', datasetType: 'AR' })]) });
    vi.mocked(fetchEnabledPintAEChecks).mockRejectedValueOnce(new Error('Rules unavailable'));
    fireEvent.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Rules unavailable'));
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
    expect(screen.getByTestId('running')).toHaveTextContent('false');
    expect(screen.getByTestId('exceptions')).toHaveTextContent('0');
    expect(screen.getByTestId('timestamp')).toHaveTextContent('none');
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(saveCheckRun).toHaveBeenCalledTimes(1);
    expect(fetchEnabledPintAEChecks).toHaveBeenLastCalledWith({ forExecution: true });
  });
  it('does not publish or save results when an unsupported rule is enabled', async () => {
    vi.mocked(fetchEnabledPintAEChecks).mockResolvedValue([{ ...UAE_UC1_CHECK_PACK[0], check_id: 'UNSUPPORTED', rule_type: 'Math' }]);
    render(<ComplianceProvider><Harness /></ComplianceProvider>);
    fireEvent.click(screen.getByText('load'));
    fireEvent.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('UNSUPPORTED'));
    expect(screen.getByTestId('running')).toHaveTextContent('false');
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
    expect(saveCheckRun).not.toHaveBeenCalled();
  });
  it('invalidates evidence when the visible dataset changes', async () => {
    render(<ComplianceProvider><Harness /></ComplianceProvider>);
    fireEvent.click(screen.getByText('load'));
    fireEvent.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByTestId('running')).toHaveTextContent('false'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('35');
    fireEvent.click(screen.getByText('switch'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
  });
  it('does not publish stale evidence when data is replaced during rule loading', async () => {
    let finishLoading!: (checks: typeof UAE_UC1_CHECK_PACK) => void;
    vi.mocked(fetchEnabledPintAEChecks).mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; }));
    render(<ComplianceProvider><Harness /></ComplianceProvider>);
    fireEvent.click(screen.getByText('load'));
    fireEvent.click(screen.getByText('run'));
    await waitFor(() => expect(fetchEnabledPintAEChecks).toHaveBeenCalled());
    fireEvent.click(screen.getByText('load'));
    finishLoading(UAE_UC1_CHECK_PACK);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('changed during validation'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
    expect(saveCheckRun).not.toHaveBeenCalled();
  });
});
