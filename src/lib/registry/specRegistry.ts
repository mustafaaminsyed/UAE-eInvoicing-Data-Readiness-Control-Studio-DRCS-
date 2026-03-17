// PINT-AE Spec Registry Loader
// Loads the authoritative 2025-Q2 registry and provides query helpers
// for coverage computation, mandatory gating, and DR→rule traceability.

import registryData from '../../../specs/uae/pint-ae/2025-q2.json';
import { PintAEField, PINT_AE_UC1_FIELDS } from '@/types/fieldMapping';

// ── Registry Field Type ──────────────────────────────────────────────
export interface SpecRegistryField {
  dr_id: string;
  business_term: string;
  category: string;
  mandatory_flag_by_use_case: string;
  pint_ae_cardinality: string;
  data_type: string;
  format_pattern: string;
  validation_logic: string;
  derivation_logic: string;
  error_message_text: string;
  ubl_xml_path: string;
  mls_relevance: string;
  vat_law_status: string;
  data_responsibility: string;
}

export interface SpecRegistry {
  specId: string;
  version: string;
  description: string;
  effectiveDate: string;
  fieldCount: number;
  fields: SpecRegistryField[];
}

// ── Singleton registry instance ──────────────────────────────────────
const registry: SpecRegistry = registryData as SpecRegistry;

const BRIDGED_OVERLAY_FIELDS: SpecRegistryField[] = [
  {
    dr_id: 'BTAE-14',
    business_term: 'Principal ID',
    category: 'conditional_header',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Disclosed Agent billing)',
    pint_ae_cardinality: '0..1',
    data_type: 'String',
    format_pattern: '15-digit VAT registration number when used as TRN',
    validation_logic: 'Required when Invoice transaction type code indicates Disclosed Agent billing.',
    derivation_logic: 'Provided by ERP input; no ASP derivation.',
    error_message_text: 'Principal ID is required for disclosed agent billing invoices.',
    ubl_xml_path: 'cac:AccountingSupplierParty/cac:Party/cac:AgentParty/cac:PartyTaxScheme/cbc:CompanyID',
    mls_relevance: 'medium',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
  {
    dr_id: 'IBG-14',
    business_term: 'Invoicing period',
    category: 'conditional_header_group',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Summary invoice)',
    pint_ae_cardinality: '0..1',
    data_type: 'Group',
    format_pattern: 'Invoicing period start date and/or end date',
    validation_logic: 'Required when Invoice transaction type code indicates Summary invoice.',
    derivation_logic: 'Grouped from ERP period start/end fields.',
    error_message_text: 'Invoicing period is required for summary invoices.',
    ubl_xml_path: 'cac:InvoicePeriod',
    mls_relevance: 'medium',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
  {
    dr_id: 'IBG-13',
    business_term: 'Delivery information',
    category: 'conditional_header_group',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Export / E-commerce overlays)',
    pint_ae_cardinality: '0..1',
    data_type: 'Group',
    format_pattern: 'Delivery address group',
    validation_logic: 'Required when Invoice transaction type code indicates export or e-commerce overlay scenarios.',
    derivation_logic: 'Grouped from deliver-to address fields.',
    error_message_text: 'Delivery information is required for export-related overlay scenarios.',
    ubl_xml_path: 'cac:Delivery/cac:DeliveryLocation/cac:Address',
    mls_relevance: 'medium',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
  {
    dr_id: 'IBT-075',
    business_term: 'Deliver to address line 1',
    category: 'conditional_header',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Export / E-commerce overlays)',
    pint_ae_cardinality: '0..1',
    data_type: 'String',
    format_pattern: 'Free text',
    validation_logic: 'Required when Delivery information is required.',
    derivation_logic: 'Provided by ERP input; no ASP derivation.',
    error_message_text: 'Deliver-to address line 1 is required when delivery information is present.',
    ubl_xml_path: 'cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:StreetName',
    mls_relevance: 'low',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
  {
    dr_id: 'IBT-077',
    business_term: 'Deliver to city',
    category: 'conditional_header',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Export / E-commerce overlays)',
    pint_ae_cardinality: '0..1',
    data_type: 'String',
    format_pattern: 'Free text',
    validation_logic: 'Required when Delivery information is required.',
    derivation_logic: 'Provided by ERP input; no ASP derivation.',
    error_message_text: 'Deliver-to city is required when delivery information is present.',
    ubl_xml_path: 'cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:CityName',
    mls_relevance: 'low',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
  {
    dr_id: 'IBT-079',
    business_term: 'Deliver to country subdivision',
    category: 'conditional_header',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Export / E-commerce overlays)',
    pint_ae_cardinality: '0..1',
    data_type: 'Code',
    format_pattern: 'ISO 3166-2 or governed local subdivision code',
    validation_logic: 'Required when Delivery information is required and subdivision is relevant.',
    derivation_logic: 'Provided by ERP input; no ASP derivation.',
    error_message_text: 'Deliver-to country subdivision is required when delivery information is present.',
    ubl_xml_path: 'cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:CountrySubentityCode',
    mls_relevance: 'low',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
  {
    dr_id: 'IBT-080',
    business_term: 'Deliver to country code',
    category: 'conditional_header',
    mandatory_flag_by_use_case: 'Conditional Mandatory (Export overlay)',
    pint_ae_cardinality: '0..1',
    data_type: 'Code',
    format_pattern: 'ISO 3166-1 alpha-2',
    validation_logic: 'Required for export overlays and must not be AE when export delivery is modeled.',
    derivation_logic: 'Provided by ERP input; no ASP derivation.',
    error_message_text: 'Deliver-to country code is required for export delivery overlays.',
    ubl_xml_path: 'cac:Delivery/cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode',
    mls_relevance: 'low',
    vat_law_status: 'Conditional',
    data_responsibility: 'ERP (Corner 1)',
  },
];

