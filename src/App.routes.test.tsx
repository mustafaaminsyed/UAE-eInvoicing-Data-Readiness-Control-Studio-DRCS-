import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/context/ComplianceContext', () => ({
  ComplianceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/Navigation', () => ({
  Navigation: () => <div>Navigation Mock</div>,
}));

vi.mock('@/components/dashboard/WorkspaceShell', async () => {
  const reactRouterDom = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    WorkspaceShell: () => <reactRouterDom.Outlet />,
  };
});

vi.mock('@/pages/LandingPage', () => ({
  default: () => <div>Landing Mock</div>,
}));

vi.mock('@/pages/UploadPage', () => ({
  default: () => <div>Upload Mock</div>,
}));

vi.mock('@/pages/RunChecksPage', () => ({
  default: () => <div>Run Checks Mock</div>,
}));

vi.mock('@/pages/DashboardPage', () => ({
  default: () => <div>Dashboard Mock</div>,
}));

vi.mock('@/pages/DataTwinPage', () => ({
  default: () => <div>Data Twin Mock</div>,
}));

vi.mock('@/pages/ExceptionsWorkspacePage', () => ({
  default: () => <div>Exceptions Workspace Mock</div>,
}));

vi.mock('@/pages/InvoiceDetailPage', () => ({
  default: () => <div>Invoice Detail Mock</div>,
}));

vi.mock('@/pages/CheckBuilderPage', () => ({
  default: () => <div>Check Builder Mock</div>,
}));

vi.mock('@/pages/CheckRegistryPage', () => ({
  default: () => <div>Check Registry Mock</div>,
}));

vi.mock('@/pages/UploadAuditPage', () => ({
  default: () => <div>Upload Audit Mock</div>,
}));

vi.mock('@/pages/APInvoiceExplorerPage', () => ({
  default: () => <div>AP Explorer Mock</div>,
}));

vi.mock('@/pages/ControlsDashboardPage', () => ({
  default: () => <div>Controls Dashboard Mock</div>,
}));

vi.mock('@/pages/CasesPage', () => ({
  default: () => <div>Cases Mock</div>,
}));

vi.mock('@/pages/RejectionsPage', () => ({
  default: () => <div>Rejections Mock</div>,
}));

vi.mock('@/pages/MappingPage', () => ({
  default: () => <div>Mapping Mock</div>,
}));

vi.mock('@/pages/EvidencePage', () => ({
  default: () => <div>Evidence Mock</div>,
}));

vi.mock('@/pages/EvidencePackPage', () => ({
  default: () => <div>Evidence Pack Mock</div>,
}));

vi.mock('@/pages/TraceabilityPage', () => ({
  default: () => <div>Traceability Mock</div>,
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div>Not Found Mock</div>,
}));

import App from '@/App';

describe('App route wiring', () => {
  it('renders the data twin route inside the live app router', async () => {
    window.history.pushState({}, '', '/data-twin');

    render(<App />);

    expect(await screen.findByText('Data Twin Mock')).toBeInTheDocument();
    expect(screen.queryByText('Not Found Mock')).not.toBeInTheDocument();
  });

  it('renders the live exceptions workspace route', async () => {
    window.history.pushState({}, '', '/exceptions');

    render(<App />);

    expect(await screen.findByText('Exceptions Workspace Mock')).toBeInTheDocument();
    expect(screen.queryByText('Not Found Mock')).not.toBeInTheDocument();
  });
});
