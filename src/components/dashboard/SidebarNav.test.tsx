import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SidebarNav } from '@/components/dashboard/SidebarNav';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';

describe('SidebarNav', () => {
  it('renders the workflow sections in the new workspace order', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SidebarProvider>
          <Sidebar collapsible="none">
            <SidebarNav />
          </Sidebar>
        </SidebarProvider>
      </MemoryRouter>
    );

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const submissionsLink = screen.getByRole('link', { name: /submissions/i });
    const dataTwinLink = screen.getByRole('link', { name: /data twin/i });
    const validationLink = screen.getByRole('link', { name: /validation/i });
    const exceptionsLink = screen.getByRole('link', { name: /exceptions/i });
    const evidenceLink = screen.getByRole('link', { name: /evidence/i });
    const analyticsLink = screen.getByRole('link', { name: /analytics/i });
    const settingsLink = screen.getByRole('link', { name: /settings/i });

    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    expect(dashboardLink.compareDocumentPosition(submissionsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(submissionsLink.compareDocumentPosition(dataTwinLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(dataTwinLink.compareDocumentPosition(validationLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(validationLink.compareDocumentPosition(exceptionsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(exceptionsLink.compareDocumentPosition(evidenceLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(evidenceLink.compareDocumentPosition(analyticsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(analyticsLink.compareDocumentPosition(settingsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
