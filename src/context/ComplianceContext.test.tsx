import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComplianceProvider, useCompliance } from '@/context/ComplianceContext';
import { ParsedData } from '@/types/compliance';

vi.mock('@/lib/api/pintAEApi', async () => {
  const actual = await vi.importActual<any>('@/lib/api/pintAEApi');
  return {
    ...actual,
    seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'ok' })),
  };
});

const arData: ParsedData = {
  buyers: [{ buyer_id: 'AR-B1', buyer_name: 'AR Buyer' }],
  headers: [
    {
      invoice_id: 'AR-I1',
      invoice_number: 'AR-1001',
      issue_date: '2026-02-01',
      seller_trn: '100000000000001',
      buyer_id: 'AR-B1',
      currency: 'AED',
    },
  ],
  lines: [
    {
      line_id: 'AR-L1',
      invoice_id: 'AR-I1',
      line_number: 1,
      quantity: 1,
      unit_price: 100,
      line_total_excl_vat: 100,
      vat_rate: 5,
      vat_amount: 5,
    },
  ],
};

const apData: ParsedData = {
  buyers: [{ buyer_id: 'AP-B1', buyer_name: 'AP Buyer' }],
  headers: [
    {
      invoice_id: 'AP-I1',
      invoice_number: 'AP-2001',
      issue_date: '2026-02-02',
      seller_trn: '200000000000001',
      buyer_id: 'AP-B1',
      currency: 'AED',
    },
  ],
  lines: [
    {
      line_id: 'AP-L1',
      invoice_id: 'AP-I1',
      line_number: 1,
      quantity: 1,
      unit_price: 100,
      line_total_excl_vat: 100,
      vat_rate: 5,
      vat_amount: 5,
    },
  ],
};

function Harness() {
  const context = useCompliance();
  return (
    <div>
      <span data-testid="active">{context.activeDatasetType}</span>
      <span data-testid="ar-count">{context.getDataForDataset('AR').headers.length}</span>
      <span data-testid="ap-count">{context.getDataForDataset('AP').headers.length}</span>
      <span data-testid="visible-count">{context.headers.length}</span>
      <button type="button" onClick={() => context.setData(arData, 'AR')}>
        set-ar
      </button>
      <button type="button" onClick={() => context.setData(apData, 'AP')}>
        set-ap
      </button>
      <button type="button" onClick={() => context.setActiveDatasetType('AR')}>
        switch-ar
      </button>
      <button type="button" onClick={() => context.setActiveDatasetType('AP')}>
        switch-ap
      </button>
    </div>
  );
}

describe('ComplianceContext dataset type behavior', () => {
  it('persists AR and AP datasets independently', () => {
    render(
      <ComplianceProvider>
        <Harness />
      </ComplianceProvider>
    );

    fireEvent.click(screen.getByText('set-ar'));
    expect(screen.getByTestId('ar-count').textContent).toBe('1');
    expect(screen.getByTestId('ap-count').textContent).toBe('0');

    fireEvent.click(screen.getByText('set-ap'));
    expect(screen.getByTestId('active').textContent).toBe('AP');
    expect(screen.getByTestId('ar-count').textContent).toBe('1');
    expect(screen.getByTestId('ap-count').textContent).toBe('1');

    fireEvent.click(screen.getByText('switch-ar'));
    expect(screen.getByTestId('visible-count').textContent).toBe('1');
  });

  it('keeps AR flow intact as default smoke test', () => {
    render(
      <ComplianceProvider>
        <Harness />
      </ComplianceProvider>
    );

    fireEvent.click(screen.getByText('set-ar'));
    expect(screen.getByTestId('active').textContent).toBe('AR');
    expect(screen.getByTestId('visible-count').textContent).toBe('1');
  });
});
