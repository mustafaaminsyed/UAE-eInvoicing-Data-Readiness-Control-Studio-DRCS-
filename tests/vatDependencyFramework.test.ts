import { describe, expect, it } from 'vitest';
import { runPintAECheck } from '@/lib/checks/pintAECheckRunner';
import { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { PintAECheck } from '@/types/pintAE';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';

function buildDataContext(
  headerOverrides: Partial<InvoiceHeader>,
  lineOverrides: Partial<InvoiceLine>
): DataContext {
  const buyers: Buyer[] = [{ buyer_id: 'B-1', buyer_name: 'Buyer LLC', buyer_trn: '100123456700003' }];
  const headers: InvoiceHeader[] = [
    {
      invoice_id: 'INV-1',
      invoice_number: 'INV-1',
      issue_date: '2026-03-01',
      seller_trn: '100123456700003',
      buyer_id: 'B-1',
      currency: 'AED',
      invoice_type: '380',
      ...headerOverrides,
    },
  ];
  const lines: InvoiceLine[] = [
    {
      line_id: 'L-1',
      invoice_id: 'INV-1',
      line_number: 1,
      quantity: 1,
      unit_price: 100,
      line_total_excl_vat: 100,
      vat_rate: 0,
      vat_amount: 0,
      tax_category_code: 'EXEMPT',
      ...lineOverrides,
    },
  ];

  return {
    buyers,
    headers,
    lines,
    buyerMap: new Map(buyers.map((buyer) => [buyer.buyer_id, buyer])),
    headerMap: new Map(headers.map((header) => [header.invoice_id, header])),
    linesByInvoice: new Map([['INV-1', lines]]),
  };
}

describe('VAT dependency rule framework', () => {
  it('supports future conditional semantic requirements without custom switch branches', () => {
    const check: PintAECheck = {
      check_id: 'UAE-UC1-FUTURE-EXEMPT',
      check_name: 'Future Exempt VAT Dependency',
      description: 'Requires exemption code when tax category is exempt',
      scope: 'Lines',
      rule_type: 'dependency_rule',
      execution_layer: 'dependency_rule',
      severity: 'High',
      use_case: 'Future VAT semantic controls',
      pint_reference_terms: ['IBT-151'],
      owner_team_default: 'Client IT',
      is_enabled: true,
      parameters: {
        field: 'tax_category_code',
        when: [{ field: 'tax_category_code', equals: 'EXEMPT' }],
        require_any_of: ['exemption_reason_code'],
        failure_message: 'Exemption code is required when VAT category is EXEMPT',
      },
    };

    const failingContext = buildDataContext({}, { tax_category_code: 'EXEMPT', exemption_reason_code: '' } as any);
    const passingContext = buildDataContext({}, { tax_category_code: 'EXEMPT', exemption_reason_code: 'VATEX-AE' } as any);

    expect(runPintAECheck(check, failingContext)).toHaveLength(1);
    expect(runPintAECheck(check, passingContext)).toHaveLength(0);
  });

  it('ships executable AE exempt and reverse-charge dependency rules with authoritative mappings', () => {
    const exemptCheck = UAE_UC1_CHECK_PACK.find((check) => check.check_id === 'UAE-UC1-CHK-049');
    const reverseChargeCheck = UAE_UC1_CHECK_PACK.find((check) => check.check_id === 'UAE-UC1-CHK-051');

    expect(exemptCheck).toEqual(
      expect.objectContaining({
        rule_type: 'dependency_rule',
        execution_layer: 'dependency_rule',
      })
    );
    expect(reverseChargeCheck).toEqual(
      expect.objectContaining({
        rule_type: 'dependency_rule',
        execution_layer: 'dependency_rule',
      })
    );

    expect(getValidationDRTargets('UAE-UC1-CHK-049')).toEqual([
      expect.objectContaining({ dr_id: 'IBT-151', mapping_type: 'partial' }),
    ]);
    expect(getValidationDRTargets('UAE-UC1-CHK-051')).toEqual([
      expect.objectContaining({ dr_id: 'IBT-151', mapping_type: 'partial' }),
    ]);
  });
});
