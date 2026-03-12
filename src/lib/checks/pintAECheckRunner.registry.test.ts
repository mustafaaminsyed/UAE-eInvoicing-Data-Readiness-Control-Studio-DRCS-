import { describe, expect, it } from 'vitest';
import { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { runPintAECheck } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getCodelistCodes } from '@/lib/pintAE/specCatalog';

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

describe('runPintAECheck executor registry parity', () => {
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

  it('fails CHK-036 for commercial profile when buyer legal identifier is absent', () => {
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

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-036');
    expect(exceptions[0].message).toContain('Buyer legal registration identifier is missing');
  });

  it('fails CHK-037 when identifier type policy resolves to disallowed value', () => {
    const check = getCheck('UAE-UC1-CHK-037');
    const strictCheck = {
      ...check,
      parameters: {
        ...check.parameters,
        allow_default_identifier_type: false,
      },
    };
    const data = buildDataContext(
      {
        invoice_type: '388',
        buyer_legal_reg_id_type: 'XYZ',
      } as InvoiceHeader,
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

    const exceptions = runPintAECheck(strictCheck, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-037');
    expect(exceptions[0].message).toContain('not allowed');
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
});
