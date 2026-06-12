import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDirectionMock = vi.fn();
const mappingApiMocks = vi.hoisted(() => ({
  fetchMappingTemplates: vi.fn(async () => []),
  deleteMappingTemplate: vi.fn(async () => true),
}));

vi.mock('@/components/mapping/UploadStep', () => ({
  UploadStep: ({ onDataLoaded }: { onDataLoaded: (data: unknown) => void }) => (
    <div>
      <div>Upload ERP Extract</div>
      <button
        type="button"
        onClick={() =>
          onDataLoaded({
            fileName: 'buyers.csv',
            columns: ['buyer_id', 'buyer_name', 'buyer_city'],
            detectedColumns: [],
            rows: [{ buyer_id: 'B001', buyer_name: 'Acme', buyer_city: 'Dubai' }],
            totalRows: 1,
            datasetType: 'parties',
          })
        }
      >
        Load Preview
      </button>
    </div>
  ),
}));

vi.mock('@/components/mapping/MappingStep', () => ({
  MappingStep: ({ focusedField, previewData }: { focusedField?: string | null; previewData?: { fileName?: string } }) => (
    <div>
      <div>Mapping Step Mock</div>
      {previewData?.fileName ? <div>Preview file: {previewData.fileName}</div> : null}
      {focusedField ? <div>Focused field: {focusedField}</div> : null}
    </div>
  ),
}));

vi.mock('@/components/mapping/SaveStep', () => ({
  SaveStep: ({ initialTemplate, saveMode }: { initialTemplate?: { templateName?: string } | null; saveMode?: string }) => (
    <div>
      <div>Save Step Mock</div>
      <div>Save mode: {saveMode}</div>
      <div>Seed name: {initialTemplate?.templateName || '(empty)'}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

import MappingPage from '@/pages/MappingPage';

vi.mock('@/lib/api/mappingApi', () => ({
  fetchMappingTemplates: mappingApiMocks.fetchMappingTemplates,
  deleteMappingTemplate: mappingApiMocks.deleteMappingTemplate,
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    direction: 'AR',
    setDirection: setDirectionMock,
    setActiveMappingProfileForDirection: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('MappingPage navigation', () => {
  beforeEach(() => {
    setDirectionMock.mockClear();
    mappingApiMocks.fetchMappingTemplates.mockReset();
    mappingApiMocks.fetchMappingTemplates.mockResolvedValue([]);
    mappingApiMocks.deleteMappingTemplate.mockReset();
    mappingApiMocks.deleteMappingTemplate.mockResolvedValue(true);
  });

  it('returns to the templates tab when Back is clicked on the first wizard step', async () => {
    render(
      <MemoryRouter initialEntries={['/mapping?tab=create']}>
        <MappingPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Upload ERP Extract')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to templates/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /templates/i })).toHaveAttribute('aria-selected', 'true');
    });

    expect(screen.queryByText('Upload ERP Extract')).not.toBeInTheDocument();
  });

  it('renders the mapping step only once in the mapping layout', async () => {
    render(
      <MemoryRouter initialEntries={['/mapping?tab=create']}>
        <MappingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load Preview' }));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Mapping Step Mock')).toHaveLength(1);
    });
  });

  it('consumes dataset and field context from a digital twin deep link', async () => {
    render(
      <MemoryRouter initialEntries={['/mapping?tab=create&dataset=AP&field=seller_trn']}>
        <MappingPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Digital Twin context')).toBeInTheDocument();
    expect(screen.getByText(/opened for inbound \(ap\) mapping/i)).toBeInTheDocument();
    expect(screen.getByText(/field focus: seller_trn/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(setDirectionMock).toHaveBeenCalledWith('AP');
    });
  });

  it('passes the focused field through to the mapping step', async () => {
    render(
      <MemoryRouter initialEntries={['/mapping?tab=create&field=seller_trn']}>
        <MappingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load Preview' }));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Focused field: seller_trn')).toBeInTheDocument();
    });
  });

  it('reconstructs preview state when opening a saved template from the list', async () => {
    mappingApiMocks.fetchMappingTemplates.mockResolvedValue([
      {
        id: 'tpl-001',
        templateName: 'Header Template',
        version: 2,
        isActive: true,
        documentType: 'UC1 Standard Tax Invoice',
        mappings: [
          {
            id: 'mapping-invoice-number',
            erpColumn: 'invoice_number',
            erpColumnIndex: 0,
            targetField: {
              id: 'invoice_number',
              name: 'Invoice Number',
              description: 'Invoice Number',
              ibtReference: 'IBT-001',
              category: 'header',
              isMandatory: true,
              dataType: 'string',
            },
            confidence: 1,
            isConfirmed: true,
            transformations: [],
            sampleValues: ['UAE-2025-0001'],
          },
        ],
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/mapping?tab=templates']}>
        <MappingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Header Template')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Mapping Step Mock')).toBeInTheDocument();
      expect(screen.getByText('Preview file: header_template.csv')).toBeInTheDocument();
    });
  });

  it('prefills template metadata when duplicating a saved template', async () => {
    mappingApiMocks.fetchMappingTemplates.mockResolvedValue([
      {
        id: 'tpl-002',
        templateName: 'Buyer Template',
        version: 1,
        isActive: true,
        documentType: 'UC1 Standard Tax Invoice',
        mappings: [
          {
            id: 'mapping-buyer-id',
            erpColumn: 'buyer_id',
            erpColumnIndex: 0,
            targetField: {
              id: 'buyer_id',
              name: 'Buyer ID',
              description: 'Buyer ID',
              ibtReference: 'SYS-BUYER-ID',
              category: 'header',
              isMandatory: true,
              dataType: 'string',
            },
            confidence: 1,
            isConfirmed: true,
            transformations: [],
            sampleValues: ['B001'],
          },
        ],
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/mapping?tab=templates']}>
        <MappingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Buyer Template')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));

    await waitFor(() => {
      expect(screen.getByText('Save Step Mock')).toBeInTheDocument();
      expect(screen.getByText('Save mode: duplicate')).toBeInTheDocument();
      expect(screen.getByText('Seed name: Buyer Template Copy')).toBeInTheDocument();
    });
  });
});
