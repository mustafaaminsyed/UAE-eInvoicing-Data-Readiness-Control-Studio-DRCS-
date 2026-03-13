import type { PintAECheck } from '@/types/pintAE';

export type RuntimeEnforceableNow = 'yes' | 'no' | 'conditional';

export interface CodelistGovernanceRow {
  codelistName: string;
  runtimeEnforceableNow: RuntimeEnforceableNow;
}

// Runtime-friendly governance read model derived from the reconciliation artifact.
// Keep this lightweight and explicit so registry KPIs can be rendered without parsing CSV at runtime.
export const PINT_AE_CODELIST_GOVERNANCE_ROWS: CodelistGovernanceRow[] = [
  { codelistName: 'Aligned-TaxCategoryCodes', runtimeEnforceableNow: 'yes' },
  { codelistName: 'Aligned-TaxExemptionCodes', runtimeEnforceableNow: 'no' },
  { codelistName: 'CreditReason', runtimeEnforceableNow: 'no' },
  { codelistName: 'eas', runtimeEnforceableNow: 'conditional' },
  { codelistName: 'FreqBilling', runtimeEnforceableNow: 'no' },
  { codelistName: 'GoodsType', runtimeEnforceableNow: 'no' },
  { codelistName: 'ICD', runtimeEnforceableNow: 'no' },
  { codelistName: 'ISO3166', runtimeEnforceableNow: 'yes' },
  { codelistName: 'ISO4217', runtimeEnforceableNow: 'yes' },
  { codelistName: 'ItemType', runtimeEnforceableNow: 'no' },
  { codelistName: 'MimeCode', runtimeEnforceableNow: 'no' },
  { codelistName: 'SEPA', runtimeEnforceableNow: 'no' },
  { codelistName: 'transactiontype', runtimeEnforceableNow: 'conditional' },
  { codelistName: 'UNCL1001-cn', runtimeEnforceableNow: 'conditional' },
  { codelistName: 'UNCL1001-inv', runtimeEnforceableNow: 'yes' },
  { codelistName: 'UNCL1153', runtimeEnforceableNow: 'no' },
  { codelistName: 'UNCL2005', runtimeEnforceableNow: 'no' },
  { codelistName: 'UNCL4461', runtimeEnforceableNow: 'conditional' },
  { codelistName: 'UNCL5189', runtimeEnforceableNow: 'no' },
  { codelistName: 'UNCL7143', runtimeEnforceableNow: 'no' },
  { codelistName: 'UNCL7161', runtimeEnforceableNow: 'no' },
  { codelistName: 'UNECERec20', runtimeEnforceableNow: 'yes' },
];

export const PINT_AE_CODELIST_GOVERNANCE_COUNTS = {
  packagedPintCodelists: 21,
  governedCodedDomains: PINT_AE_CODELIST_GOVERNANCE_ROWS.length,
  enforceableNow: PINT_AE_CODELIST_GOVERNANCE_ROWS.filter(
    (row) => row.runtimeEnforceableNow === 'yes'
  ).length,
  conditional: PINT_AE_CODELIST_GOVERNANCE_ROWS.filter(
    (row) => row.runtimeEnforceableNow === 'conditional'
  ).length,
  deferredOrNonRuntime: PINT_AE_CODELIST_GOVERNANCE_ROWS.filter(
    (row) => row.runtimeEnforceableNow === 'no'
  ).length,
} as const;

export function countRuntimeCodelistDomains(checks: PintAECheck[]): number {
  return new Set(
    checks
      .filter(
        (check) => check.rule_type === 'CodeList' && typeof check.parameters?.codelist === 'string'
      )
      .map((check) => String(check.parameters?.codelist).trim())
      .filter((codelist) => codelist.length > 0)
  ).size;
}
