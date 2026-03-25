import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDirectionMock = vi.fn();

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
  MappingStep: ({ focusedField }: { focusedField?: string | null }) => (
    <div>
      <div>Mapping Step Mock</div>
      {focusedField ? <div>Focused field: {focusedField}</div> : null}
    </div>
  ),
}));

import MappingPage from '@/pages/MappingPage';

vi.mock('@/lib/api/mappingApi', () => ({
  fetchMappingTemplates: vi.fn(async () => []),
  deleteMappingTemplate: vi.fn(async () => true),
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
});
