import { describe, expect, it } from 'vitest';
import { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { OVERLAY_RUNTIME_CHECKS } from '@/lib/checks/overlayRuntimeChecks';
import { runAllPintAEChecksWithTelemetry, runPintAECheck, runPintAECheckWithTelemetry } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getCodelistCodes } from '@/lib/pintAE/specCatalog';
import type { PintAEException } from '@/types/pintAE';

function buildDataContext(
  overrides: Partial<InvoiceHeader>,
  options?: {
    buyers?: Buyer[];
    lines?: InvoiceLine[];
  }
): DataContext {
  const buyers = options?.buyers ?? [
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

  const headers = [header];
  const lines = options?.lines ?? [];
  const linesByInvoice = new Map<string, InvoiceLine[]>();
  lines.forEach((line) => {
    const existing = linesByInvoice.get(line.invoice_id) ?? [];
    existing.push(line);
    linesByInvoice.set(line.invoice_id, existing);
  });

  return {
    buyers,
    headers,
    lines,
    buyerMap: new Map(buyers.map((buyer) => [buyer.buyer_id, buyer])),
    headerMap: new Map(headers.map((item) => [item.invoice_id, item])),
    linesByInvoice,
  };
}

function getCheck(checkId: string) {
  const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing check fixture: ${checkId}`);
  return check;
}

function getOverlayCheck(checkId: string) {
  const check = OVERLAY_RUNTIME_CHECKS.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing overlay check fixture: ${checkId}`);
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

describe('runPintAECheck executor registry parity', () => {
  it('keeps the AR UC1 catalogue operational', () => {
    const result = runAllPintAEChecksWithTelemetry(UAE_UC1_CHECK_PACK, buildDataContext({}), { direction: 'AR' });
    expect(result.executionEvidence).toHaveLength(UAE_UC1_CHECK_PACK.length);
    expect(result.executionEvidence.some((item) => item.evaluatedCount > 0)).toBe(true);
    expect(result.telemetry.every((item) => item.direction === 'AR')).toBe(true);
  });

  it('registers but does not execute the AR-scoped UC1 catalogue for AP', () => {
    const result = runAllPintAEChecksWithTelemetry(UAE_UC1_CHECK_PACK, buildDataContext({}), { direction: 'AP' });
    expect(result.exceptions).toHaveLength(0);
    expect(result.executionEvidence).toHaveLength(UAE_UC1_CHECK_PACK.length);
    expect(result.executionEvidence.every((item) =>
      item.direction === 'AP' && item.outcome === 'not_applicable' && item.evaluatedCount === 0
    )).toBe(true);
  });

  it.each([
    ['single line', [100], 100, 0],
    ['multiple lines', [100, 200, 50], 350, 0],
  ])('CHK-021 passes for %s when supplied IBT-106 equals the line sum', (_label, lineTotals, ibt106, expectedFailures) => {
    const check = getCheck('UAE-UC1-CHK-021');
    const data = buildDataContext({ sum_line_net_amount: ibt106 }, {
      lines: lineTotals.map((lineTotal, index) => ({
        line_id: `L-${index + 1}`, invoice_id: 'INV-1', line_number: index + 1,
        quantity: 1, unit_price: lineTotal, line_total_excl_vat: lineTotal,
        vat_rate: 5, vat_amount: lineTotal * 0.05,
      })),
    });

    expect(runPintAECheck(check, data)).toHaveLength(expectedFailures);
  });

  it('CHK-021 fails when IBT-106 does not equal supplied IBT-131 sum', () => {
    const check = getCheck('UAE-UC1-CHK-021');
    const data = buildDataContext({ sum_line_net_amount: 340 }, {
      lines: [100, 200, 50].map((lineTotal, index) => ({
        line_id: `L-${index + 1}`, invoice_id: 'INV-1', line_number: index + 1,
        quantity: 1, unit_price: lineTotal, line_total_excl_vat: lineTotal,
        vat_rate: 5, vat_amount: lineTotal * 0.05,
      })),
    });

    const [exception] = runPintAECheck(check, data);
    expect(exception?.field_name).toBe('sum_line_net_amount');
    expect(exception?.message).toContain('IBT-106');
  });

  it('CHK-021 keeps IBT-106 independent from IBT-109 and does not recalculate IBT-131', () => {
    const check = getCheck('UAE-UC1-CHK-021');
    const data = buildDataContext({ sum_line_net_amount: 350, total_excl_vat: 330 }, {
      lines: [100, 200, 50].map((lineTotal, index) => ({
        line_id: `L-${index + 1}`, invoice_id: 'INV-1', line_number: index + 1,
        quantity: 999, unit_price: 999, line_total_excl_vat: lineTotal,
        vat_rate: 5, vat_amount: lineTotal * 0.05,
      })),
    });

    expect(runPintAECheck(check, data)).toHaveLength(0);
  });

  it('CHK-021 derives IBT-106 when the legacy header aggregate is absent', () => {
    const check = getCheck('UAE-UC1-CHK-021');
    const data = buildDataContext({ total_excl_vat: 350 }, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
        quantity: 1, unit_price: 350, line_total_excl_vat: 350,
        vat_rate: 5, vat_amount: 17.5,
      }],
    });

    expect(runPintAECheck(check, data)).toHaveLength(0);
  });

  it.each([
    ['IBR-137-AE', { transaction_type_code: '00000100', principal_id: 'P-1' }],
    ['IBR-138-AE', { transaction_type_code: '00010000', invoicing_period_start_date: '2026-01-01' }],
    ['IBR-152-AE', {
      transaction_type_code: '00000001',
      deliver_to_address_line_1: '1 Main St',
      deliver_to_city: 'Dubai',
      deliver_to_country_subdivision: 'DU',
      deliver_to_country_code: 'US',
    }],
  ])('records passed provenance for %s', (checkId, header) => {
    const result = runPintAECheckWithTelemetry(getOverlayCheck(checkId), buildDataContext(header), {
      overlayApplicabilityMode: 'scenario_context',
    });
    expect(result.exceptions).toEqual([]);
    expect(result.executionResults).toEqual([
      expect.objectContaining({ ruleId: checkId, invoiceId: 'INV-1', status: 'passed' }),
    ]);
  });

  it.each([
    ['IBR-137-AE', { transaction_type_code: '00000100' }],
    ['IBR-138-AE', { transaction_type_code: '00010000' }],
    ['IBR-152-AE', { transaction_type_code: '00000001' }],
  ])('records failed provenance for %s without changing exceptions', (checkId, header) => {
    const result = runPintAECheckWithTelemetry(getOverlayCheck(checkId), buildDataContext(header), {
      overlayApplicabilityMode: 'scenario_context',
    });
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].check_id).toBe(checkId);
    expect(result.telemetry).toMatchObject({ execution_count: 1, failure_count: 1 });
    expect(result.executionResults).toEqual([
      expect.objectContaining({ ruleId: checkId, invoiceId: 'INV-1', status: 'failed' }),
    ]);
  });

  it.each(['IBR-137-AE', 'IBR-138-AE', 'IBR-152-AE'])('records not_applicable provenance for inactive %s', (checkId) => {
    const result = runPintAECheckWithTelemetry(getOverlayCheck(checkId), buildDataContext({ transaction_type_code: '00000000' }), {
      overlayApplicabilityMode: 'scenario_context',
    });
    expect(result.exceptions).toEqual([]);
    expect(result.telemetry).toMatchObject({ execution_count: 0, failure_count: 0 });
    expect(result.executionResults).toEqual([
      expect.objectContaining({ ruleId: checkId, invoiceId: 'INV-1', status: 'not_applicable' }),
    ]);
  });

  it('keeps CHK-032/033 references aligned to quantity/UOM semantics only', () => {
    expect(getCheck('UAE-UC1-CHK-032').pint_reference_terms).toEqual(['IBT-129']);
    expect(getCheck('UAE-UC1-CHK-033').pint_reference_terms).toEqual(['IBT-130']);
  });

  it('handles presence check UAE-UC1-CHK-001', () => {
    const check = getCheck('UAE-UC1-CHK-001');
    const data = buildDataContext({ invoice_number: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-001');
    expect(exceptions[0].invoice_id).toBe('INV-1');
    expect(exceptions[0].field_name).toBe('invoice_number');
    expect(exceptions[0].message).toContain('Missing required field');
  });

  it('handles pattern check UAE-UC1-CHK-003', () => {
    const check = getCheck('UAE-UC1-CHK-003');
    const data = buildDataContext({ issue_date: '2026/02/01' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-003');
    expect(exceptions[0].invoice_id).toBe('INV-1');
    expect(exceptions[0].field_name).toBe('issue_date');
    expect(exceptions[0].message).toContain('format invalid');
  });

  it('handles codelist check UAE-UC1-CHK-006', () => {
    const check = getCheck('UAE-UC1-CHK-006');
    const data = buildDataContext({ currency: 'ZZZ' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-006');
    expect(exceptions[0].invoice_id).toBe('INV-1');
    expect(exceptions[0].field_name).toBe('currency');
    expect(exceptions[0].message).toContain('ISO4217 codelist');
  });

  it('uses system default for CHK-010 when specification identifier is missing', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const data = buildDataContext({ spec_id: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });

  it('fails CHK-010 when missing and system default is disabled', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const strictCheck = {
      ...check,
      parameters: {
        ...check.parameters,
        allow_system_default: false,
      },
    };
    const data = buildDataContext({ spec_id: '' });

    const exceptions = runPintAECheck(strictCheck, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-010');
    expect(exceptions[0].field_name).toBe('spec_id');
    expect(exceptions[0].message).toContain('Missing specification identifier');
  });

  it('fails CHK-010 when specification identifier has invalid prefix', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const data = buildDataContext({ spec_id: 'urn:peppol:pint:billing-1@uae-1' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-010');
    expect(exceptions[0].message).toContain('Invalid specification identifier');
  });

  it('passes CHK-010 when specification identifier starts with allowed prefix', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const data = buildDataContext({ spec_id: 'urn:peppol:pint:billing-1@ae-1#2.0' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });

  it('uses system default for CHK-011 when business process is missing', () => {
    const check = getCheck('UAE-UC1-CHK-011');
    const data = buildDataContext({ business_process: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });

  it('fails CHK-011 when missing and system default is disabled', () => {
    const check = getCheck('UAE-UC1-CHK-011');
    const strictCheck = {
      ...check,
      parameters: {
        ...check.parameters,
        allow_system_default: false,
      },
    };
    const data = buildDataContext({ business_process: '' });

    const exceptions = runPintAECheck(strictCheck, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-011');
    expect(exceptions[0].field_name).toBe('business_process');
    expect(exceptions[0].message).toContain('Missing business process type');
  });

  it('passes CHK-011 for both allowed business process values', () => {
    const check = getCheck('UAE-UC1-CHK-011');
    const billing = buildDataContext({ business_process: 'urn:peppol:bis:billing' });
    const selfBilling = buildDataContext({ business_process: 'urn:peppol:bis:selfbilling' });

    expect(runPintAECheck(check, billing)).toHaveLength(0);
    expect(runPintAECheck(check, selfBilling)).toHaveLength(0);
  });

  it('validates CHK-059 transaction type code presence', () => {
    const check = getCheck('UAE-UC1-CHK-059');

    expect(runPintAECheck(check, buildDataContext({ transaction_type_code: '00010101' }))).toHaveLength(0);

    const missingCode = runPintAECheck(check, buildDataContext({ transaction_type_code: '' }));
    expect(missingCode).toHaveLength(1);
    expect(missingCode[0].field_name).toBe('transaction_type_code');
  });

  it('validates CHK-060 transaction type code decoder-backed format rules', () => {
    const check = getCheck('UAE-UC1-CHK-060');

    expect(runPintAECheck(check, buildDataContext({ transaction_type_code: '00010101' }))).toHaveLength(0);
    expect(runPintAECheck(check, buildDataContext({ transaction_type_code: '00000100' }))).toHaveLength(0);
    expect(runPintAECheck(check, buildDataContext({ transaction_type_code: '' }))).toHaveLength(0);

    const invalidText = runPintAECheck(check, buildDataContext({ transaction_type_code: 'EXPORT' }));
    expect(invalidText).toHaveLength(1);
    expect(invalidText[0].field_name).toBe('transaction_type_code');
    expect(invalidText[0].message).toContain('8-character');

    const invalidMask = runPintAECheck(check, buildDataContext({ transaction_type_code: 'XXXXXXX1' }));
    expect(invalidMask).toHaveLength(1);
    expect(invalidMask[0].field_name).toBe('transaction_type_code');
  });

  it('fails CHK-035 when non-AED invoice has missing FX rate', () => {
    const check = getCheck('UAE-UC1-CHK-035');
    const data = buildDataContext(
      {
        currency: 'USD',
        fx_rate: undefined,
      },
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
          },
        ],
      }
    );

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-035');
    expect(exceptions[0].field_name).toBe('fx_rate');
  });

  it('CHK-007 defaults missing tax currency to the controlled AED value', () => {
    expect(runPintAECheck(getCheck('UAE-UC1-CHK-007'), buildDataContext({ currency: 'USD', tax_currency: undefined })))
      .toHaveLength(0);
  });

  it('CHK-007 rejects only an explicit non-AED tax-currency override', () => {
    const [exception] = runPintAECheck(
      getCheck('UAE-UC1-CHK-007'),
      buildDataContext({ currency: 'USD', tax_currency: 'USD' })
    );

    expect(exception?.field_name).toBe('tax_currency');
    expect(exception?.expected_value_or_rule).toBe('AED');
  });

  it('CHK-035 preserves rounded BTAE-10 and BTAE-08 evidence for non-AED lines', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'USD', fx_rate: 3.6725 }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 10.005, line_total_excl_vat: 10.005,
          vat_rate: 5, vat_amount: 0.50025, tax_category_code: 'S',
        }],
      })
    );

    expect(result.exceptions).toHaveLength(0);
    expect(result.derivedAedLineValues).toEqual([{
      invoiceId: 'INV-1',
      lineId: 'L-1',
      sourceCurrency: 'USD',
      conversionRateToAed: 3.6725,
      btae10InvoiceLineAmountAed: 38.58,
      btae08VatLineAmountAed: 1.84,
      roundingScale: 2,
    }]);
  });

  it('CHK-035 does not require a duplicate AED source field for AED invoices', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'AED', fx_rate: undefined }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 100, line_total_excl_vat: 100,
          vat_rate: 5, vat_amount: 5, tax_category_code: 'S',
        }],
      })
    );

    expect(result.exceptions).toHaveLength(0);
    expect(result.derivedAedLineValues[0]).toMatchObject({
      conversionRateToAed: 1,
      btae10InvoiceLineAmountAed: 105,
      btae08VatLineAmountAed: 5,
    });
  });

  it('CHK-035 applies deterministic two-decimal monetary rounding at half-cent boundaries', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'AED' }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 1, line_total_excl_vat: 1,
          vat_rate: 0.5, vat_amount: 0.005, tax_category_code: 'S',
        }],
      })
    );

    expect(result.derivedAedLineValues[0]).toMatchObject({
      btae10InvoiceLineAmountAed: 1.01,
      btae08VatLineAmountAed: 0.01,
      roundingScale: 2,
    });
  });

  it('CHK-035 omits BTAE-08 only for an exempt line and derives BTAE-10 from IBT-131', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'AED' }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 100, line_total_excl_vat: 100,
          vat_rate: Number.NaN, vat_amount: Number.NaN, tax_category_code: 'E',
        }],
      })
    );

    expect(result.exceptions).toHaveLength(0);
    expect(result.derivedAedLineValues[0]).toMatchObject({
      btae10InvoiceLineAmountAed: 100,
      btae08VatLineAmountAed: undefined,
    });
  });

  it.each([
    ['AE', 'IBR-162-AE'],
    ['Z', 'IBR-165-AE'],
  ])('CHK-035 derives zero BTAE-08 for %s and rejects a non-zero VAT source value', (category, ruleId) => {
    const zeroResult = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'USD', fx_rate: 3.6725 }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 100, line_total_excl_vat: 100,
          vat_rate: 0, vat_amount: 0, tax_category_code: category,
        }],
      })
    );

    expect(zeroResult.exceptions).toHaveLength(0);
    expect(zeroResult.derivedAedLineValues[0]).toMatchObject({
      btae10InvoiceLineAmountAed: 367.25,
      btae08VatLineAmountAed: 0,
    });

    const [exception] = runPintAECheck(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'AED' }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 100, line_total_excl_vat: 100,
          vat_rate: 5, vat_amount: 5, tax_category_code: category,
        }],
      })
    );

    expect(exception?.field_name).toBe('vat_amount');
    expect(exception?.expected_value_or_rule).toContain(ruleId);
  });

  it('CHK-035 treats BTAE-08 as applicable for not-subject-to-VAT lines under the current PDK', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'AED' }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 100, line_total_excl_vat: 100,
          vat_rate: Number.NaN, vat_amount: 0, tax_category_code: 'O',
        }],
      })
    );

    expect(result.exceptions).toHaveLength(0);
    expect(result.derivedAedLineValues[0]).toMatchObject({
      btae10InvoiceLineAmountAed: 100,
      btae08VatLineAmountAed: 0,
    });
  });

  it('CHK-035 preserves six-decimal BTAE-04 precision until final monetary rounding', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'USD', fx_rate: 3.672501 }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 10, line_total_excl_vat: 10,
          vat_rate: 5, vat_amount: 0.5, tax_category_code: 'S',
        }],
      })
    );

    expect(result.exceptions).toHaveLength(0);
    expect(result.derivedAedLineValues[0]).toMatchObject({
      conversionRateToAed: 3.672501,
      btae10InvoiceLineAmountAed: 38.56,
      btae08VatLineAmountAed: 1.84,
    });
  });

  it('CHK-035 reports the missing VAT prerequisite rather than an AED-column gap', () => {
    const [exception] = runPintAECheck(
      getCheck('UAE-UC1-CHK-035'),
      buildDataContext({ currency: 'AED' }, {
        lines: [{
          line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
          quantity: 1, unit_price: 100, line_total_excl_vat: 100,
          vat_rate: 5, vat_amount: Number.NaN, tax_category_code: 'S',
        }],
      })
    );

    expect(exception?.field_name).toBe('vat_amount');
    expect(exception?.message).toContain('BTAE-08');
  });

  it('fails CHK-036 under IBR-136-AE when buyer legal identifier is absent, even if a Buyer TRN is present', () => {
    const check = getCheck('UAE-UC1-CHK-036');
    const data = buildDataContext(
      {
        invoice_type: '480',
      },
      {
        buyers: [
          {
            buyer_id: 'B-1',
            buyer_name: 'Buyer LLC',
            buyer_trn: '123456789012345',
          },
        ],
      }
    );

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-036');
    expect(exceptions[0].message).toContain('Buyer legal registration identifier is missing');
  });

  it('fails CHK-037 when the supplied legal identifier type is not a PINT AE 1.0.4 value', () => {
    const check = getCheck('UAE-UC1-CHK-037');
    const data = buildDataContext(
      {
        invoice_id: 'INV-037',
        invoice_number: 'INV-037',
        issue_date: '2026-03-29',
        seller_trn: '123456789012345',
        buyer_id: 'B-1',
        currency: 'AED',
        invoice_type: '380',
      },
      {
        buyers: (() => {
          const buyer = {
            buyer_id: 'B-1',
            buyer_name: 'Buyer LLC',
            buyer_trn: '123456789012345',
            buyer_legal_reg_id: 'LEGAL-001',
            buyer_legal_reg_id_type: 'XYZ',
          };
          return [buyer];
        })(),
      }
    );

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-037');
    expect(exceptions[0].message).toContain('not allowed');
  });

  it.each(['TL', 'CL', 'EID', 'PAS', 'CD'])('accepts %s as BTAE-16 under current IBR-183-AE', (identifierType) => {
    const exceptions = runPintAECheck(
      getCheck('UAE-UC1-CHK-037'),
      buildDataContext({}, {
        buyers: [{
          buyer_id: 'B-1', buyer_name: 'Buyer LLC', buyer_trn: '123456789012345',
          buyer_legal_reg_id: 'LEGAL-001', buyer_legal_reg_id_type: identifierType,
          buyer_electronic_address: 'buyer@example.ae',
        }],
      })
    );
    expect(exceptions).toHaveLength(0);
  });

  it.each(['TRN', 'TIN', 'VAT'])('rejects %s as BTAE-16', (identifierType) => {
    const exceptions = runPintAECheck(
      getCheck('UAE-UC1-CHK-037'),
      buildDataContext({}, {
        buyers: [{
          buyer_id: 'B-1', buyer_name: 'Buyer LLC', buyer_legal_reg_id: 'LEGAL-001',
          buyer_legal_reg_id_type: identifierType, buyer_electronic_address: 'buyer@example.ae',
        }],
      })
    );
    expect(exceptions).toHaveLength(1);
  });

  it('does not evaluate CHK-036 for a non-IBR-136 invoice type', () => {
    const result = runPintAECheckWithTelemetry(
      getCheck('UAE-UC1-CHK-036'),
      buildDataContext({ invoice_type: '380' }, { buyers: [{ buyer_id: 'B-1', buyer_name: 'Buyer LLC', buyer_trn: '123456789012345' }] })
    );
    expect(result.exceptions).toHaveLength(0);
    expect(result.telemetry.execution_count).toBe(0);
  });

  it('keeps default document-family runtime behavior pinned to legacy mode', () => {
    const check = getCheck('UAE-UC1-CHK-036');
    const data = buildDataContext(
      {
        invoice_type: '388',
      },
      {
        buyers: [
          {
            buyer_id: 'B-1',
            buyer_name: 'Buyer LLC',
            buyer_trn: '',
          },
        ],
      }
    );

    const defaultExceptions = runPintAECheck(check, data);
    const legacyExceptions = runPintAECheckWithTelemetry(check, data, {
      documentFamilyApplicabilityMode: 'legacy',
    }).exceptions;

    expect(normalizeExceptions(defaultExceptions)).toEqual(normalizeExceptions(legacyExceptions));
  });

  it('does not change non-document-family rules when scenario applicability mode is enabled', () => {
    const check = getCheck('UAE-UC1-CHK-041');
    const data = buildDataContext({ tax_category_code: 'INVALID' });

    const legacyResult = runPintAECheckWithTelemetry(check, data, {
      documentFamilyApplicabilityMode: 'legacy',
    });
    const scenarioResult = runPintAECheckWithTelemetry(check, data, {
      documentFamilyApplicabilityMode: 'scenario_context',
    });

    expect(scenarioResult.telemetry.execution_count).toBe(legacyResult.telemetry.execution_count);
    expect(scenarioResult.telemetry.failure_count).toBe(legacyResult.telemetry.failure_count);
    expect(normalizeExceptions(scenarioResult.exceptions)).toEqual(normalizeExceptions(legacyResult.exceptions));
  });

  it('keeps default vat-treatment runtime behavior pinned to legacy mode', () => {
    const check = getCheck('UAE-UC1-CHK-049');
    const data = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'E',
            exemption_reason_code: '',
            exemption_reason_text: '',
          } as InvoiceLine,
        ],
      }
    );

    const defaultExceptions = runPintAECheck(check, data);
    const legacyExceptions = runPintAECheckWithTelemetry(check, data, {
      vatTreatmentApplicabilityMode: 'legacy',
    }).exceptions;

    expect(normalizeExceptions(defaultExceptions)).toEqual(normalizeExceptions(legacyExceptions));
  });

  it('does not change non-vat-treatment rules when vat-treatment scenario mode is enabled', () => {
    const check = getCheck('UAE-UC1-CHK-036');
    const data = buildDataContext(
      {
        invoice_type: '388',
      },
      {
        buyers: [
          {
            buyer_id: 'B-1',
            buyer_name: 'Buyer LLC',
            buyer_trn: '',
          },
        ],
      }
    );

    const legacyResult = runPintAECheckWithTelemetry(check, data, {
      vatTreatmentApplicabilityMode: 'legacy',
    });
    const scenarioResult = runPintAECheckWithTelemetry(check, data, {
      vatTreatmentApplicabilityMode: 'scenario_context',
    });

    expect(scenarioResult.telemetry.execution_count).toBe(legacyResult.telemetry.execution_count);
    expect(scenarioResult.telemetry.failure_count).toBe(legacyResult.telemetry.failure_count);
    expect(normalizeExceptions(scenarioResult.exceptions)).toEqual(normalizeExceptions(legacyResult.exceptions));
  });

  it('keeps default overlay runtime behavior pinned to legacy mode', () => {
    const check = getOverlayCheck('IBR-138-AE');
    const data = buildDataContext({
      transaction_type_code: '00010000',
      invoicing_period_start_date: '',
      invoicing_period_end_date: '',
    });

    const defaultExceptions = runPintAECheck(check, data);
    const legacyExceptions = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'legacy',
    }).exceptions;

    expect(normalizeExceptions(defaultExceptions)).toEqual(normalizeExceptions(legacyExceptions));
  });

  it('does not change non-overlay rules when overlay scenario mode is enabled', () => {
    const check = getCheck('UAE-UC1-CHK-041');
    const data = buildDataContext({ tax_category_code: 'INVALID' });

    const legacyResult = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'legacy',
    });
    const scenarioResult = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'scenario_context',
    });

    expect(scenarioResult.telemetry.execution_count).toBe(legacyResult.telemetry.execution_count);
    expect(scenarioResult.telemetry.failure_count).toBe(legacyResult.telemetry.failure_count);
    expect(normalizeExceptions(scenarioResult.exceptions)).toEqual(normalizeExceptions(legacyResult.exceptions));
  });

  it('restores overlay runtime behavior when the applicability mode is rolled back to legacy', () => {
    const check = getOverlayCheck('IBR-138-AE');
    const data = buildDataContext({
      transaction_type_code: '00010000',
      invoicing_period_start_date: '',
      invoicing_period_end_date: '',
    });

    const legacyBefore = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'legacy',
    });
    const scenario = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'scenario_context',
    });
    const legacyAfter = runPintAECheckWithTelemetry(check, data, {
      overlayApplicabilityMode: 'legacy',
    });

    expect(legacyBefore.telemetry.execution_count).toBe(0);
    expect(legacyBefore.telemetry.failure_count).toBe(0);
    expect(scenario.telemetry.execution_count).toBe(1);
    expect(scenario.telemetry.failure_count).toBe(1);
    expect(normalizeExceptions(legacyAfter.exceptions)).toEqual(normalizeExceptions(legacyBefore.exceptions));
    expect(legacyAfter.telemetry).toEqual(legacyBefore.telemetry);
  });

  it('fails CHK-038/039 when both item name and description are empty', () => {
    const nameCheck = getCheck('UAE-UC1-CHK-038');
    const descCheck = getCheck('UAE-UC1-CHK-039');
    const data = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            item_name: '',
            description: '',
          },
        ],
      }
    );

    const nameExceptions = runPintAECheck(nameCheck, data);
    const descExceptions = runPintAECheck(descCheck, data);

    expect(nameExceptions).toHaveLength(1);
    expect(descExceptions).toHaveLength(1);
  });

  it.each([
    [{ item_name: 'Widget', description: 'Widget detail' }, 0, 0],
    [{ item_name: '', description: 'Widget detail' }, 1, 0],
    [{ item_name: 'Widget', description: '' }, 0, 1],
    [{ item_name: '', description: '' }, 1, 1],
  ])('enforces independent CHK-038/039 fields: %o', (values, nameFailures, descriptionFailures) => {
    const line = {
      line_id: 'L-1', invoice_id: 'INV-1', line_number: 1, quantity: 1,
      unit_price: 100, line_total_excl_vat: 100, vat_rate: 5, vat_amount: 5,
      ...values,
    } as InvoiceLine;
    const data = buildDataContext({}, { lines: [line] });
    expect(runPintAECheck(getCheck('UAE-UC1-CHK-038'), data)).toHaveLength(nameFailures);
    expect(runPintAECheck(getCheck('UAE-UC1-CHK-039'), data)).toHaveLength(descriptionFailures);
  });

  it('fails CHK-040 when quantity is non-positive under base-quantity policy', () => {
    const check = getCheck('UAE-UC1-CHK-040');
    const data = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 0,
            unit_price: 100,
            line_total_excl_vat: 0,
            vat_rate: 5,
            vat_amount: 0,
          },
        ],
      }
    );

    const exceptions = runPintAECheck(check, data);

    expect(exceptions.some((exception) => exception.field_name === 'quantity')).toBe(true);
  });

  it('validates CHK-041 for header tax category codelist', () => {
    const check = getCheck('UAE-UC1-CHK-041');
    const data = buildDataContext({ tax_category_code: 'INVALID' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-041');
    expect(exceptions[0].field_name).toBe('tax_category_code');
  });

  it('validates CHK-042 for line tax category codelist', () => {
    const check = getCheck('UAE-UC1-CHK-042');
    const data = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            tax_category_code: 'INVALID',
          },
        ],
      }
    );

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-042');
    expect(exceptions[0].field_name).toBe('tax_category_code');
  });

  it('validates CHK-043/044 for ISO3166 country codelist', () => {
    const sellerCheck = getCheck('UAE-UC1-CHK-043');
    const buyerCheck = getCheck('UAE-UC1-CHK-044');
    const data = buildDataContext(
      { seller_country: 'ZZ' },
      {
        buyers: [
          {
            buyer_id: 'B-1',
            buyer_name: 'Buyer LLC',
            buyer_country: 'ZZ',
          },
        ],
      }
    );

    const sellerExceptions = runPintAECheck(sellerCheck, data);
    const buyerExceptions = runPintAECheck(buyerCheck, data);

    expect(sellerExceptions).toHaveLength(1);
    expect(buyerExceptions).toHaveLength(1);
  });

  it('validates CHK-045 for invoice context and CHK-046 for credit-note context', () => {
    const invoiceCheck = getCheck('UAE-UC1-CHK-045');
    const creditCheck = getCheck('UAE-UC1-CHK-046');

    const invalidInvoiceData = buildDataContext({ invoice_type: '999' });
    const invoiceExceptions = runPintAECheck(invoiceCheck, invalidInvoiceData);
    expect(invoiceExceptions).toHaveLength(1);
    expect(invoiceExceptions[0].check_id).toBe('UAE-UC1-CHK-045');

    const skippedCreditContextData = buildDataContext({ invoice_type: '380' });
    const skippedCreditExceptions = runPintAECheck(creditCheck, skippedCreditContextData);
    expect(skippedCreditExceptions).toHaveLength(0);

    const invalidCreditContextData = buildDataContext({ invoice_type: '381X' });
    const invalidCreditExceptions = runPintAECheck(creditCheck, invalidCreditContextData);
    expect(invalidCreditExceptions).toHaveLength(1);
    expect(invalidCreditExceptions[0].check_id).toBe('UAE-UC1-CHK-046');
  });

  it('validates CHK-047 for UNCL4461 and skips empty optional values', () => {
    const check = getCheck('UAE-UC1-CHK-047');
    const validCode = getCodelistCodes('UNCL4461')[0];
    const validData = buildDataContext({ payment_means_code: validCode });
    const emptyData = buildDataContext({ payment_means_code: '' });
    const invalidData = buildDataContext({ payment_means_code: 'INVALID' });

    expect(runPintAECheck(check, validData)).toHaveLength(0);
    expect(runPintAECheck(check, emptyData)).toHaveLength(0);
    expect(runPintAECheck(check, invalidData)).toHaveLength(1);
  });

  it('validates CHK-055 credit note reason code presence only for credit notes', () => {
    const check = getCheck('UAE-UC1-CHK-055');

    expect(runPintAECheck(check, buildDataContext({ invoice_type: '380' }))).toHaveLength(0);
    expect(runPintAECheck(check, buildDataContext({ invoice_type: '381', credit_note_reason_code: 'ADJ' }))).toHaveLength(0);

    const missingReason = runPintAECheck(check, buildDataContext({ invoice_type: '381', credit_note_reason_code: '' }));
    expect(missingReason).toHaveLength(1);
    expect(missingReason[0].field_name).toBe('credit_note_reason_code');
  });

  it('validates CHK-056 preceding invoice reference requirement with VD waiver', () => {
    const check = getCheck('UAE-UC1-CHK-056');

    expect(runPintAECheck(check, buildDataContext({ invoice_type: '380' }))).toHaveLength(0);
    expect(runPintAECheck(check, buildDataContext({ invoice_type: '381', credit_note_reason_code: 'VD', preceding_invoice_reference: '' }))).toHaveLength(0);
    expect(runPintAECheck(check, buildDataContext({ invoice_type: '381', credit_note_reason_code: 'ADJ', preceding_invoice_reference: 'INV-0001' }))).toHaveLength(0);

    const missingReference = runPintAECheck(
      check,
      buildDataContext({ invoice_type: '381', credit_note_reason_code: 'ADJ', preceding_invoice_reference: '' })
    );
    expect(missingReference).toHaveLength(1);
    expect(missingReference[0].field_name).toBe('preceding_invoice_reference');
  });

  it('validates CHK-057 preceding invoice issue date format when present', () => {
    const check = getCheck('UAE-UC1-CHK-057');

    expect(runPintAECheck(check, buildDataContext({ preceding_invoice_issue_date: '' }))).toHaveLength(0);
    expect(runPintAECheck(check, buildDataContext({ preceding_invoice_issue_date: '2026-05-31' }))).toHaveLength(0);

    const invalidDate = runPintAECheck(check, buildDataContext({ preceding_invoice_issue_date: '31/05/2026' }));
    expect(invalidDate).toHaveLength(1);
    expect(invalidDate[0].field_name).toBe('preceding_invoice_issue_date');
  });

  it('validates CHK-058 credit note reason code membership only for populated credit notes', () => {
    const presenceCheck = getCheck('UAE-UC1-CHK-055');
    const codelistCheck = getCheck('UAE-UC1-CHK-058');
    const validReasonCode = getCodelistCodes('CreditReason')[0];

    expect(runPintAECheck(codelistCheck, buildDataContext({ invoice_type: '380', credit_note_reason_code: '' }))).toHaveLength(0);
    expect(runPintAECheck(codelistCheck, buildDataContext({ invoice_type: '381', credit_note_reason_code: validReasonCode }))).toHaveLength(0);

    const blankReason = buildDataContext({ invoice_type: '381', credit_note_reason_code: '' });
    expect(runPintAECheck(presenceCheck, blankReason)).toHaveLength(1);
    expect(runPintAECheck(codelistCheck, blankReason)).toHaveLength(0);

    const invalidReason = runPintAECheck(
      codelistCheck,
      buildDataContext({ invoice_type: '381', credit_note_reason_code: 'INVALID' })
    );
    expect(invalidReason).toHaveLength(1);
    expect(invalidReason[0].field_name).toBe('credit_note_reason_code');
  });

  it('validates CHK-034 using standards-aligned line allowance when legacy discount is absent', () => {
    const check = getCheck('UAE-UC1-CHK-034');
    const validData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 2,
            unit_price: 100,
            line_total_excl_vat: 190,
            line_allowance_amount: 10,
            vat_rate: 5,
            vat_amount: 9.5,
          } as InvoiceLine,
        ],
      }
    );

    expect(runPintAECheck(check, validData)).toHaveLength(0);
  });

  it.each([
    ['defaults IBT-149 to one when absent', 10, 5, undefined, 0, 0, 50],
    ['uses explicit IBT-149', 100, 10, 100, 0, 0, 10],
    ['subtracts a line allowance', 10, 5, undefined, 7, 0, 43],
    ['adds a line charge', 10, 5, undefined, 0, 7, 57],
    ['applies both line allowance and charge', 10, 5, undefined, 7, 3, 46],
    ['treats explicit IBT-149 of one like the default', 10, 5, 1, 0, 0, 50],
  ])('%s', (_name, quantity, price, base, allowance, charge, lineNet) => {
    const check = getCheck('UAE-UC1-CHK-034');
    const data = buildDataContext({}, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
        quantity, unit_price: price, price_base_quantity: base,
        line_allowance_amount: allowance, line_charge_amount: charge,
        line_total_excl_vat: lineNet, vat_rate: 5, vat_amount: lineNet * 0.05,
      } as InvoiceLine],
    });

    expect(runPintAECheck(check, data)).toHaveLength(0);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
  ])('does not default an explicit %s IBT-149 value to one', (_label, base) => {
    const check = getCheck('UAE-UC1-CHK-034');
    const data = buildDataContext({}, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
        quantity: 10, unit_price: 5, price_base_quantity: base,
        line_allowance_amount: 0, line_charge_amount: 0,
        line_total_excl_vat: 50, vat_rate: 5, vat_amount: 2.5,
      } as InvoiceLine],
    });

    expect(runPintAECheck(check, data)).toHaveLength(1);
  });

  it('fails CHK-034 when the supplied line net amount is incorrect', () => {
    const check = getCheck('UAE-UC1-CHK-034');
    const data = buildDataContext({}, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1,
        quantity: 100, unit_price: 10, price_base_quantity: 100,
        line_allowance_amount: 0, line_charge_amount: 0,
        line_total_excl_vat: 11, vat_rate: 5, vat_amount: 0.55,
      } as InvoiceLine],
    });

    expect(runPintAECheck(check, data)).toHaveLength(1);
  });

  it('validates CHK-048 for UNECERec20 and skips empty values', () => {
    const check = getCheck('UAE-UC1-CHK-048');
    const validCode = getCodelistCodes('UNECERec20')[0];
    const validData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            unit_of_measure: validCode,
          },
        ],
      }
    );
    const emptyData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            unit_of_measure: '',
          },
        ],
      }
    );
    const invalidData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            unit_of_measure: 'INVALID',
          },
        ],
      }
    );

    expect(runPintAECheck(check, validData)).toHaveLength(0);
    expect(runPintAECheck(check, emptyData)).toHaveLength(0);
    expect(runPintAECheck(check, invalidData)).toHaveLength(1);
  });

  it('validates IBT-150 independently through CHK-048 and keeps it separate from IBR-088', () => {
    const codelistCheck = getCheck('UAE-UC1-CHK-048');
    const relationshipCheck = getCheck('UAE-UC1-CHK-061');
    const validCode = getCodelistCodes('UNECERec20')[0];
    const data = buildDataContext({}, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1, quantity: 1, unit_price: 100,
        line_total_excl_vat: 100, vat_rate: 5, vat_amount: 5,
        unit_of_measure: validCode, price_base_quantity_uom: 'XBG',
      }],
    });

    expect(runPintAECheck(codelistCheck, data)).toHaveLength(0);
    expect(runPintAECheck(relationshipCheck, data)).toHaveLength(1);
    expect(runPintAECheck(relationshipCheck, data)[0]?.message).toContain('IBT-150');
    expect(runPintAECheck(relationshipCheck, data)[0]?.observed_value).toContain('IBT-130');
  });

  it('treats absent IBT-150 as not applicable for IBR-088', () => {
    const relationshipCheck = getCheck('UAE-UC1-CHK-061');
    const data = buildDataContext({}, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1, quantity: 1, unit_price: 100,
        line_total_excl_vat: 100, vat_rate: 5, vat_amount: 5, unit_of_measure: 'EA',
      }],
    });

    expect(runPintAECheck(relationshipCheck, data)).toHaveLength(0);
  });

  it('passes IBR-088 when IBT-150 equals IBT-130 after case/whitespace normalization', () => {
    const relationshipCheck = getCheck('UAE-UC1-CHK-061');
    const data = buildDataContext({}, {
      lines: [{
        line_id: 'L-1', invoice_id: 'INV-1', line_number: 1, quantity: 1, unit_price: 100,
        line_total_excl_vat: 100, vat_rate: 5, vat_amount: 5,
        unit_of_measure: ' ea ', price_base_quantity_uom: 'EA',
      }],
    });

    expect(runPintAECheck(relationshipCheck, data)).toHaveLength(0);
  });

  it('fails CHK-049 when exempt VAT lines are missing exemption reason details', () => {
    const check = getCheck('UAE-UC1-CHK-049');
    const data = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'E',
            exemption_reason_code: '',
            exemption_reason_text: '',
          } as InvoiceLine,
        ],
      }
    );

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].field_name).toBe('exemption_reason_code');
  });

  it.each([
    [{ exemption_reason_code: 'E1', exemption_reason_text: '' }, 0],
    [{ exemption_reason_code: '', exemption_reason_text: 'Text only' }, 1],
    [{ exemption_reason_code: '', exemption_reason_text: '' }, 1],
    [{ tax_category_code: 'S', exemption_reason_code: '', exemption_reason_text: '' }, 0],
    [{ exemption_reason_code: 'E1', exemption_reason_text: 'Text' }, 0],
  ])('enforces CHK-049 code-only exemption requirement: %o', (values, failures) => {
    const line = {
      line_id: 'L-1', invoice_id: 'INV-1', line_number: 1, quantity: 1,
      unit_price: 100, line_total_excl_vat: 100, vat_rate: 0, vat_amount: 0,
      tax_category_code: 'E', exemption_reason_code: '', exemption_reason_text: '', ...values,
    } as InvoiceLine;
    const data = buildDataContext({}, { lines: [line] });
    expect(runPintAECheck(getCheck('UAE-UC1-CHK-049'), data)).toHaveLength(failures);
  });

  it('passes CHK-049 and validates CHK-050 against AE exemption codes', () => {
    const dependencyCheck = getCheck('UAE-UC1-CHK-049');
    const codelistCheck = getCheck('UAE-UC1-CHK-050');
    const validExemptionCode = getCodelistCodes('Aligned-TaxExemptionCodes')[0];

    const validData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'E',
            exemption_reason_code: validExemptionCode,
            exemption_reason_text: 'Qualifying exempt supply',
          } as InvoiceLine,
        ],
      }
    );

    expect(runPintAECheck(dependencyCheck, validData)).toHaveLength(0);
    expect(runPintAECheck(codelistCheck, validData)).toHaveLength(0);

    const invalidData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'E',
            exemption_reason_code: 'INVALID',
            exemption_reason_text: 'Qualifying exempt supply',
          } as InvoiceLine,
        ],
      }
    );

    const invalidExceptions = runPintAECheck(codelistCheck, invalidData);
    expect(invalidExceptions).toHaveLength(1);
    expect(invalidExceptions[0].field_name).toBe('exemption_reason_code');
  });

  it('fails CHK-051 when reverse-charge VAT lines are missing goods type and validates CHK-052 codelist', () => {
    const dependencyCheck = getCheck('UAE-UC1-CHK-051');
    const codelistCheck = getCheck('UAE-UC1-CHK-052');
    const validGoodsType = getCodelistCodes('GoodsType')[0];

    const missingData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'AE',
            goods_service_type: '',
          } as InvoiceLine,
        ],
      }
    );

    expect(runPintAECheck(dependencyCheck, missingData)).toHaveLength(1);

    const validData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'AE',
            goods_service_type: validGoodsType,
          } as InvoiceLine,
        ],
      }
    );

    expect(runPintAECheck(dependencyCheck, validData)).toHaveLength(0);
    expect(runPintAECheck(codelistCheck, validData)).toHaveLength(0);

    const invalidData = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'AE',
            goods_service_type: 'INVALID',
          } as InvoiceLine,
        ],
      }
    );

    expect(runPintAECheck(codelistCheck, invalidData)).toHaveLength(1);
  });

  it('fails CHK-053 for VAT category and rate semantic contradictions', () => {
    const check = getCheck('UAE-UC1-CHK-053');

    const exemptMismatch = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            tax_category_code: 'E',
          },
        ],
      }
    );

    const standardZero = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'S',
          },
        ],
      }
    );

    const reverseChargeMismatch = buildDataContext(
      {},
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 5,
            vat_amount: 5,
            tax_category_code: 'AE',
          },
        ],
      }
    );

    expect(runPintAECheck(check, exemptMismatch)).toHaveLength(2);
    expect(runPintAECheck(check, standardZero)).toHaveLength(1);
    expect(runPintAECheck(check, reverseChargeMismatch)).toHaveLength(2);
  });

  it('fails CHK-054 when header VAT breakdown semantics conflict with line treatment', () => {
    const check = getCheck('UAE-UC1-CHK-054');
    const reverseChargeHeaderMismatch = buildDataContext(
      {
        tax_category_code: 'S',
        tax_category_rate: 5,
        vat_total: 5,
      },
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'AE',
            goods_service_type: getCodelistCodes('GoodsType')[0],
          } as InvoiceLine,
        ],
      }
    );

    const exemptHeaderMismatch = buildDataContext(
      {
        tax_category_code: 'E',
        tax_category_rate: 5,
        vat_total: 5,
      },
      {
        lines: [
          {
            line_id: 'L-1',
            invoice_id: 'INV-1',
            line_number: 1,
            quantity: 1,
            unit_price: 100,
            line_total_excl_vat: 100,
            vat_rate: 0,
            vat_amount: 0,
            tax_category_code: 'E',
            exemption_reason_code: getCodelistCodes('Aligned-TaxExemptionCodes')[0],
          } as InvoiceLine,
        ],
      }
    );

    expect(runPintAECheck(check, reverseChargeHeaderMismatch)).toHaveLength(1);
    expect(runPintAECheck(check, exemptHeaderMismatch)).toHaveLength(2);
  });
});
