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

export function getSpecRegistry(): SpecRegistry {
  return registry;
}

export function getRegistryFields(): SpecRegistryField[] {
  return registry.fields;
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
  return registry.fields.filter(isMandatoryField);
}

export function getConditionalRegistryFields(): SpecRegistryField[] {
  return registry.fields.filter(f => !isMandatoryField(f));
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
    registry.fields.length > 0
      ? (totalMapped / registry.fields.length) * 100
      : 100;

  return {
    totalRegistryFields: registry.fields.length,
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
// Given a DR ID, find all check_ids in the check pack that reference it
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

export interface DRRuleTrace {
  dr_id: string;
  business_term: string;
  linkedCheckIds: string[];
  linkedCheckNames: string[];
  registryField: SpecRegistryField;
}

export function getDRRuleTraceability(drId: string): DRRuleTrace | null {
  const regField = registry.fields.find(f => f.dr_id === drId);
  if (!regField) return null;

  const linkedChecks = UAE_UC1_CHECK_PACK.filter(
    chk =>
      chk.pint_reference_terms?.includes(drId) ||
      chk.parameters?.field === getPintFieldForDR(drId)?.id
  );

  return {
    dr_id: drId,
    business_term: regField.business_term,
    linkedCheckIds: linkedChecks.map(c => c.check_id),
    linkedCheckNames: linkedChecks.map(c => c.check_name),
    registryField: regField,
  };
}

export function getAllDRTraceability(): DRRuleTrace[] {
  return registry.fields
    .map(f => getDRRuleTraceability(f.dr_id))
    .filter((t): t is DRRuleTrace => t !== null);
}

// ── Registry field lookup by DR ID ───────────────────────────────────
export function getRegistryFieldByDR(drId: string): SpecRegistryField | undefined {
  return registry.fields.find(f => f.dr_id === drId);
}
