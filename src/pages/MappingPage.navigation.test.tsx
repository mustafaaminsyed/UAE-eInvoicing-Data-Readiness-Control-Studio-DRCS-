import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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
  MappingStep: () => <div>Mapping Step Mock</div>,
}));

import MappingPage from '@/pages/MappingPage';

vi.mock('@/lib/api/mappingApi', () => ({
  fetchMappingTemplates: vi.fn(async () => []),
  deleteMappingTemplate: vi.fn(async () => true),
}));

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    direction: 'AR',
    setDirection: vi.fn(),
    setActiveMappingProfileForDirection: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('MappingPage navigation', () => {
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
});
