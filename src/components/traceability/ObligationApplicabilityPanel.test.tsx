import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ObligationApplicabilityPanel } from '@/components/traceability/ObligationApplicabilityPanel';
import type { ScenarioLensInvoice } from '@/modules/scenarioLens/types';

const invoices = [
  {
    invoiceId: 'INV-1',
    invoiceNumber: 'Standard-1',
    buyerId: 'BUY-1',
    header: { invoice_id: 'INV-1', invoice_number: 'Standard-1', issue_date: '2026-01-01', seller_trn: '100000000000003', buyer_id: 'BUY-1', currency: 'AED', invoice_type: '380' },
    lines: [],
    classification: { documentType: 'Standard Invoice', vatTreatments: ['Standard-rated'], businessScenarios: ['None'], reasons: [] },
  },
  {
    invoiceId: 'CN-1',
    invoiceNumber: 'Credit-1',
    buyerId: 'BUY-1',
    header: { invoice_id: 'CN-1', invoice_number: 'Credit-1', issue_date: '2026-01-02', seller_trn: '100000000000003', buyer_id: 'BUY-1', currency: 'AED', invoice_type: '381', credit_note_reason_code: 'ADJ' },
    lines: [],
    classification: { documentType: 'Credit Note', vatTreatments: ['Standard-rated'], businessScenarios: ['None'], reasons: [] },
  },
] as ScenarioLensInvoice[];

describe('ObligationApplicabilityPanel', () => {
  it('renders a non-authoritative nine-obligation review', () => {
    render(<ObligationApplicabilityPanel invoices={invoices} buyers={[]} />);
    expect(screen.getByText('Obligation applicability review')).toBeInTheDocument();
    expect(screen.getByText('Shadow · non-authoritative')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(10); // one header row plus nine obligations
    expect(screen.getByText(/do not affect validation, readiness, or upload blocking/i)).toBeInTheDocument();
    expect(screen.getByText('Shadow/runtime comparison')).toBeInTheDocument();
    expect(screen.getByText(/Runtime evidence is aggregated by rule/i)).toBeInTheDocument();
  });

  it('recomputes decisions when the reviewer changes invoice context', () => {
    render(<ObligationApplicabilityPanel invoices={invoices} buyers={[]} />);
    expect(screen.getByText('Credit-note reason code does not apply to the classified non-credit document.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Invoice context'), { target: { value: 'CN-1' } });
    expect(screen.getByText('Credit-note reason code applies to the classified credit-note variant.')).toBeInTheDocument();
  });

  it('shows a safe empty state without invoice data', () => {
    render(<ObligationApplicabilityPanel invoices={[]} buyers={[]} />);
    expect(screen.getByText('Upload invoice data to review obligation applicability.')).toBeInTheDocument();
  });
});