function getMergedRegistryFields(): SpecRegistryField[] {
  const merged = [...registry.fields];
  for (const field of BRIDGED_OVERLAY_FIELDS) {
    if (!merged.some((candidate) => candidate.dr_id === field.dr_id)) {
      merged.push(field);
    }
  }
  return merged;
}

export function getSpecRegistry(): SpecRegistry {
  const fields = getMergedRegistryFields();
  return {
    ...registry,
    fieldCount: fields.length,
    fields,
  };
}

export function getRegistryFields(): SpecRegistryField[] {
  return getSpecRegistry().fields;
}

// ── Mandatory detection ──────────────────────────────────────────────
// A field is mandatory if its cardinality starts with "1" (i.e. 1..1)
// and its mandatory flag text contains "Mandatory"
export function isMandatoryField(field: SpecRegistryField): boolean {
  return (
    field.pint_ae_cardinality.startsWith('1') &&
    field.mandatory_flag_by_use_case.toLowerCase().includes('mandatory')
  );
}

export function getMandatoryRegistryFields(): SpecRegistryField[] {
  return getRegistryFields().filter(isMandatoryField);
}

export function getConditionalRegistryFields(): SpecRegistryField[] {
  return getRegistryFields().filter(f => !isMandatoryField(f));
}

// ── DR → Existing PintAEField bridging ───────────────────────────────
// Maps DR IDs from the registry to the existing PINT_AE_UC1_FIELDS
// used by the mapping engine (backward-compatible bridge)
const ibtToPintFieldMap = new Map<string, PintAEField>();
for (const pf of PINT_AE_UC1_FIELDS) {
  ibtToPintFieldMap.set(pf.ibtReference, pf);
}

export function getPintFieldForDR(drId: string): PintAEField | undefined {
  return ibtToPintFieldMap.get(drId);
}

// ── Coverage helpers against registry ────────────────────────────────
// Compute coverage using registry as the authoritative source
export interface RegistryCoverageResult {
  totalRegistryFields: number;
  mandatoryRegistryFields: number;
  mappedMandatory: SpecRegistryField[];
  unmappedMandatory: SpecRegistryField[];
  mappedConditional: SpecRegistryField[];
  unmappedConditional: SpecRegistryField[];
  mandatoryCoveragePct: number;
  overallCoveragePct: number;
  isReadyForActivation: boolean;
}

export function computeRegistryCoverage(
  mappedDrIds: Set<string>
): RegistryCoverageResult {
  const fields = getRegistryFields();
  const mandatory = getMandatoryRegistryFields();
  const conditional = getConditionalRegistryFields();

  const mappedMandatory = mandatory.filter(f => mappedDrIds.has(f.dr_id));
  const unmappedMandatory = mandatory.filter(f => !mappedDrIds.has(f.dr_id));
  const mappedConditional = conditional.filter(f => mappedDrIds.has(f.dr_id));
  const unmappedConditional = conditional.filter(f => !mappedDrIds.has(f.dr_id));

  const mandatoryCoveragePct =
    mandatory.length > 0
      ? (mappedMandatory.length / mandatory.length) * 100
      : 100;

  const totalMapped = mappedMandatory.length + mappedConditional.length;
  const overallCoveragePct =
    fields.length > 0
      ? (totalMapped / fields.length) * 100
      : 100;

  return {
    totalRegistryFields: fields.length,
    mandatoryRegistryFields: mandatory.length,
    mappedMandatory,
    unmappedMandatory,
    mappedConditional,
    unmappedConditional,
    mandatoryCoveragePct,
    overallCoveragePct,
    isReadyForActivation: unmappedMandatory.length === 0,
  };
}

// ── DR → Rule traceability ───────────────────────────────────────────
// Given a DR ID, find all executable rules linked via the authoritative traceability model.
import { getRulesForDR } from '@/lib/rules/ruleTraceability';

export interface DRRuleTrace {
  dr_id: string;
  business_term: string;
  linkedCheckIds: string[];
  linkedCheckNames: string[];
  registryField: SpecRegistryField;
}

export function getDRRuleTraceability(drId: string): DRRuleTrace | null {
  const regField = getRegistryFields().find(f => f.dr_id === drId);
  if (!regField) return null;

  const linkedChecks = getRulesForDR(drId);

  return {
    dr_id: drId,
    business_term: regField.business_term,
    linkedCheckIds: linkedChecks.map((c) => c.rule_id),
    linkedCheckNames: linkedChecks.map((c) => c.rule_name),
    registryField: regField,
  };
}

export function getAllDRTraceability(): DRRuleTrace[] {
  return getRegistryFields()
    .map(f => getDRRuleTraceability(f.dr_id))
    .filter((t): t is DRRuleTrace => t !== null);
}

// ── Registry field lookup by DR ID ───────────────────────────────────
export function getRegistryFieldByDR(drId: string): SpecRegistryField | undefined {
  return getRegistryFields().find(f => f.dr_id === drId);
}
