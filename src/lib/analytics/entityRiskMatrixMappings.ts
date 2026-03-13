import type { Exception } from '@/types/compliance';
import type { ComplianceRadarAxisKey } from '@/lib/analytics/complianceRadar';
import type { EntityRiskMatrixDrillDownMode } from '@/types/entityRiskMatrix';

interface DimensionSignalMatcher {
  checkIdIncludes?: string[];
  checkNameIncludes?: string[];
  messageIncludes?: string[];
  fieldIncludes?: string[];
}

export interface EntityRiskMatrixMappingDefinition {
  key: ComplianceRadarAxisKey;
  drillDownMode: EntityRiskMatrixDrillDownMode;
  scoreSignals: string[];
  description: string;
  matchers: DimensionSignalMatcher[];
}

export const ENTITY_RISK_MATRIX_MAPPINGS: Record<
  ComplianceRadarAxisKey,
  EntityRiskMatrixMappingDefinition
> = {
  mandatory_coverage: {
    key: 'mandatory_coverage',
    drillDownMode: 'precise',
    scoreSignals: ['mandatory fields', 'required source fields', 'missing header attributes'],
    description: 'Maps missing or mandatory field failures to seller-level coverage pressure.',
    matchers: [
      {
        checkIdIncludes: ['missing_mandatory', 'mandatory', 'missing'],
        checkNameIncludes: ['mandatory', 'missing'],
        messageIncludes: ['mandatory', 'missing', 'required'],
      },
    ],
  },
  pint_structure_readiness: {
    key: 'pint_structure_readiness',
    drillDownMode: 'precise',
    scoreSignals: ['schema/structure checks', 'format validity', 'document structure conformance'],
    description: 'Maps structure and format failures to seller-level PINT readiness pressure.',
    matchers: [
      {
        checkIdIncludes: ['format', 'schema', 'structure', 'duplicate_invoice_number', 'invoice_number_variant'],
        checkNameIncludes: ['format', 'schema', 'structure', 'duplicate'],
        messageIncludes: ['format', 'schema', 'structure', 'duplicate'],
      },
    ],
  },
  tax_logic_integrity: {
    key: 'tax_logic_integrity',
    drillDownMode: 'precise',
    scoreSignals: ['VAT/tax rules', 'totals reconciliation', 'amount logic'],
    description: 'Maps tax and arithmetic failures to seller-level tax logic pressure.',
    matchers: [
      {
        checkIdIncludes: ['vat', 'tax', 'total', 'amount', 'credit_note', 'mixed_vat'],
        checkNameIncludes: ['vat', 'tax', 'total', 'amount'],
        messageIncludes: ['vat', 'tax', 'total', 'amount'],
      },
    ],
  },
  codelist_conformance: {
    key: 'codelist_conformance',
    drillDownMode: 'precise',
    scoreSignals: ['enumerated codes', 'country/currency/unit validation', 'identifier schemes'],
    description: 'Maps codelist and coded-domain failures to seller-level conformance pressure.',
    matchers: [
      {
        checkIdIncludes: [
          'code',
          'codelist',
          'currency',
          'country',
          'unit',
          'scheme',
          'payment_means',
          'tax_category',
          'iso3166',
        ],
        checkNameIncludes: ['code', 'codelist', 'currency', 'country', 'unit', 'scheme'],
        messageIncludes: ['code list', 'codelist', 'currency', 'country', 'unit', 'scheme'],
        fieldIncludes: ['currency', 'country', 'code', 'unit', 'scheme'],
      },
    ],
  },
  master_data_quality: {
    key: 'master_data_quality',
    drillDownMode: 'precise',
    scoreSignals: ['buyer/seller master data', 'registration identifiers', 'address quality'],
    description: 'Maps seller and counterparty master-data failures to seller-level quality pressure.',
    matchers: [
      {
        checkIdIncludes: [
          'buyer_not_found',
          'buyer_trn',
          'seller_trn',
          'address',
          'city',
          'postcode',
          'subdivision',
          'registration',
          'electronic_address',
        ],
        checkNameIncludes: ['buyer', 'seller', 'trn', 'address', 'registration'],
        messageIncludes: ['buyer', 'seller', 'trn', 'address', 'registration'],
        fieldIncludes: ['buyer', 'seller', 'trn', 'address', 'city', 'postcode', 'subdivision'],
      },
    ],
  },
  exception_control_health: {
    key: 'exception_control_health',
    drillDownMode: 'contextual',
    scoreSignals: ['overall seller exception mix', 'critical pressure', 'exception load'],
    description: 'Uses the seller exception profile broadly rather than a narrow check family.',
    matchers: [],
  },
};

function includesAny(haystack: string, needles?: string[]): boolean {
  if (!needles || needles.length === 0) return false;
  return needles.some((needle) => haystack.includes(needle));
}

function normalize(value?: string | number): string {
  return String(value || '').toLowerCase();
}

export function getEntityRiskMatrixMappingDefinition(
  key: ComplianceRadarAxisKey
): EntityRiskMatrixMappingDefinition {
  return ENTITY_RISK_MATRIX_MAPPINGS[key];
}

export function matchesEntityRiskMatrixDimension(
  exception: Exception,
  key: ComplianceRadarAxisKey
): boolean {
  const mapping = ENTITY_RISK_MATRIX_MAPPINGS[key];
  if (mapping.matchers.length === 0) return true;

  const checkId = normalize(exception.checkId);
  const checkName = normalize(exception.checkName);
  const message = normalize(exception.message);
  const field = normalize(exception.field);

  return mapping.matchers.some((matcher) => {
    return (
      includesAny(checkId, matcher.checkIdIncludes) ||
      includesAny(checkName, matcher.checkNameIncludes) ||
      includesAny(message, matcher.messageIncludes) ||
      includesAny(field, matcher.fieldIncludes)
    );
  });
}

export function getEntityRiskMatrixDimensionExceptions(
  exceptions: Exception[],
  key: ComplianceRadarAxisKey
): Exception[] {
  const mapping = ENTITY_RISK_MATRIX_MAPPINGS[key];
  if (mapping.drillDownMode === 'contextual') return exceptions;
  return exceptions.filter((exception) => matchesEntityRiskMatrixDimension(exception, key));
}
