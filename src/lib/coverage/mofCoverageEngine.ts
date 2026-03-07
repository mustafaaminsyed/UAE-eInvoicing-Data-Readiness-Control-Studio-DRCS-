import { PARSER_KNOWN_COLUMNS } from '@/lib/registry/drRegistry';
import { getMoFFields, getMoFMandatoryFields, getMoFSpecRegistry, MoFDocumentType } from '@/lib/registry/mofSpecRegistry';

type DatasetFile = 'buyers' | 'headers' | 'lines';
type MoFCoverageStatus = 'COVERED' | 'NOT_IN_TEMPLATE' | 'NOT_INGESTIBLE' | 'NO_BRIDGE';

interface MoFBridge {
  dataset: DatasetFile;
  columns: string[];
}

export interface MoFMappedColumnsInput {
  buyers?: string[];
  headers?: string[];
  lines?: string[];
}

export interface MoFCoverageRow {
  documentType: MoFDocumentType;
  fieldId: number;
  fieldName: string;
  sectionId: string;
  mandatory: boolean;
  sourceStatus: string;
  dataset: DatasetFile | null;
  columns: string[];
  inTemplate: boolean;
  ingestible: boolean;
  status: MoFCoverageStatus;
}

export interface MoFCoverageResult {
  sourceSchema: string;
  sourceVersion: string;
  documentType: MoFDocumentType;
  totalFields: number;
  mandatoryFields: number;
  coveredMandatory: number;
  mandatoryNotInTemplate: number;
  mandatoryNotIngestible: number;
  mandatoryNoBridge: number;
  mandatoryCoveragePct: number;
  mappableMandatoryFields: number;
  mappableCoveredMandatory: number;
  mappableMandatoryCoveragePct: number;
  rows: MoFCoverageRow[];
}

const SHARED_CORE_FIELD_BRIDGE: Record<number, MoFBridge> = {
  1: { dataset: 'headers', columns: ['invoice_number'] },
  2: { dataset: 'headers', columns: ['issue_date'] },
  3: { dataset: 'headers', columns: ['invoice_type'] },
  4: { dataset: 'headers', columns: ['currency'] },
  5: { dataset: 'headers', columns: ['transaction_type_code'] },
  6: { dataset: 'headers', columns: ['payment_due_date'] },
  7: { dataset: 'headers', columns: ['business_process'] },
  8: { dataset: 'headers', columns: ['spec_id'] },
  9: { dataset: 'headers', columns: ['payment_means_code'] },
  10: { dataset: 'headers', columns: ['seller_name'] },
  11: { dataset: 'headers', columns: ['seller_electronic_address'] },
  12: { dataset: 'headers', columns: [] },
  13: { dataset: 'headers', columns: ['seller_legal_reg_id'] },
  14: { dataset: 'headers', columns: ['seller_legal_reg_id_type'] },
  15: { dataset: 'headers', columns: ['seller_trn'] },
  16: { dataset: 'headers', columns: [] },
  17: { dataset: 'headers', columns: ['seller_address'] },
  18: { dataset: 'headers', columns: ['seller_city'] },
  19: { dataset: 'headers', columns: ['seller_subdivision'] },
  20: { dataset: 'headers', columns: ['seller_country'] },
  21: { dataset: 'buyers', columns: ['buyer_name'] },
  22: { dataset: 'buyers', columns: ['buyer_electronic_address'] },
  23: { dataset: 'buyers', columns: ['buyer_id'] },
  24: { dataset: 'buyers', columns: ['buyer_trn'] },
  25: { dataset: 'buyers', columns: [] },
  26: { dataset: 'buyers', columns: ['buyer_address'] },
  27: { dataset: 'buyers', columns: ['buyer_city'] },
  28: { dataset: 'buyers', columns: ['buyer_subdivision'] },
  29: { dataset: 'buyers', columns: ['buyer_country'] },
  30: { dataset: 'headers', columns: ['total_excl_vat'] },
  31: { dataset: 'headers', columns: ['total_excl_vat'] },
  32: { dataset: 'headers', columns: ['vat_total'] },
  33: { dataset: 'headers', columns: ['total_incl_vat'] },
  34: { dataset: 'headers', columns: ['amount_due'] },
  35: { dataset: 'headers', columns: ['tax_category_code'] },
  36: { dataset: 'headers', columns: ['vat_total'] },
  37: { dataset: 'headers', columns: ['tax_category_code'] },
  38: { dataset: 'headers', columns: ['tax_category_rate'] },
  39: { dataset: 'lines', columns: ['line_id'] },
  40: { dataset: 'lines', columns: ['quantity'] },
  41: { dataset: 'lines', columns: ['unit_of_measure'] },
};

