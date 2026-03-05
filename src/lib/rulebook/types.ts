import { Severity } from '@/types/compliance';

export type MofInvoiceType = 'tax_invoice' | 'commercial_xml';

export type MofRuleType =
  | 'presence'
  | 'equals'
  | 'regex'
  | 'conditional_format'
  | 'default_if_missing'
  | 'gross_price_consistency'
  | 'fx_consistency';

export interface MofSpec {
  jurisdiction: string;
  source_document: {
    title: string;
    version: string;
    date: string;
  };
}

export interface MofFieldDefinition {
  field_number: number;
  name: string;
  section: string;
  cardinality: string;
  applies_to: MofInvoiceType[];
  semantics?: Record<string, unknown>;
  default?: string;
}

export interface MofValidationRule {
  rule_id: string;
  invoice_type: MofInvoiceType | MofInvoiceType[];
  severity: 'error' | 'warning';
  type: MofRuleType;
  required_field_numbers?: number[];
  field_count?: number;
  field_number?: number;
  expected_value?: string;
  pattern?: string;
  cases?: Array<Record<string, unknown>>;
  default_value?: string;
  exception_code: string;
}

export interface MofExceptionTemplate {
  exception_code: string;
  severity: 'error' | 'warning';
  message: string;
  explanation_template: string;
  suggested_fix: string;
}

export interface MofRulebook {
  spec: MofSpec;
  field_dictionary: {
    global_defaults?: Record<string, unknown>;
    fields: MofFieldDefinition[];
  };
  validation_rules: MofValidationRule[];
  exception_explanations: MofExceptionTemplate[];
}

export interface RulebookValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AdaptedRulebookCheck {
  id: string;
  ruleType: MofRuleType;
  invoiceTypes: MofInvoiceType[];
  severity: Severity;
  executable: boolean;
  reasonNotExecutable?: string;
  fieldNumber?: number;
  internalField?: string;
  exceptionCode: string;
}

export interface RulebookAdapterResult {
  checks: AdaptedRulebookCheck[];
  executableCount: number;
  nonExecutableCount: number;
}
