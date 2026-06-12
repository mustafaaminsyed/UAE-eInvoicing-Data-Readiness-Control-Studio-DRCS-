import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import UploadPage from '@/pages/UploadPage';
import { ComplianceProvider } from '@/context/ComplianceContext';

const navigate = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

let buyersDeferred = deferred<Array<Record<string, unknown>>>();
let headersDeferred = deferred<Array<Record<string, unknown>>>();
let linesDeferred = deferred<Array<Record<string, unknown>>>();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/uploadAudit', () => ({
  addUploadAuditLog: vi.fn(),
}));

vi.mock('@/components/upload/FileAnalysis', () => ({
  FileDropZone: ({
    label,
    onFileSelect,
  }: {
    label: string;
    onFileSelect: (file: File | null) => void;
  }) => (
    <label>
      {label}
      <input
        aria-label={`${label} CSV upload`}
        type="file"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
      />
    </label>
  ),
  FileSummaryCard: ({ stats }: { stats: { fileName: string } }) => <div>{stats.fileName}</div>,
  analyzeFile: (_rows: unknown[], file: File) => ({
    fileName: file.name,
    fileSize: file.size,
    rowCount: 10,
    columnCount: 4,
    requiredMissing: [],
    nullWarnings: [],
  }),
}));

vi.mock('@/lib/csvParser', () => ({
  parseCSV: vi.fn(() => [{ sample: 'row' }]),
  parseBuyersFile: vi.fn(() => buyersDeferred.promise),
  parseHeadersFile: vi.fn(() => headersDeferred.promise),
  parseLinesFile: vi.fn(() => linesDeferred.promise),
}));

function createCsvFile(name: string, content: string) {
  const file = new File([content], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', {
    value: vi.fn().mockResolvedValue(content),
  });
  return file;
}

describe('UploadPage processing feedback', () => {
  beforeEach(() => {
    navigate.mockReset();
    buyersDeferred = deferred<Array<Record<string, unknown>>>();
    headersDeferred = deferred<Array<Record<string, unknown>>>();
    linesDeferred = deferred<Array<Record<string, unknown>>>();
  });

  it('shows elapsed processing feedback while large datasets are loading', async () => {
    render(
      <MemoryRouter>
        <ComplianceProvider>
          <UploadPage />
        </ComplianceProvider>
      </MemoryRouter>
    );

    const buyersFile = createCsvFile('buyers.csv', 'buyer_id,buyer_name\nB1,Buyer One');
    const headersFile = createCsvFile('headers.csv', 'invoice_id,invoice_number\nINV1,INV1');
    const linesFile = createCsvFile('lines.csv', 'line_id,invoice_id\nL1,INV1');

    fireEvent.change(screen.getByLabelText('Buyers File CSV upload'), { target: { files: [buyersFile] } });
    fireEvent.change(screen.getByLabelText('Invoice Headers File CSV upload'), { target: { files: [headersFile] } });
    fireEvent.change(screen.getByLabelText('Invoice Lines File CSV upload'), { target: { files: [linesFile] } });

    const loadButton = await screen.findByRole('button', { name: 'Load Data & Continue' });
    fireEvent.click(loadButton);

    expect(screen.getByText('Processing uploaded datasets')).toBeInTheDocument();
    expect(screen.getByText(/Current payload:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Processing data\.\.\. 0s/i })).toBeDisabled();

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await waitFor(() => {
      expect(screen.getByText('1s elapsed')).toBeInTheDocument();
    }, { timeout: 3000 });

    buyersDeferred.resolve([{ buyer_id: 'B1', buyer_name: 'Buyer One' }]);
    headersDeferred.resolve([
      {
        invoice_id: 'INV1',
        invoice_number: 'INV1',
        issue_date: '2026-06-12',
        seller_trn: '100000000000003',
        currency: 'AED',
      },
    ]);
    linesDeferred.resolve([{ line_id: 'L1', invoice_id: 'INV1', line_number: 1 }]);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/run');
    }, { timeout: 3000 });
  });
});
