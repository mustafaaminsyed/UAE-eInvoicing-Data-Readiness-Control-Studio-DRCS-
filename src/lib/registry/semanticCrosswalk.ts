export type SemanticCrosswalkApplicability = 'both' | 'tax_invoice' | 'commercial_xml' | 'divergent';

export type SemanticCrosswalkMappingType =
  | 'DIRECT'
  | 'SYSTEM_DEFAULT'
  | 'DERIVED'
  | 'AGGREGATED'
  | 'CONDITIONAL';

export type SemanticCrosswalkTraceabilityTarget =
  | 'DIRECT_RULE'
  | 'INDIRECT_RULE'
  | 'SYSTEM_DEFAULT'
  | 'AGGREGATED_COVERED'
  | 'CONDITIONAL_LOGIC_REQUIRED'
  | 'MAPPING_INCONSISTENT'
  | 'NOT_IN_TEMPLATE_BY_DESIGN';

export type SemanticCrosswalkCurrentTraceability =
  | SemanticCrosswalkTraceabilityTarget
  | 'REFERENCE_ONLY'
  | 'NO_EXECUTABLE_RULE';

export type SemanticCrosswalkRuntimeAlignmentStatus =
  | 'ALIGNED'
  | 'PARTIALLY_ALIGNED'
  | 'NOT_ALIGNED';

export type SemanticCrosswalkGovernanceFlag =
  | 'NONE'
  | 'SYSTEM_GOVERNED'
  | 'SCENARIO_DRIVEN'
  | 'SEMANTIC_DIVERGENCE'
  | 'ASP_DERIVED';

export type SemanticCrosswalkTemplateDataset = 'headers' | 'buyers' | 'system' | 'mixed';
export type SemanticCrosswalkDocumentVariant = 'tax_invoice' | 'commercial_xml';

export interface SemanticCrosswalkRow {
  key: string;
  mofFieldNumber: number;
  mofFieldName: string;
  documentApplicability: SemanticCrosswalkApplicability;
  semanticId: string | null;
  semanticIdByDocumentType?: Partial<Record<SemanticCrosswalkDocumentVariant, string>>;
  dcsCanonicalField: string;
  dcsCanonicalFieldByDocumentType?: Partial<Record<SemanticCrosswalkDocumentVariant, string>>;
  runtimeFieldKey: string | null;
  dcsDomain: string;
  templateDataset: SemanticCrosswalkTemplateDataset;
  templateSource: string;
  sourceColumnKeys: string[];
  mappingType: SemanticCrosswalkMappingType;
  populationMethod: string;
  targetStateTraceability: SemanticCrosswalkTraceabilityTarget;
  currentStateTraceability: SemanticCrosswalkCurrentTraceability;
  runtimeAlignmentStatus: SemanticCrosswalkRuntimeAlignmentStatus;
  recommendedTraceabilityTarget: SemanticCrosswalkTraceabilityTarget;
  governanceFlag: SemanticCrosswalkGovernanceFlag;
  notes: string;
}

export const SEMANTIC_CROSSWALK_VERSION = 'uae-mof-v1-fields-1-29';

type SemanticCrosswalkRowDefinition =
  Omit<
    SemanticCrosswalkRow,
    | 'runtimeFieldKey'
    | 'targetStateTraceability'
    | 'currentStateTraceability'
    | 'runtimeAlignmentStatus'
    | 'recommendedTraceabilityTarget'
  > & {
    runtimeFieldKey?: string | null;
    targetStateTraceability?: SemanticCrosswalkTraceabilityTarget;
    currentStateTraceability?: SemanticCrosswalkCurrentTraceability;
    runtimeAlignmentStatus?: SemanticCrosswalkRuntimeAlignmentStatus;
    recommendedTraceabilityTarget?: SemanticCrosswalkTraceabilityTarget;
  };

