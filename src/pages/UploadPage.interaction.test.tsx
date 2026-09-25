import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UploadPage from '@/pages/UploadPage';
import { ComplianceProvider } from '@/context/ComplianceContext';

vi.mock('@/lib/api/pintAEApi', async () => {
  const actual = await vi.importActual<any>('@/lib/api/pintAEApi');
  return {
    ...actual,
    seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'ok' })),
  };
});

describe('UploadPage interactions', () => {
  afterEach(cleanup);

  it('does not restore a pending upload after Clear All', async () => {
    let finishRead!: (text: string) => void;
    const pending = new Promise<string>(resolve => { finishRead = resolve; });
    const file = new File([''], 'pending-buyers.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: () => pending });
    const { container } = render(<MemoryRouter><ComplianceProvider><UploadPage /></ComplianceProvider></MemoryRouter>);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    await act(async () => { finishRead('buyer_id,buyer_name,buyer_trn\nB1,Buyer,100000000000001'); await pending; });
    expect(screen.queryByText('pending-buyers.csv')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Data & Continue' })).toBeDisabled();
  });

  it('does not enable loading when file analysis rejects malformed CSV', async () => {
    const file = new File([''], 'invalid.csv', { type: 'text/csv' });
    const read = vi.fn(async () => 'buyer_id,buyer_name\nB1,Buyer,unexpected');
    Object.defineProperty(file, 'text', { value: read });
    const { container } = render(<MemoryRouter><ComplianceProvider><UploadPage /></ComplianceProvider></MemoryRouter>);
    for (const input of container.querySelectorAll('input[type="file"]')) {
      fireEvent.change(input, { target: { files: [file] } });
    }
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('button', { name: 'Load Data & Continue' })).toBeDisabled();
  });
  it('does not open file picker when switching AR/AP and sample scenario toggles', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(
      <MemoryRouter>
        <ComplianceProvider>
          <UploadPage />
        </ComplianceProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Customer Invoices (AR / Outbound)' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Vendor Invoices (AP / Inbound)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Positive Samples' }));
    fireEvent.click(screen.getByRole('button', { name: 'Negative Test Samples' }));

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
