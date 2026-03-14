import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CheckRegistryPage from '@/pages/CheckRegistryPage';

vi.mock('@/lib/api/checksApi', () => ({
  fetchAllCustomChecks: vi.fn(async () => []),
}));

describe('CheckRegistryPage DR linkage display', () => {
  it('separates authoritative DR coverage mappings from metadata-only reference terms', async () => {
    render(<CheckRegistryPage />);

    expect(await screen.findByText('Validation Classes')).toBeInTheDocument();
    const card = await waitFor(() => screen.getByTestId('check-card-UAE-UC1-CHK-004'));

    expect(within(card).getByText('Authoritative DR Coverage')).toBeInTheDocument();
    expect(within(card).getByText('Reference Terms')).toBeInTheDocument();
    expect(within(card).getByText('Class: Structural Rule')).toBeInTheDocument();
    expect(within(card).getByText('Layer: Schema')).toBeInTheDocument();
    expect(
      within(card).getByText('Metadata only. These terms do not determine runtime DR coverage.')
    ).toBeInTheDocument();
    expect(within(card).getAllByText('IBT-003').length).toBeGreaterThan(0);
    expect(within(card).getByText('BTUAE-02')).toBeInTheDocument();
  });
});
