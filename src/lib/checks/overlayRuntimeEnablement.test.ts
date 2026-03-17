import { describe, expect, it } from 'vitest';

import { OVERLAY_RUNTIME_CHECKS } from '@/lib/checks/overlayRuntimeChecks';
import { runPintAECheck, runPintAECheckWithTelemetry } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import type { Buyer, DataContext, InvoiceHeader } from '@/types/compliance';
import type { PintAEException } from '@/types/pintAE';

function buildDataContext(overrides: Partial<InvoiceHeader>): DataContext {
  const buyers: Buyer[] = [
    {
      buyer_id: 'B-1',
      buyer_name: 'Buyer LLC',
      buyer_trn: '123456789012345',
    },
  ];

  const header: InvoiceHeader = {
    invoice_id: 'INV-1',
    invoice_number: 'A-1001',
    issue_date: '2026-02-01',
    seller_trn: '123456789012345',
    buyer_id: 'B-1',
    currency: 'AED',
    ...overrides,
  };

  return {
    buyers,
    headers: [header],
    lines: [],
    buyerMap: new Map(buyers.map((buyer) => [buyer.buyer_id, buyer])),
    headerMap: new Map([[header.invoice_id, header]]),
    linesByInvoice: new Map(),
  };
}

function getOverlayCheck(checkId: string) {
  const check = OVERLAY_RUNTIME_CHECKS.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing overlay check fixture: ${checkId}`);
  return check;
}

function getMainPackCheck(checkId: string) {
  const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing main-pack check fixture: ${checkId}`);
  return check;
}

function normalizeExceptions(exceptions: PintAEException[]) {
  return exceptions.map((exception) => ({
    check_id: exception.check_id,
    invoice_id: exception.invoice_id ?? null,
    buyer_id: exception.buyer_id ?? null,
    line_id: exception.line_id ?? null,
    field_name: exception.field_name ?? null,
    observed_value: exception.observed_value ?? null,
    expected_value_or_rule: exception.expected_value_or_rule ?? null,
    message: exception.message,
    severity: exception.severity,
    scope: exception.scope,
  }));
}

describe('overlay runtime env enablement', () => {
  it('makes the default overlay path follow the configured applicability mode', () => {
    const mode = String(import.meta.env.VITE_OVERLAY_APPLICABILITY_MODE ?? 'legacy').trim().toLowerCase();
    const check = getOverlayCheck('IBR-138-AE');
    const data = buildDataContext({
      transaction_type_code: '00010000',
      invoicing_period_start_date: '',
      invoicing_period_end_date: '',
    });

    const exceptions = runPintAECheck(check, data);

    if (mode === 'scenario_context') {
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0].check_id).toBe('IBR-138-AE');
    } else {
      expect(exceptions).toHaveLength(0);
    }
  });

  it('keeps non-overlay rules unchanged regardless of the configured overlay mode', () => {
    const check = getMainPackCheck('UAE-UC1-CHK-041');
    const data = buildDataContext({ tax_category_code: 'INVALID' });

    const defaultExceptions = runPintAECheck(check, data);
    const legacyExceptions = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'legacy',
    }).exceptions;
    const scenarioExceptions = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'scenario_context',
    }).exceptions;

    expect(normalizeExceptions(defaultExceptions)).toEqual(normalizeExceptions(legacyExceptions));
    expect(normalizeExceptions(scenarioExceptions)).toEqual(normalizeExceptions(legacyExceptions));
  });
});