const TAX_EXTENSION_FIELD_BRIDGE: Record<number, MoFBridge> = {
  42: { dataset: 'lines', columns: ['line_total_excl_vat'] },
  43: { dataset: 'lines', columns: ['unit_price'] },
  44: { dataset: 'lines', columns: ['unit_price'] },
  45: { dataset: 'lines', columns: [] },
  46: { dataset: 'lines', columns: ['tax_category_code'] },
  47: { dataset: 'lines', columns: ['vat_rate'] },
  48: { dataset: 'lines', columns: ['vat_amount'] },
  49: { dataset: 'headers', columns: [] },
  50: { dataset: 'lines', columns: ['item_name'] },
  51: { dataset: 'lines', columns: ['description'] },
};

const COMMERCIAL_EXTENSION_FIELD_BRIDGE: Record<number, MoFBridge> = {
  42: { dataset: 'lines', columns: ['line_total_excl_vat'] },
  43: { dataset: 'lines', columns: ['unit_price'] },
  44: { dataset: 'lines', columns: ['unit_price'] },
  45: { dataset: 'lines', columns: [] },
  46: { dataset: 'lines', columns: ['tax_category_code'] },
  47: { dataset: 'lines', columns: ['vat_rate'] },
  48: { dataset: 'lines', columns: ['vat_amount'] },
  49: { dataset: 'headers', columns: [] },
};

function getBridgeForField(documentType: MoFDocumentType, fieldId: number): MoFBridge | null {
  if (fieldId <= 41) return SHARED_CORE_FIELD_BRIDGE[fieldId] ?? null;
  if (documentType === 'tax_invoice') return TAX_EXTENSION_FIELD_BRIDGE[fieldId] ?? null;
  return COMMERCIAL_EXTENSION_FIELD_BRIDGE[fieldId] ?? null;
}

function toSet(values?: string[]): Set<string> {
  return new Set((values || []).map((v) => v.trim()).filter(Boolean));
}

export function computeMoFCoverage(
  documentType: MoFDocumentType,
  mappedColumnsInput?: MoFMappedColumnsInput
): MoFCoverageResult {
  const registry = getMoFSpecRegistry();
  const fields = getMoFFields(documentType);
  const mandatory = getMoFMandatoryFields(documentType);

  const mappedColumns: Record<DatasetFile, Set<string>> = {
    buyers: toSet(mappedColumnsInput?.buyers),
    headers: toSet(mappedColumnsInput?.headers),
    lines: toSet(mappedColumnsInput?.lines),
  };

  let coveredMandatory = 0;
  let mandatoryNotInTemplate = 0;
  let mandatoryNotIngestible = 0;
  let mandatoryNoBridge = 0;

  const rows: MoFCoverageRow[] = fields.map((field) => {
    const bridge = getBridgeForField(documentType, field.field_id);
    if (!bridge) {
      if (field.mandatory) mandatoryNoBridge++;
      return {
        documentType,
        fieldId: field.field_id,
        fieldName: field.field_name,
        sectionId: field.section_id,
        mandatory: field.mandatory,
        sourceStatus: field.source_status,
        dataset: null,
        columns: [],
        inTemplate: false,
        ingestible: false,
        status: 'NO_BRIDGE',
      };
    }

    const isMapped =
      bridge.columns.length > 0 &&
      bridge.columns.every((column) => {
        const map = mappedColumns[bridge.dataset];
        if (map.size === 0) return true;
        return map.has(column);
      });

    const ingestible =
      bridge.columns.length > 0 &&
      bridge.columns.every((column) => PARSER_KNOWN_COLUMNS[bridge.dataset].has(column));

    let status: MoFCoverageStatus = 'COVERED';
    if (!isMapped) status = 'NOT_IN_TEMPLATE';
    else if (!ingestible) status = 'NOT_INGESTIBLE';

    if (field.mandatory) {
      if (status === 'COVERED') coveredMandatory++;
      if (status === 'NOT_IN_TEMPLATE') mandatoryNotInTemplate++;
      if (status === 'NOT_INGESTIBLE') mandatoryNotIngestible++;
    }

    return {
      documentType,
      fieldId: field.field_id,
      fieldName: field.field_name,
      sectionId: field.section_id,
      mandatory: field.mandatory,
      sourceStatus: field.source_status,
      dataset: bridge.dataset,
      columns: bridge.columns,
      inTemplate: isMapped,
      ingestible,
      status,
    };
  });

  return {
    sourceSchema: registry.meta.schema_name,
    sourceVersion: registry.meta.schema_version,
    documentType,
    totalFields: fields.length,
    mandatoryFields: mandatory.length,
    coveredMandatory,
    mandatoryNotInTemplate,
    mandatoryNotIngestible,
    mandatoryNoBridge,
    mandatoryCoveragePct: mandatory.length > 0 ? (coveredMandatory / mandatory.length) * 100 : 100,
    mappableMandatoryFields: Math.max(mandatory.length - mandatoryNoBridge, 0),
    mappableCoveredMandatory: coveredMandatory,
    mappableMandatoryCoveragePct:
      mandatory.length - mandatoryNoBridge > 0
        ? (coveredMandatory / (mandatory.length - mandatoryNoBridge)) * 100
        : 100,
    rows,
  };
}
