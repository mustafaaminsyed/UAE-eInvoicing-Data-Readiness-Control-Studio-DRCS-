// =============================================================================
// Conformance Configuration
// Central thresholds for coverage gating, traceability, and validation tolerances
// =============================================================================

export const CONFORMANCE_CONFIG = {
  /** Active spec version label shown in UI */
  specVersionLabel: 'PINT-AE 2025-Q2 - UAE DR v1.0.1',

  /** Default use case for mandatory field resolution */
  defaultUseCase: 'UAE B2B Standard Invoice',

  /** Minimum mandatory DR mapping coverage (%) to allow check runs */
  mandatoryMappingCoverageThreshold: 100,

  /** Minimum mandatory DR population coverage (%) to allow check runs */
  mandatoryPopulationThreshold: 99,

  /** Population warning threshold - DRs below this are flagged */
  populationWarningThreshold: 99,

  /** Maximum gaps shown in Evidence Pack */
  evidencePackTopGaps: 10,

  // Validation Tolerances
  /** Default tolerance for monetary calculations (header totals, line net, etc.) */
  monetaryTolerance: 0.01,

  /** Allowed VAT rates for UC1 (percentage values) */
  allowedVatRates: [0, 5],

  /** Allowed invoice type codes for UC1 Standard Tax Invoice */
  allowedInvoiceTypeCodes: ['380', '381', '383', '384', '386', '389'],

  /** Allowed payment means codes (UNTDID 4461 subset) */
  allowedPaymentMeansCodes: [
    '10', '20', '30', '31', '42', '48', '49', '57', '58', '59', 'ZZZ',
  ],

  /** Valid UAE emirate subdivision codes */
  allowedSubdivisionCodes: [
    'AE-AZ', 'AE-AJ', 'AE-FU', 'AE-SH', 'AE-DU', 'AE-RK', 'AE-UQ',
  ],

  /** ISO 3166-1 alpha-2 country code pattern */
  countryCodePattern: /^[A-Z]{2}$/,

  /** UAE TRN pattern: exactly 15 digits */
  trnPattern: /^\d{15}$/,

  /** Date format pattern: YYYY-MM-DD */
  datePattern: /^\d{4}-\d{2}-\d{2}$/,

  /** Currency ISO 4217 pattern */
  currencyPattern: /^[A-Z]{3}$/,
} as const;

export type ConformanceConfig = typeof CONFORMANCE_CONFIG;