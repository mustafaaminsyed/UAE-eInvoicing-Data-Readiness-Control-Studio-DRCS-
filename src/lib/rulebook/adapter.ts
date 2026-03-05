import { RulebookAdapterResult, MofRulebook, AdaptedRulebookCheck, MofInvoiceType } from '@/lib/rulebook/types';

const FIELD_NUMBER_TO_INTERNAL_FIELD: Record<number, string | undefined> = {
  1: 'invoice_number',
  2: 'issue_date',
  3: 'invoice_type',
  4: 'currency',
  5: 'transaction_type_code',
  6: 'payment_due_date',
  7: 'business_process',
  8: 'spec_id',
  9: 'payment_means_code',
  10: 'seller_name',
  11: 'seller_electronic_address',
  13: 'seller_legal_reg_id',
  14: 'seller_legal_reg_id_type',
  15: 'seller_trn',
  17: 'seller_address',
  18: 'seller_city',
  19: 'seller_subdivision',
  20: 'seller_country',
  21: 'buyer_name',
  22: 'buyer_electronic_address',
  24: 'buyer_legal_reg_id',
  25: 'buyer_legal_reg_id_type',
  26: 'buyer_address',
  27: 'buyer_city',
  28: 'buyer_subdivision',
  29: 'buyer_country',
  31: 'total_excl_vat',
  32: 'vat_total',
  33: 'total_incl_vat',
  34: 'amount_due',
  37: 'tax_category_code',
  38: 'tax_category_rate',
  39: 'line_id',
  40: 'quantity',
  41: 'unit_of_measure',
  42: 'line_total_excl_vat',
  43: 'unit_price',
  44: 'item_gross_price',
  46: 'tax_category_code',
  47: 'vat_rate',
  48: 'line_vat_amount_aed',
  49: 'line_amount_aed',
  50: 'item_name',
  51: 'description',
};

export function getInternalFieldByMofFieldNumber(fieldNumber: number): string | undefined {
  return FIELD_NUMBER_TO_INTERNAL_FIELD[fieldNumber];
}

function normalizeInvoiceTypes(value: MofInvoiceType | MofInvoiceType[]): MofInvoiceType[] {
  return Array.isArray(value) ? value : [value];
}

export function adaptMofRulebook(rulebook: MofRulebook): RulebookAdapterResult {
  const checks: AdaptedRulebookCheck[] = rulebook.validation_rules.map((rule) => {
    let executable = true;
    let reasonNotExecutable: string | undefined;
    let internalField: string | undefined;

    if (typeof rule.field_number === 'number') {
      internalField = getInternalFieldByMofFieldNumber(rule.field_number);
      if (!internalField) {
        executable = false;
        reasonNotExecutable = `No internal field mapping for MoF field ${rule.field_number}`;
      }
    }

    if (rule.type === 'presence' && (!rule.required_field_numbers || rule.required_field_numbers.length === 0)) {
      executable = false;
      reasonNotExecutable = 'Presence rule missing required_field_numbers';
    }

    return {
      id: rule.rule_id,
      ruleType: rule.type,
      invoiceTypes: normalizeInvoiceTypes(rule.invoice_type),
      severity: rule.severity === 'error' ? 'High' : 'Low',
      executable,
      reasonNotExecutable,
      fieldNumber: rule.field_number,
      internalField,
      exceptionCode: rule.exception_code,
    };
  });

  const executableCount = checks.filter((c) => c.executable).length;
  const nonExecutableCount = checks.length - executableCount;

  return {
    checks,
    executableCount,
    nonExecutableCount,
  };
}
