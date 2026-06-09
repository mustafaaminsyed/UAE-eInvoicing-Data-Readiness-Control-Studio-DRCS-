import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckRegistryPage from '@/pages/CheckRegistryPage';
import { checksRegistry } from '@/lib/checks/checksRegistry';
import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import {
  PINT_AE_CODELIST_GOVERNANCE_COUNTS,
  countRuntimeCodelistDomains,
} from '@/lib/pintAE/codelistGovernanceSummary';

vi.mock('@/lib/api/checksApi', () => ({
  fetchAllCustomChecks: vi.fn(async () => []),
}));

function expectSummaryCard(label: string, value: number | string) {
  const labelNode = screen.getByText(label);
  let card = labelNode.parentElement as HTMLElement | null;
  while (card && !within(card).queryByText(String(value))) {
    card = card.parentElement as HTMLElement | null;
  }
  expect(card).toBeTruthy();
  expect(within(card as HTMLElement).getByText(String(value))).toBeInTheDocument();
}

describe('CheckRegistryPage KPI summaries', () => {
  it('renders customer-friendly runtime and codelist coverage KPI cards', async () => {
    render(<CheckRegistryPage />);

    const builtInCount = checksRegistry.length;
    const uc1Count = UAE_UC1_CHECK_PACK.length;
    const enabledTotalChecks = builtInCount + uc1Count;
    const runtimeCodelistDomains = countRuntimeCodelistDomains(UAE_UC1_CHECK_PACK);
    const codelistCoveragePct = Math.round(
      (runtimeCodelistDomains / PINT_AE_CODELIST_GOVERNANCE_COUNTS.governedCodedDomains) * 100
    );

    await waitFor(() => {
      expectSummaryCard('Active Runtime Checks', enabledTotalChecks);
      expectSummaryCard('UAE UC1 Active', `${uc1Count}/${uc1Count}`);
      expectSummaryCard('Built-in Core Checks', builtInCount);
      expectSummaryCard('Custom Active', '0/0');

      expectSummaryCard('Implemented Codelist Domains', runtimeCodelistDomains);
      expectSummaryCard('Unconditional Enforcement', PINT_AE_CODELIST_GOVERNANCE_COUNTS.enforceableNow);
      expectSummaryCard('Conditional Enforcement', PINT_AE_CODELIST_GOVERNANCE_COUNTS.conditional);
      expectSummaryCard('Deferred Domains', PINT_AE_CODELIST_GOVERNANCE_COUNTS.deferredOrNonRuntime);

      expect(screen.getByText('Runtime Coverage')).toBeInTheDocument();
      expect(screen.getByText(`${codelistCoveragePct}%`)).toBeInTheDocument();
      expect(
        screen.getByText(
          `${runtimeCodelistDomains}/${PINT_AE_CODELIST_GOVERNANCE_COUNTS.governedCodedDomains} governed domains`
        )
      ).toBeInTheDocument();
    });
  });
});
