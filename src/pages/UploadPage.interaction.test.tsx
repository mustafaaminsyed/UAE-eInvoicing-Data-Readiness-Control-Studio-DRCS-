import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
