import {
  type DatasetType,
  type FieldMapping,
  type PintAEField,
  PINT_AE_UC1_FIELDS,
  getPintFieldById,
  normalizeFieldMappings,
} from '@/types/fieldMapping';
import { PARSER_KNOWN_COLUMNS, getMandatoryColumnsForDataset } from '@/lib/registry/drRegistry';

type PhysicalDataset = 'buyers' | 'headers' | 'lines';

const DATASET_TO_PHYSICAL: Record<Exclude<DatasetType, 'combined'>, PhysicalDataset> = {
  header: 'headers',
  lines: 'lines',
  parties: 'buyers',
};

function getPhysicalDatasets(datasetType: DatasetType): PhysicalDataset[] {
  if (datasetType === 'combined') {
    return ['headers', 'lines'];
  }
  return [DATASET_TO_PHYSICAL[datasetType]];
}

const DATASET_TYPE_LABELS: Record<DatasetType, string> = {
  header: 'Invoice Headers',
  lines: 'Invoice Lines',
  parties: 'Party Data',
  combined: 'Combined Export',
};

function isFieldAvailableInPhysicalDataset(field: PintAEField, dataset: PhysicalDataset): boolean {
  return PARSER_KNOWN_COLUMNS[dataset].has(field.id);
}

export function getDatasetTargetFields(datasetType: DatasetType): PintAEField[] {
  const physicalDatasets = getPhysicalDatasets(datasetType);
  return PINT_AE_UC1_FIELDS.filter((field) =>
    physicalDatasets.some((dataset) => isFieldAvailableInPhysicalDataset(field, dataset))
  );
}

export function getDatasetMandatoryFieldIds(datasetType: DatasetType): Set<string> {
  const physicalDatasets = getPhysicalDatasets(datasetType);
  const mandatory = new Set<string>();

  for (const dataset of physicalDatasets) {
    for (const column of getMandatoryColumnsForDataset(dataset)) {
      const field = getPintFieldById(column);
      if (field) mandatory.add(field.id);
    }
  }

  return mandatory;
}

export function getDatasetConditionalFieldIds(datasetType: DatasetType): Set<string> {
  const targetIds = new Set(getDatasetTargetFields(datasetType).map((field) => field.id));
  const mandatoryIds = getDatasetMandatoryFieldIds(datasetType);
  for (const mandatoryId of mandatoryIds) {
    targetIds.delete(mandatoryId);
  }
  return targetIds;
}

export function getDatasetAvailableTargetFields(datasetType: DatasetType, mappings: FieldMapping[]): PintAEField[] {
  const mappedFieldIds = new Set(normalizeFieldMappings(mappings).map((mapping) => mapping.targetField.id));
  return getDatasetTargetFields(datasetType).filter((field) => !mappedFieldIds.has(field.id));
}

export function getExactCanonicalField(columnName: string, datasetType: DatasetType): PintAEField | undefined {
  const normalizedColumn = columnName.trim().toLowerCase();
  return getDatasetTargetFields(datasetType).find((field) => field.id.toLowerCase() === normalizedColumn);
}

export function getDatasetTypeLabel(datasetType: DatasetType): string {
  return DATASET_TYPE_LABELS[datasetType];
}

export function detectLikelyDatasetType(columns: string[]): DatasetType | null {
  if (columns.length === 0) return null;

  const normalizedColumns = columns.map((column) => column.trim().toLowerCase());
  const scoreByDataset: Array<{ datasetType: DatasetType; score: number }> = [
    {
      datasetType: 'parties',
      score: normalizedColumns.filter((column) => PARSER_KNOWN_COLUMNS.buyers.has(column)).length,
    },
    {
      datasetType: 'header',
      score: normalizedColumns.filter((column) => PARSER_KNOWN_COLUMNS.headers.has(column)).length,
    },
    {
      datasetType: 'lines',
      score: normalizedColumns.filter((column) => PARSER_KNOWN_COLUMNS.lines.has(column)).length,
    },
  ];

  const headerScore = scoreByDataset.find((entry) => entry.datasetType === 'header')?.score ?? 0;
  const lineScore = scoreByDataset.find((entry) => entry.datasetType === 'lines')?.score ?? 0;

  if (headerScore >= 6 && lineScore >= 4) {
    return 'combined';
  }

  const bestMatch = scoreByDataset.sort((a, b) => b.score - a.score)[0];
  if (!bestMatch || bestMatch.score === 0) return null;

  return bestMatch.datasetType;
}
