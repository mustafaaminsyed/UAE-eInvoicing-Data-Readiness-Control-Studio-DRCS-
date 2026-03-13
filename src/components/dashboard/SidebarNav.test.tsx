import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    isDataLoaded: true,
    isChecksRun: true,
  }),
}));

describe('SidebarNav', () => {
  it('places Traceability after Check Registry in the left navigation', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SidebarNav />
      </MemoryRouter>
    );

    const checkRegistryLink = screen.getByRole('link', { name: /check registry/i });
    const traceabilityLink = screen.getByRole('link', { name: /traceability/i });

    expect(checkRegistryLink.compareDocumentPosition(traceabilityLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
