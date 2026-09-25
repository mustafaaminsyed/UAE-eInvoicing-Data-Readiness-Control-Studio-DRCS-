import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EvidencePackPage from './EvidencePackPage';
import { useCompliance } from '@/context/ComplianceContext';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { RuleExecution } from '@/types/executionLedger';

let context: Partial<ReturnType<typeof useCompliance>>;
vi.mock('@/context/ComplianceContext', () => ({ useCompliance: () => context }));
vi.mock('@/lib/evidence/evidenceExporter', () => ({ validateBeforeExport: vi.fn(), generateEvidencePackZip: vi.fn(), generateEvidencePackPdf: vi.fn(), downloadBlob: vi.fn() }));
afterEach(cleanup);

describe('evidence execution display', () => {
  it('shows unavailable rates rather than 100% when no records were evaluated', () => {
    const executions: RuleExecution[] = [];
    runAllPintAEChecks([UAE_UC1_CHECK_PACK[0]], { buyers: [], headers: [], lines: [], buyerMap: new Map(), headerMap: new Map(), linesByInvoice: new Map() }, { onExecution: row => executions.push(row) });
    context = { buyers: [], headers: [], lines: [], pintAEExceptions: [], direction: 'AR', isChecksRun: true, executionSnapshot: { runId: 'current-run', timestamp: '2026-01-01T00:00:00Z', datasetType: 'AR', executions } };
    render(<EvidencePackPage />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Rules' }), { button: 0, ctrlKey: false });
    const panel = screen.getByRole('tabpanel', { name: 'Rules' });
    expect(within(panel).queryByText('100.0%')).not.toBeInTheDocument();
    expect(within(panel).getAllByText('not evaluated').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText(/Historical exports require/)).toBeInTheDocument();
  });
  it('does not offer export for a mismatched dataset', () => {
    context = { buyers: [], headers: [], lines: [], pintAEExceptions: [], direction: 'AP', isChecksRun: true, executionSnapshot: { runId: 'AR-run', timestamp: '2026-01-01T00:00:00Z', datasetType: 'AR', executions: [] } };
    render(<EvidencePackPage />);
    expect(screen.queryByRole('button', { name: 'Generate Evidence Pack' })).not.toBeInTheDocument();
    expect(screen.getByText(/Run compliance checks first/)).toBeInTheDocument();
  });
});
