import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SidebarNav } from '@/components/dashboard/SidebarNav';
import { getWorkflowSection } from '@/components/dashboard/workflowSections';
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

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard', exact: true });
    const submissionsLink = screen.getByRole('link', { name: 'Submissions', exact: true });
    const dataTwinLink = screen.getByRole('link', { name: 'Data Twin', exact: true });
    const validationLink = screen.getByRole('link', { name: 'Validation', exact: true });
    const exceptionsLink = screen.getByRole('link', { name: 'Exceptions', exact: true });
    const evidenceLink = screen.getByRole('link', { name: 'Evidence', exact: true });
    const analyticsLink = screen.getByRole('link', { name: /^Analytics/ });
    const settingsLink = screen.getByRole('link', { name: /^Settings/ });

    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    expect(dashboardLink.compareDocumentPosition(submissionsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(submissionsLink.compareDocumentPosition(dataTwinLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(dataTwinLink.compareDocumentPosition(validationLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(validationLink.compareDocumentPosition(exceptionsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(exceptionsLink.compareDocumentPosition(evidenceLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(evidenceLink.compareDocumentPosition(analyticsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(analyticsLink.compareDocumentPosition(settingsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps core operational pages in the persistent navigation', () => {
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <SidebarProvider>
          <Sidebar collapsible="none">
            <SidebarNav />
          </Sidebar>
        </SidebarProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /upload workspace/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /upload audit/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /field mapping/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check builder/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /evidence pack/i })).toBeInTheDocument();
  });

  it('provides a route-aware shell title for operational subpages', () => {
    expect(getWorkflowSection('/upload')?.label).toBe('Upload workspace');
    expect(getWorkflowSection('/invoice/invoice-123')?.label).toBe('Invoice detail');
  });
});
