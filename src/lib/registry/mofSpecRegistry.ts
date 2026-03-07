import mofSourceSchema from '../../../specs/uae/mof/source-schema-v1.json';

export type MoFDocumentType = 'tax_invoice' | 'commercial_xml';

export interface MoFRule {
  rule_statement: string;
  rule_class: string;
}

export interface MoFField {
  field_id: number;
  field_name: string;
  document_type: MoFDocumentType;
  section_id: string;
  mandatory: boolean;
  scope: string;
  source_status: string;
  rules: MoFRule[];
  notes: string[];
}

interface MoFDocumentModel {
  description: string;
  fields: Record<string, MoFField>;
}

interface MoFBaselineSummaryEntry {
  field_range: string;
  field_count: number;
  certainty: string;
}

interface MoFSourceSchema {
  meta: {
    schema_name: string;
    schema_version: string;
    status: string;
    purpose: string;
    source_of_truth_policy: string;
    notes: string[];
  };
  baseline_summary: {
    tax_invoice: MoFBaselineSummaryEntry;
    commercial_xml: MoFBaselineSummaryEntry;
    shared_core_fields: { field_range: string; certainty: string };
    tax_invoice_extension: { field_range: string; certainty: string };
    commercial_xml_extension: { field_range: string; certainty: string };
  };
  document_models: Record<MoFDocumentType, MoFDocumentModel>;
}

const registry: MoFSourceSchema = mofSourceSchema as MoFSourceSchema;

function assertDocumentType(documentType: string): asserts documentType is MoFDocumentType {
  if (documentType !== 'tax_invoice' && documentType !== 'commercial_xml') {
    throw new Error(`Unsupported MoF document_type: ${documentType}`);
  }
}

export function getMoFSpecRegistry(): MoFSourceSchema {
  return registry;
}

export function getMoFDocumentTypes(): MoFDocumentType[] {
  return ['tax_invoice', 'commercial_xml'];
}

export function getMoFBaselineFieldCount(documentType: MoFDocumentType): number {
  return registry.baseline_summary[documentType].field_count;
}

export function getMoFFields(documentType: MoFDocumentType): MoFField[] {
  assertDocumentType(documentType);
  const model = registry.document_models[documentType];
  if (!model || !model.fields) return [];
  return Object.values(model.fields).sort((a, b) => a.field_id - b.field_id);
}

export function getMoFMandatoryFields(documentType: MoFDocumentType): MoFField[] {
  return getMoFFields(documentType).filter((field) => field.mandatory);
}

export function getMoFFieldById(documentType: MoFDocumentType, fieldId: number): MoFField | undefined {
  return getMoFFields(documentType).find((field) => field.field_id === fieldId);
}

export function getMoFDerivedRules(documentType: MoFDocumentType): Array<{ field_id: number; rules: MoFRule[] }> {
  return getMoFFields(documentType)
    .map((field) => ({
      field_id: field.field_id,
      rules: (field.rules || []).filter((rule) => rule.rule_class === 'source_derived'),
    }))
    .filter((entry) => entry.rules.length > 0);
}

