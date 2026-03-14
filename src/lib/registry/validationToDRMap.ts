export type ValidationDRMappingType = 'exact' | 'partial' | 'reference_only';

export interface ValidationDRTarget {
  dr_id: string;
  mapping_type: ValidationDRMappingType;
  validated_fields: string[];
}

export interface ValidationDRMapEntry {
  validation_id: string;
  dr_targets: ValidationDRTarget[];
}

function exact(dr_id: string, ...validated_fields: string[]): ValidationDRTarget {
  return { dr_id, mapping_type: 'exact', validated_fields };
}

function partial(dr_id: string, ...validated_fields: string[]): ValidationDRTarget {
  return { dr_id, mapping_type: 'partial', validated_fields };
}

function referenceOnly(dr_id: string, ...validated_fields: string[]): ValidationDRTarget {
  return { dr_id, mapping_type: 'reference_only', validated_fields };
}

export const VALIDATION_TO_DR_MAP: ValidationDRMapEntry[] = [
  { validation_id: 'UAE-UC1-CHK-001', dr_targets: [exact('IBT-001', 'invoice_number')] },
  { validation_id: 'UAE-UC1-CHK-002', dr_targets: [exact('IBT-002', 'issue_date')] },
  { validation_id: 'UAE-UC1-CHK-003', dr_targets: [exact('IBT-002', 'issue_date')] },
  { validation_id: 'UAE-UC1-CHK-004', dr_targets: [exact('IBT-003', 'invoice_type')] },
  { validation_id: 'UAE-UC1-CHK-005', dr_targets: [exact('IBT-005', 'currency')] },
  { validation_id: 'UAE-UC1-CHK-006', dr_targets: [exact('IBT-005', 'currency')] },
  { validation_id: 'UAE-UC1-CHK-007', dr_targets: [] },
  { validation_id: 'UAE-UC1-CHK-008', dr_targets: [partial('IBT-005', 'currency')] },
  { validation_id: 'UAE-UC1-CHK-009', dr_targets: [exact('IBT-009', 'payment_due_date')] },
  { validation_id: 'UAE-UC1-CHK-010', dr_targets: [exact('IBT-024', 'spec_id')] },
  { validation_id: 'UAE-UC1-CHK-011', dr_targets: [exact('IBT-023', 'business_process')] },
  { validation_id: 'UAE-UC1-CHK-012', dr_targets: [exact('IBT-027', 'seller_name')] },
  { validation_id: 'UAE-UC1-CHK-013', dr_targets: [exact('IBT-031', 'seller_trn')] },
  {
    validation_id: 'UAE-UC1-CHK-014',
    dr_targets: [
      exact('IBT-034', 'seller_electronic_address'),
      referenceOnly('IBT-034-1', 'seller_electronic_address'),
    ],
  },
  {
    validation_id: 'UAE-UC1-CHK-015',
    dr_targets: [
      exact('IBT-035', 'seller_address'),
      exact('IBT-037', 'seller_city'),
      exact('IBT-040', 'seller_country'),
    ],
  },
  { validation_id: 'UAE-UC1-CHK-016', dr_targets: [exact('IBT-039', 'seller_subdivision')] },
  { validation_id: 'UAE-UC1-CHK-017', dr_targets: [exact('IBT-044', 'buyer_name')] },
  { validation_id: 'UAE-UC1-CHK-018', dr_targets: [exact('IBT-048', 'buyer_trn')] },
  {
    validation_id: 'UAE-UC1-CHK-019',
    dr_targets: [
      exact('IBT-049', 'buyer_electronic_address'),
      referenceOnly('IBT-049-1', 'buyer_electronic_address'),
    ],
  },
  {
    validation_id: 'UAE-UC1-CHK-020',
    dr_targets: [
      exact('IBT-050', 'buyer_address'),
      exact('IBT-055', 'buyer_country'),
    ],
  },
  { validation_id: 'UAE-UC1-CHK-021', dr_targets: [exact('IBT-106', 'total_excl_vat'), partial('IBT-131', 'line_total_excl_vat')] },
  { validation_id: 'UAE-UC1-CHK-022', dr_targets: [exact('IBT-109', 'total_excl_vat')] },
  { validation_id: 'UAE-UC1-CHK-023', dr_targets: [exact('IBT-110', 'vat_total')] },
  { validation_id: 'UAE-UC1-CHK-024', dr_targets: [exact('IBT-112', 'total_incl_vat')] },
  {
    validation_id: 'UAE-UC1-CHK-025',
    dr_targets: [
      exact('IBT-109', 'total_excl_vat'),
      exact('IBT-110', 'vat_total'),
      exact('IBT-112', 'total_incl_vat'),
    ],
  },
  { validation_id: 'UAE-UC1-CHK-026', dr_targets: [exact('IBT-115', 'amount_due')] },
  { validation_id: 'UAE-UC1-CHK-027', dr_targets: [partial('IBT-116', 'total_excl_vat'), partial('IBT-118', 'tax_category_code')] },
  {
    validation_id: 'UAE-UC1-CHK-028',
    dr_targets: [
      partial('IBT-117', 'vat_total', 'vat_amount'),
      partial('IBT-119', 'tax_category_rate'),
      partial('IBT-151', 'tax_category_code'),
      partial('IBT-152', 'vat_rate'),
      exact('BTUAE-08', 'vat_amount'),
    ],
  },
  { validation_id: 'UAE-UC1-CHK-029', dr_targets: [exact('IBT-110', 'vat_total'), partial('IBT-117', 'vat_total')] },
  { validation_id: 'UAE-UC1-CHK-030', dr_targets: [] },
  { validation_id: 'UAE-UC1-CHK-031', dr_targets: [exact('IBT-126', 'line_id', 'line_number')] },
  { validation_id: 'UAE-UC1-CHK-032', dr_targets: [exact('IBT-129', 'quantity')] },
  { validation_id: 'UAE-UC1-CHK-033', dr_targets: [exact('IBT-130', 'unit_of_measure')] },
  {
    validation_id: 'UAE-UC1-CHK-034',
    dr_targets: [
      partial('IBT-129', 'quantity'),
      exact('IBT-131', 'line_total_excl_vat'),
      partial('IBT-146', 'unit_price'),
      partial('IBT-148', 'unit_price'),
      partial('IBT-149', 'price_base_quantity', 'line_base_quantity', 'item_price_base_quantity'),
    ],
  },
  {
    validation_id: 'UAE-UC1-CHK-035',
    dr_targets: [
      partial('IBT-131', 'line_total_excl_vat'),
      partial('IBT-005', 'currency'),
    ],
  },
  { validation_id: 'UAE-UC1-CHK-036', dr_targets: [partial('IBT-048', 'buyer_legal_reg_id', 'buyer_trn')] },
  { validation_id: 'UAE-UC1-CHK-037', dr_targets: [referenceOnly('BTUAE-15', 'buyer_legal_reg_id_type', 'buyer_reg_id_type')] },
  { validation_id: 'UAE-UC1-CHK-038', dr_targets: [exact('IBT-154', 'item_name'), partial('IBT-153', 'description')] },
  { validation_id: 'UAE-UC1-CHK-039', dr_targets: [exact('IBT-153', 'description'), partial('IBT-154', 'item_name')] },
  { validation_id: 'UAE-UC1-CHK-040', dr_targets: [partial('IBT-149', 'price_base_quantity', 'line_base_quantity', 'item_price_base_quantity'), partial('IBT-129', 'quantity'), partial('IBT-146', 'unit_price')] },
  { validation_id: 'UAE-UC1-CHK-041', dr_targets: [exact('IBT-118', 'tax_category_code')] },
  { validation_id: 'UAE-UC1-CHK-042', dr_targets: [exact('IBT-151', 'tax_category_code')] },
  { validation_id: 'UAE-UC1-CHK-043', dr_targets: [exact('IBT-040', 'seller_country')] },
  { validation_id: 'UAE-UC1-CHK-044', dr_targets: [exact('IBT-055', 'buyer_country')] },
  { validation_id: 'UAE-UC1-CHK-045', dr_targets: [exact('IBT-003', 'invoice_type')] },
  { validation_id: 'UAE-UC1-CHK-046', dr_targets: [exact('IBT-003', 'invoice_type')] },
  { validation_id: 'UAE-UC1-CHK-047', dr_targets: [exact('IBT-081', 'payment_means_code')] },
  { validation_id: 'UAE-UC1-CHK-048', dr_targets: [exact('IBT-130', 'unit_of_measure')] },
  { validation_id: 'UAE-UC1-CHK-049', dr_targets: [partial('IBT-151', 'tax_category_code')] },
  { validation_id: 'UAE-UC1-CHK-050', dr_targets: [partial('IBT-151', 'tax_category_code')] },
  { validation_id: 'UAE-UC1-CHK-051', dr_targets: [partial('IBT-151', 'tax_category_code')] },
  { validation_id: 'UAE-UC1-CHK-052', dr_targets: [partial('IBT-151', 'tax_category_code')] },
  {
    validation_id: 'UAE-UC1-CHK-053',
    dr_targets: [
      partial('IBT-151', 'tax_category_code'),
      partial('IBT-152', 'vat_rate'),
      exact('BTUAE-08', 'vat_amount'),
    ],
  },
  {
    validation_id: 'UAE-UC1-CHK-054',
    dr_targets: [
      partial('IBT-118', 'tax_category_code'),
      partial('IBT-119', 'tax_category_rate'),
      partial('IBT-117', 'vat_total'),
    ],
  },
];

