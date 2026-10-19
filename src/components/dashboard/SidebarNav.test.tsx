import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarNav } from '@/components/dashboard/SidebarNav';
import { getWorkflowSection } from '@/components/dashboard/workflowSections';
import { Sidebar, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

const complianceState = {
  isDataLoaded: false,
  isChecksRun: false,
};

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => complianceState,
}));

describe('SidebarNav', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    complianceState.isDataLoaded = false;
    complianceState.isChecksRun = false;
  });

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

    expect(screen.getByRole('link', { name: /upload data/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /upload audit/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mapping studio/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ap explorer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check builder/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rejections/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /evidence pack/i })).toBeInTheDocument();
  });

  it('preserves workflow restrictions until their prerequisites are available', () => {
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <SidebarProvider>
          <Sidebar collapsible="none">
            <SidebarNav />
          </Sidebar>
        </SidebarProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Run checks' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Exceptions' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Traceability' })).not.toHaveAttribute('aria-disabled');
  });

  it('provides a route-aware shell title for operational subpages', () => {
    expect(getWorkflowSection('/upload')?.label).toBe('Upload workspace');
    expect(getWorkflowSection('/invoice/invoice-123')?.label).toBe('Invoice detail');
  });

  it('closes the mobile drawer with a labelled control and returns focus to the trigger', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SidebarProvider>
          <SidebarTrigger />
          <Sidebar>
            <SidebarNav />
          </Sidebar>
        </SidebarProvider>
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: 'Toggle Sidebar' });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = await screen.findByRole('button', { name: 'Close navigation' });
    expect(closeButton).toBeVisible();
    fireEvent.click(closeButton);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('closes the mobile drawer when an enabled destination is selected', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/upload']}>
        <SidebarProvider>
          <SidebarTrigger />
          <Sidebar>
            <SidebarNav />
          </Sidebar>
        </SidebarProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(await screen.findByRole('button', { name: 'Close navigation' })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Traceability' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument());
  });
});
