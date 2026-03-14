import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckRegistryPage from '@/pages/CheckRegistryPage';

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

    await waitFor(() => {
      expectSummaryCard('Active Runtime Checks', 64);
      expectSummaryCard('UAE UC1 Active', '54/54');
      expectSummaryCard('Built-in Core Checks', 10);
      expectSummaryCard('Custom Active', '0/0');

      expectSummaryCard('Implemented Codelist Domains', 9);
      expectSummaryCard('Unconditional Enforcement', 5);
      expectSummaryCard('Conditional Enforcement', 4);
      expectSummaryCard('Deferred Domains', 13);

      expect(screen.getByText('Runtime Coverage')).toBeInTheDocument();
      expect(screen.getByText('41%')).toBeInTheDocument();
      expect(screen.getByText('9/22 governed domains')).toBeInTheDocument();
    });
  });
});
