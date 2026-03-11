import { PARSER_KNOWN_COLUMNS } from '@/lib/registry/drRegistry';
import { getMoFFields, getMoFMandatoryFields, getMoFSpecRegistry, MoFDocumentType } from '@/lib/registry/mofSpecRegistry';
import { getMoFCrosswalkRow } from '@/lib/registry/mofCrosswalkRegistry';

type DatasetFile = 'buyers' | 'headers' | 'lines';
type MoFCoverageStatus = 'COVERED' | 'NOT_IN_TEMPLATE' | 'NOT_INGESTIBLE' | 'NO_BRIDGE';

interface MoFBridge {
  datasets: DatasetFile[];
  primaryDataset: DatasetFile | null;
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

function getBridgeForField(documentType: MoFDocumentType, fieldId: number): MoFBridge | null {
  const row = getMoFCrosswalkRow(documentType, fieldId);
  if (!row || row.status === 'missing') return null;

  return {
    datasets: row.datasets,
    primaryDataset: row.primaryDataset,
    columns: Array.from(new Set(row.sourceColumns)),
  };
}

function toSet(values?: string[]): Set<string> {
  return new Set((values || []).map((v) => v.trim()).filter(Boolean));
}

function resolveCandidateDatasets(bridge: MoFBridge, column: string): DatasetFile[] {
  const candidates = bridge.datasets.filter((dataset) => PARSER_KNOWN_COLUMNS[dataset].has(column));
  if (candidates.length > 0) return candidates;
  return bridge.datasets;
}

function isMappedColumn(
  bridge: MoFBridge,
  column: string,
  mappedColumns: Record<DatasetFile, Set<string>>
): boolean {
  const candidates = resolveCandidateDatasets(bridge, column);
  if (candidates.length === 0) return false;
  return candidates.some((dataset) => {
    const map = mappedColumns[dataset];
    if (map.size === 0) return true;
    return map.has(column);
  });
}

function isIngestibleColumn(bridge: MoFBridge, column: string): boolean {
  const candidates = resolveCandidateDatasets(bridge, column);
  if (candidates.length === 0) return false;
  return candidates.some((dataset) => PARSER_KNOWN_COLUMNS[dataset].has(column));
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

    const isMapped = bridge.columns.length > 0 && bridge.columns.every((column) => isMappedColumn(bridge, column, mappedColumns));

    const ingestible = bridge.columns.length > 0 && bridge.columns.every((column) => isIngestibleColumn(bridge, column));

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
      dataset: bridge.primaryDataset,
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
