import crosswalkArtifact from '../../../docs/reconciliation/uae-mof-authoritative-crosswalk.v0.1.json';
import { MoFDocumentType } from '@/lib/registry/mofSpecRegistry';

export type MoFCrosswalkDocumentType = 'tax' | 'commercial';
export type MoFCrosswalkClassification =
  | 'direct'
  | 'derived'
  | 'generated'
  | 'aggregated'
  | 'repeated';
export type MoFCrosswalkStatus = 'covered' | 'partially_covered' | 'missing';

type DatasetFile = 'buyers' | 'headers' | 'lines';

interface RawCrosswalkRow {
  document_type: MoFCrosswalkDocumentType;
  mof_field_id: number;
  mof_business_term: string;
  source_template: string;
  source_column: string;
  internal_field_key: string;
  dr_id: string;
  classification: MoFCrosswalkClassification;
  transformation_rule: string;
  status: MoFCrosswalkStatus;
  notes: string;
}

interface RawCrosswalkArtifact {
  artifact: string;
  version: string;
  generated_at: string;
  denominator_policy: {
    mof_tax_mandatory_fields: number;
    mof_commercial_mandatory_fields: number;
    pint_registry_fields: number;
    ingestion_source_columns: number;
  };
  rows: RawCrosswalkRow[];
}

export interface MoFCrosswalkRow {
  key: string;
  documentType: MoFCrosswalkDocumentType;
  mofFieldId: number;
  mofBusinessTerm: string;
  sourceTemplates: string[];
  sourceColumns: string[];
  internalFieldKeys: string[];
  drIds: string[];
  classification: MoFCrosswalkClassification;
  transformationRule: string;
  status: MoFCrosswalkStatus;
  notes: string;
  datasets: DatasetFile[];
  primaryDataset: DatasetFile | null;
}

export interface MoFCrosswalkDenominatorPolicy {
  mofTaxMandatoryFields: number;
  mofCommercialMandatoryFields: number;
  pintRegistryFields: number;
  ingestionSourceColumns: number;
}

const TEMPLATE_TO_DATASET: Record<string, DatasetFile | undefined> = {
  'buyers_template.csv': 'buyers',
  'invoice_headers_template.csv': 'headers',
  'invoice_lines_template.csv': 'lines',
};

function parsePipeList(value: string): string[] {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCrosswalkDocumentType(documentType: MoFDocumentType): MoFCrosswalkDocumentType {
  return documentType === 'tax_invoice' ? 'tax' : 'commercial';
}

function toMoFDocumentType(documentType: MoFCrosswalkDocumentType): MoFDocumentType {
  return documentType === 'tax' ? 'tax_invoice' : 'commercial_xml';
}

function buildMoFCrosswalkKey(
  documentType: MoFCrosswalkDocumentType,
  mofFieldId: number
): string {
  return `${documentType}:${mofFieldId}`;
}

const artifact = crosswalkArtifact as RawCrosswalkArtifact;

const denominatorPolicy: MoFCrosswalkDenominatorPolicy = {
  mofTaxMandatoryFields: artifact.denominator_policy.mof_tax_mandatory_fields,
  mofCommercialMandatoryFields: artifact.denominator_policy.mof_commercial_mandatory_fields,
  pintRegistryFields: artifact.denominator_policy.pint_registry_fields,
  ingestionSourceColumns: artifact.denominator_policy.ingestion_source_columns,
};

const rows: MoFCrosswalkRow[] = artifact.rows.map((row) => {
  const sourceTemplates = parsePipeList(row.source_template);
  const datasets = sourceTemplates
    .map((templateName) => TEMPLATE_TO_DATASET[templateName])
    .filter((dataset): dataset is DatasetFile => Boolean(dataset));
  return {
    key: buildMoFCrosswalkKey(row.document_type, row.mof_field_id),
    documentType: row.document_type,
    mofFieldId: row.mof_field_id,
    mofBusinessTerm: row.mof_business_term,
    sourceTemplates,
    sourceColumns: parsePipeList(row.source_column),
    internalFieldKeys: parsePipeList(row.internal_field_key),
    drIds: parsePipeList(row.dr_id),
    classification: row.classification,
    transformationRule: row.transformation_rule,
    status: row.status,
    notes: row.notes || '',
    datasets,
    primaryDataset: datasets[0] ?? null,
  };
});

const rowsByKey = new Map<string, MoFCrosswalkRow>();
for (const row of rows) {
  if (rowsByKey.has(row.key)) {
    throw new Error(`Duplicate MoF crosswalk key detected: ${row.key}`);
  }
  rowsByKey.set(row.key, row);
}

export function getMoFCrosswalkArtifactVersion(): string {
  return artifact.version;
}

export function getMoFCrosswalkDenominatorPolicy(): MoFCrosswalkDenominatorPolicy {
  return denominatorPolicy;
}

export function getMoFCrosswalkRows(documentType?: MoFDocumentType): MoFCrosswalkRow[] {
  if (!documentType) return rows;
  const mappedType = toCrosswalkDocumentType(documentType);
  return rows.filter((row) => row.documentType === mappedType);
}

export function getMoFCrosswalkRow(
  documentType: MoFDocumentType,
  mofFieldId: number
): MoFCrosswalkRow | undefined {
  const mappedType = toCrosswalkDocumentType(documentType);
  return rowsByKey.get(buildMoFCrosswalkKey(mappedType, mofFieldId));
}

export function getMoFCrosswalkRowsForFieldId(mofFieldId: number): Record<MoFDocumentType, MoFCrosswalkRow | undefined> {
  return {
    tax_invoice: rowsByKey.get(buildMoFCrosswalkKey('tax', mofFieldId)),
    commercial_xml: rowsByKey.get(buildMoFCrosswalkKey('commercial', mofFieldId)),
  };
}

export function toMoFDocumentTypeFromCrosswalk(
  documentType: MoFCrosswalkDocumentType
): MoFDocumentType {
  return toMoFDocumentType(documentType);
}

