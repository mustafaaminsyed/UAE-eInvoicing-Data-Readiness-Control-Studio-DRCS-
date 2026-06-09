import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import EvidenceWorkspacePage from '@/pages/EvidenceWorkspacePage';

describe('EvidenceWorkspacePage', () => {
  it('renders evidence summary cards, updates the detail panel, and filters by status', () => {
    render(
      <MemoryRouter initialEntries={['/evidence']}>
        <Routes>
          <Route path="/evidence" element={<EvidenceWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Evidence Packs Generated')).toBeInTheDocument();
    expect(screen.getByText('Pending Evidence Items')).toBeInTheDocument();
    expect(screen.getByText('Evidence inventory')).toBeInTheDocument();
    expect(screen.getByText('Evidence ID')).toBeInTheDocument();
    expect(screen.getByText('Traceability coverage')).toBeInTheDocument();

    fireEvent.click(screen.getByText('INV-10411'));

    expect(screen.getByText('Selected evidence')).toBeInTheDocument();
    expect(screen.getByText('Evidence summary')).toBeInTheDocument();
    expect(screen.getByText('Recommended next action')).toBeInTheDocument();
    expect(screen.getByText('Buyer identity mapping review')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'Pending' }));

    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.queryByText('EVP-2026-031')).not.toBeInTheDocument();
  });
});