const SEMANTIC_CROSSWALK_ROW_DEFINITIONS: SemanticCrosswalkRowDefinition[] = [
  {
    key: 'CW-001',
    mofFieldNumber: 1,
    mofFieldName: 'Invoice number',
    documentApplicability: 'both',
    semanticId: 'IBT-001',
    dcsCanonicalField: 'invoice_number',
    dcsDomain: 'Header',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template',
    sourceColumnKeys: ['invoice_number'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Unique invoice identifier.',
  },
  {
    key: 'CW-002',
    mofFieldNumber: 2,
    mofFieldName: 'Invoice date',
    documentApplicability: 'both',
    semanticId: 'IBT-002',
    dcsCanonicalField: 'invoice_issue_date',
    dcsDomain: 'Header',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template',
    sourceColumnKeys: ['issue_date'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Current template column is issue_date.',
  },
  {
    key: 'CW-003',
    mofFieldNumber: 3,
    mofFieldName: 'Invoice type code',
    documentApplicability: 'both',
    semanticId: 'IBT-003',
    dcsCanonicalField: 'invoice_type_code',
    dcsDomain: 'Header',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template',
    sourceColumnKeys: ['invoice_type'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Functional invoice type.',
  },
  {
    key: 'CW-004',
    mofFieldNumber: 4,
    mofFieldName: 'Invoice currency code',
    documentApplicability: 'both',
    semanticId: 'IBT-005',
    dcsCanonicalField: 'invoice_currency_code',
    dcsDomain: 'Header',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template',
    sourceColumnKeys: ['currency'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Currency of invoice amounts.',
  },
  {
    key: 'CW-005',
    mofFieldNumber: 5,
    mofFieldName: 'Invoice transaction type code',
    documentApplicability: 'both',
    semanticId: 'BTUAE-02',
    dcsCanonicalField: 'transaction_type_code',
    dcsDomain: 'Header',
    templateDataset: 'mixed',
    templateSource: 'invoice_headers template + scenario runtime logic',
    sourceColumnKeys: ['transaction_type_code'],
    mappingType: 'CONDITIONAL',
    populationMethod: 'Source indicators with runtime scenario/applicability composition.',
    targetStateTraceability: 'INDIRECT_RULE',
    governanceFlag: 'SCENARIO_DRIVEN',
    notes: 'UAE-specific scenario signal; should not be forced into a simple direct-rule bucket.',
  },
  {
    key: 'CW-006',
    mofFieldNumber: 6,
    mofFieldName: 'Payment due date',
    documentApplicability: 'both',
    semanticId: 'IBT-009',
    dcsCanonicalField: 'payment_due_date',
    dcsDomain: 'Header',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template',
    sourceColumnKeys: ['payment_due_date'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Modeled as a direct field in the current template.',
  },
  {
    key: 'CW-007',
    mofFieldNumber: 7,
    mofFieldName: 'Business process type',
    documentApplicability: 'both',
    semanticId: 'IBT-023',
    dcsCanonicalField: 'business_process_type',
    dcsDomain: 'System/Header',
    templateDataset: 'system',
    templateSource: 'system default',
    sourceColumnKeys: ['business_process'],
    mappingType: 'SYSTEM_DEFAULT',
    populationMethod: 'Fixed predefined value.',
    recommendedTraceabilityTarget: 'SYSTEM_DEFAULT',
    governanceFlag: 'SYSTEM_GOVERNED',
    notes: 'System-governed and intentionally not sourced from the upload template. Canonical field business_process_type maps to runtime key business_process.',
  },
  {
    key: 'CW-008',
    mofFieldNumber: 8,
    mofFieldName: 'Specification Identifier',
    documentApplicability: 'both',
    semanticId: 'IBT-024',
    dcsCanonicalField: 'specification_identifier',
    dcsDomain: 'System/Header',
    templateDataset: 'system',
    templateSource: 'system default',
    sourceColumnKeys: ['spec_id'],
    mappingType: 'SYSTEM_DEFAULT',
    populationMethod: 'Fixed predefined value.',
    recommendedTraceabilityTarget: 'SYSTEM_DEFAULT',
    governanceFlag: 'SYSTEM_GOVERNED',
    notes: 'System-governed and intentionally not sourced from the upload template. Canonical field specification_identifier maps to runtime key spec_id.',
  },
  {
    key: 'CW-009',
    mofFieldNumber: 9,
    mofFieldName: 'Payment means type code',
    documentApplicability: 'both',
    semanticId: 'IBT-081',
    dcsCanonicalField: 'payment_means_type_code',
    dcsDomain: 'Header',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template',
    sourceColumnKeys: ['payment_means_code'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Settlement method code.',
  },
  {
    key: 'CW-010',
    mofFieldNumber: 10,
    mofFieldName: 'Seller name',
    documentApplicability: 'both',
    semanticId: 'IBT-027',
    dcsCanonicalField: 'seller_name',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_name'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Legal or trading name.',
  },
  {
    key: 'CW-011',
    mofFieldNumber: 11,
    mofFieldName: 'Seller electronic address',
    documentApplicability: 'both',
    semanticId: 'IBT-034',
    dcsCanonicalField: 'seller_electronic_address',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_electronic_address'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Endpoint address; current repo validates presence directly.',
  },
  {
    key: 'CW-012',
    mofFieldNumber: 12,
    mofFieldName: 'Seller electronic identifier',
    documentApplicability: 'both',
    semanticId: 'IBT-034-1',
    dcsCanonicalField: 'seller_electronic_identifier',
    dcsDomain: 'Seller/System',
    templateDataset: 'system',
    templateSource: 'system default / endpoint scheme governance',
    sourceColumnKeys: [],
    runtimeFieldKey: null,
    mappingType: 'SYSTEM_DEFAULT',
    populationMethod: 'Fixed UAE value 0235 for UAE businesses.',
    targetStateTraceability: 'SYSTEM_DEFAULT',
    currentStateTraceability: 'REFERENCE_ONLY',
    runtimeAlignmentStatus: 'PARTIALLY_ALIGNED',
    governanceFlag: 'SYSTEM_GOVERNED',
    notes: 'Scheme/identifier value is system-governed rather than template-sourced.',
  },
  {
    key: 'CW-013',
    mofFieldNumber: 13,
    mofFieldName: 'Seller legal registration identifier',
    documentApplicability: 'both',
    semanticId: 'IBT-030',
    dcsCanonicalField: 'seller_legal_reg_id',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_legal_reg_id'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    targetStateTraceability: 'DIRECT_RULE',
    currentStateTraceability: 'DIRECT_RULE',
    runtimeAlignmentStatus: 'ALIGNED',
    governanceFlag: 'NONE',
    notes: 'Official registrar-issued identifier.',
  },
  {
    key: 'CW-014',
    mofFieldNumber: 14,
    mofFieldName: 'Seller legal registration identifier type',
    documentApplicability: 'both',
    semanticId: 'BTUAE-15',
    dcsCanonicalField: 'seller_legal_reg_id_type',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_legal_reg_id_type'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input with local code-list validation.',
    targetStateTraceability: 'DIRECT_RULE',
    currentStateTraceability: 'DIRECT_RULE',
    runtimeAlignmentStatus: 'ALIGNED',
    governanceFlag: 'NONE',
    notes: 'Seller-side only; must not be collapsed into buyer-side identifier type logic.',
  },
  {
    key: 'CW-015',
    mofFieldNumber: 15,
    mofFieldName: 'Seller tax identifier / tax registration identifier',
    documentApplicability: 'both',
    semanticId: 'IBT-031',
    dcsCanonicalField: 'seller_tax_identifier',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_trn'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Current template uses seller_trn as the runtime field key for the broader canonical seller_tax_identifier concept.',
  },
  {
    key: 'CW-016',
    mofFieldNumber: 16,
    mofFieldName: 'Seller tax scheme code',
    documentApplicability: 'both',
    semanticId: 'IBT-031-1',
    dcsCanonicalField: 'seller_tax_scheme_code',
    dcsDomain: 'Seller/System',
    templateDataset: 'system',
    templateSource: 'system default',
    sourceColumnKeys: [],
    mappingType: 'SYSTEM_DEFAULT',
    populationMethod: 'Fixed value VAT.',
    recommendedTraceabilityTarget: 'SYSTEM_DEFAULT',
    governanceFlag: 'SYSTEM_GOVERNED',
    notes: 'Not in template by design unless an override path is introduced later.',
  },
  {
    key: 'CW-017',
    mofFieldNumber: 17,
    mofFieldName: 'Seller address line 1',
    documentApplicability: 'both',
    semanticId: 'IBT-035',
    dcsCanonicalField: 'seller_address_line_1',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_address'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Current template stores this as seller_address; canonical field seller_address_line_1 is an alias, not a runtime rename.',
  },
  {
    key: 'CW-018',
    mofFieldNumber: 18,
    mofFieldName: 'Seller city',
    documentApplicability: 'both',
    semanticId: 'IBT-037',
    dcsCanonicalField: 'seller_city',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_city'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'City or town name.',
  },
  {
    key: 'CW-019',
    mofFieldNumber: 19,
    mofFieldName: 'Seller country subdivision',
    documentApplicability: 'both',
    semanticId: 'IBT-039',
    dcsCanonicalField: 'seller_country_subdivision',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_subdivision'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Current template stores the subdivision in seller_subdivision.',
  },
  {
    key: 'CW-020',
    mofFieldNumber: 20,
    mofFieldName: 'Seller country code',
    documentApplicability: 'both',
    semanticId: 'IBT-040',
    dcsCanonicalField: 'seller_country_code',
    dcsDomain: 'Seller',
    templateDataset: 'headers',
    templateSource: 'invoice_headers template / seller master',
    sourceColumnKeys: ['seller_country'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input; UAE implementations may default AE through governance.',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Kept direct in v1 to preserve current runtime assumptions.',
  },
  {
    key: 'CW-021',
    mofFieldNumber: 21,
    mofFieldName: 'Buyer name',
    documentApplicability: 'both',
    semanticId: 'IBT-044',
    dcsCanonicalField: 'buyer_name',
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_name'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Full buyer name.',
  },
  {
    key: 'CW-022',
    mofFieldNumber: 22,
    mofFieldName: 'Buyer electronic address',
    documentApplicability: 'both',
    semanticId: 'IBT-049',
    dcsCanonicalField: 'buyer_electronic_address',
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_electronic_address'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Invoice delivery endpoint address.',
  },
  {
    key: 'CW-023',
    mofFieldNumber: 23,
    mofFieldName: 'Buyer electronic identifier',
    documentApplicability: 'both',
    semanticId: 'IBT-049-1',
    dcsCanonicalField: 'buyer_electronic_identifier',
    dcsDomain: 'Buyer/System',
    templateDataset: 'mixed',
    templateSource: 'buyer routing context / ASP-derived scheme',
    sourceColumnKeys: ['buyer_electronic_address'],
    mappingType: 'DERIVED',
    populationMethod: 'Derived from routing/scheme context rather than sourced as its own upload column.',
    currentStateTraceability: 'REFERENCE_ONLY',
    runtimeAlignmentStatus: 'PARTIALLY_ALIGNED',
    recommendedTraceabilityTarget: 'NOT_IN_TEMPLATE_BY_DESIGN',
    governanceFlag: 'ASP_DERIVED',
    notes: 'Current repo models the scheme as ASP-derived, not as a separate buyer template column; current runtime support is reference-only.',
  },
  {
    key: 'CW-024',
    mofFieldNumber: 24,
    mofFieldName: 'Buyer tax identifier / Buyer legal registration identifier',
    documentApplicability: 'divergent',
    semanticId: null,
    semanticIdByDocumentType: {
      tax_invoice: 'IBT-048',
      commercial_xml: 'IBT-047',
    },
    dcsCanonicalField: 'buyer_identifier_primary',
    runtimeFieldKey: null,
    dcsCanonicalFieldByDocumentType: {
      tax_invoice: 'buyer_tax_identifier',
      commercial_xml: 'buyer_legal_reg_id',
    },
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_trn', 'buyer_legal_reg_id'],
    mappingType: 'CONDITIONAL',
    populationMethod: 'Source input with document-type-specific semantic selection.',
    targetStateTraceability: 'CONDITIONAL_LOGIC_REQUIRED',
    currentStateTraceability: 'MAPPING_INCONSISTENT',
    runtimeAlignmentStatus: 'NOT_ALIGNED',
    governanceFlag: 'SEMANTIC_DIVERGENCE',
    notes: 'Tax invoice and commercial XML lists diverge here and must not be flattened into one meaning.',
  },
  {
    key: 'CW-025',
    mofFieldNumber: 25,
    mofFieldName: 'Buyer tax scheme code / Buyer legal registration identifier type',
    documentApplicability: 'divergent',
    semanticId: null,
    semanticIdByDocumentType: {
      tax_invoice: 'IBT-048-1',
      commercial_xml: 'BTAE-16',
    },
    dcsCanonicalField: 'buyer_identifier_scheme_or_type',
    runtimeFieldKey: null,
    dcsCanonicalFieldByDocumentType: {
      tax_invoice: 'buyer_tax_scheme_code',
      commercial_xml: 'buyer_legal_reg_id_type',
    },
    dcsDomain: 'Buyer',
    templateDataset: 'mixed',
    templateSource: 'buyers context + system governance',
    sourceColumnKeys: ['buyer_legal_reg_id_type', 'buyer_reg_id_type'],
    mappingType: 'CONDITIONAL',
    populationMethod: 'Source input plus document-type logic and VAT/default governance.',
    targetStateTraceability: 'CONDITIONAL_LOGIC_REQUIRED',
    currentStateTraceability: 'MAPPING_INCONSISTENT',
    runtimeAlignmentStatus: 'NOT_ALIGNED',
    governanceFlag: 'SEMANTIC_DIVERGENCE',
    notes: 'Tax invoice uses tax scheme code while commercial XML uses buyer legal registration identifier type.',
  },
  {
    key: 'CW-026',
    mofFieldNumber: 26,
    mofFieldName: 'Buyer address line 1',
    documentApplicability: 'both',
    semanticId: 'IBT-050',
    dcsCanonicalField: 'buyer_address_line_1',
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_address'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Current template stores this as buyer_address; canonical field buyer_address_line_1 is an alias, not a runtime rename.',
  },
  {
    key: 'CW-027',
    mofFieldNumber: 27,
    mofFieldName: 'Buyer city',
    documentApplicability: 'both',
    semanticId: 'IBT-052',
    dcsCanonicalField: 'buyer_city',
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_city'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    targetStateTraceability: 'DIRECT_RULE',
    currentStateTraceability: 'DIRECT_RULE',
    runtimeAlignmentStatus: 'ALIGNED',
    governanceFlag: 'NONE',
    notes: 'City or town name.',
  },
  {
    key: 'CW-028',
    mofFieldNumber: 28,
    mofFieldName: 'Buyer country subdivision',
    documentApplicability: 'both',
    semanticId: 'IBT-054',
    dcsCanonicalField: 'buyer_country_subdivision',
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_subdivision'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    targetStateTraceability: 'DIRECT_RULE',
    currentStateTraceability: 'DIRECT_RULE',
    runtimeAlignmentStatus: 'ALIGNED',
    governanceFlag: 'NONE',
    notes: 'Current template stores this as buyer_subdivision.',
  },
  {
    key: 'CW-029',
    mofFieldNumber: 29,
    mofFieldName: 'Buyer country code',
    documentApplicability: 'both',
    semanticId: 'IBT-055',
    dcsCanonicalField: 'buyer_country_code',
    dcsDomain: 'Buyer',
    templateDataset: 'buyers',
    templateSource: 'buyers template',
    sourceColumnKeys: ['buyer_country'],
    mappingType: 'DIRECT',
    populationMethod: 'ERP/source input',
    recommendedTraceabilityTarget: 'DIRECT_RULE',
    governanceFlag: 'NONE',
    notes: 'Country identifier.',
  },
];

export const SEMANTIC_CROSSWALK_ROWS: SemanticCrosswalkRow[] = SEMANTIC_CROSSWALK_ROW_DEFINITIONS.map(
  (row) => {
    const targetStateTraceability =
      row.targetStateTraceability ?? row.recommendedTraceabilityTarget ?? 'DIRECT_RULE';
    return {
      ...row,
      runtimeFieldKey: row.runtimeFieldKey ?? row.sourceColumnKeys[0] ?? null,
      targetStateTraceability,
      currentStateTraceability: row.currentStateTraceability ?? targetStateTraceability,
      runtimeAlignmentStatus: row.runtimeAlignmentStatus ?? 'ALIGNED',
      recommendedTraceabilityTarget: row.recommendedTraceabilityTarget ?? targetStateTraceability,
    };
  }
);

const rowsByMoFFieldNumber = new Map<number, SemanticCrosswalkRow>();
const rowsByCanonicalField = new Map<string, SemanticCrosswalkRow>();
const rowsByDrId = new Map<string, SemanticCrosswalkRow>();

for (const row of SEMANTIC_CROSSWALK_ROWS) {
  if (rowsByMoFFieldNumber.has(row.mofFieldNumber)) {
    throw new Error(`Duplicate semantic crosswalk MoF field number: ${row.mofFieldNumber}`);
  }
  rowsByMoFFieldNumber.set(row.mofFieldNumber, row);

  rowsByCanonicalField.set(row.dcsCanonicalField, row);
  Object.values(row.dcsCanonicalFieldByDocumentType ?? {}).forEach((field) => {
    rowsByCanonicalField.set(field, row);
  });

  if (row.semanticId) {
    rowsByDrId.set(row.semanticId, row);
  }
  Object.values(row.semanticIdByDocumentType ?? {}).forEach((drId) => {
    rowsByDrId.set(drId, row);
  });
}

export function getSemanticCrosswalkRows(): SemanticCrosswalkRow[] {
  return SEMANTIC_CROSSWALK_ROWS;
}

export function getSemanticCrosswalkRowByMoFFieldNumber(
  mofFieldNumber: number
): SemanticCrosswalkRow | undefined {
  return rowsByMoFFieldNumber.get(mofFieldNumber);
}

export function getSemanticCrosswalkRowByDrId(drId: string): SemanticCrosswalkRow | undefined {
  return rowsByDrId.get(drId);
}

export function getSemanticCrosswalkRowByCanonicalField(
  canonicalField: string
): SemanticCrosswalkRow | undefined {
  return rowsByCanonicalField.get(canonicalField);
}