const validationMap = new Map(VALIDATION_TO_DR_MAP.map((entry) => [entry.validation_id, entry]));

export function getValidationDRMapEntry(validationId: string): ValidationDRMapEntry | undefined {
  return validationMap.get(validationId);
}

export function getValidationDRTargets(
  validationId: string,
  options?: { includeReferenceOnly?: boolean }
): ValidationDRTarget[] {
  const includeReferenceOnly = options?.includeReferenceOnly ?? false;
  const entry = getValidationDRMapEntry(validationId);
  if (!entry) return [];
  return includeReferenceOnly
    ? entry.dr_targets
    : entry.dr_targets.filter((target) => target.mapping_type !== 'reference_only');
}

export function getValidationIdsForDR(
  drId: string,
  options?: { includeReferenceOnly?: boolean }
): string[] {
  const includeReferenceOnly = options?.includeReferenceOnly ?? false;
  return VALIDATION_TO_DR_MAP
    .filter((entry) =>
      entry.dr_targets.some(
        (target) => target.dr_id === drId && (includeReferenceOnly || target.mapping_type !== 'reference_only')
      )
    )
    .map((entry) => entry.validation_id);
}

export function getDRCoverageMaturity(drId: string): 'runtime_enforced' | 'reference_only' | 'unmapped' {
  const targets = VALIDATION_TO_DR_MAP.flatMap((entry) =>
    entry.dr_targets.filter((target) => target.dr_id === drId)
  );
  if (targets.some((target) => target.mapping_type === 'exact' || target.mapping_type === 'partial')) {
    return 'runtime_enforced';
  }
  if (targets.some((target) => target.mapping_type === 'reference_only')) {
    return 'reference_only';
  }
  return 'unmapped';
}
