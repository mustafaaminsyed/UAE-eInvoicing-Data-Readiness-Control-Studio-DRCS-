import type { CanonicalDataset, CanonicalFieldMapping, CanonicalizationResult } from '@/types/canonicalIngestion';
import type { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type { FieldMapping } from '@/types/fieldMapping';
import type { Direction } from '@/types/direction';
import {
  getTemplateHeaderColumns,
  resolveTemplateColumnCanonicalId,
  type SampleDataset,
} from '@/lib/sampleData';

const RELATIONSHIP_FIELDS = new Set(['buyer_id', 'invoice_id', 'line_id', 'line_number']);

function resolveTargetDataset(fieldId: string, direction: Direction): CanonicalDataset | null {
  // The compatibility header also carries this name, but the governed PINT mapping is line-level IBT-151.
  if (fieldId === 'tax_category_code') return 'lines';
  for (const dataset of ['buyers', 'headers', 'lines'] as const) {
    const canonicalFields = getTemplateHeaderColumns(dataset, direction).map((column) =>
      resolveTemplateColumnCanonicalId(column, direction),
    );
    if (canonicalFields.includes(fieldId)) return dataset;
  }
  return null;
}

export function toCanonicalFieldMappings(
  mappings: FieldMapping[],
  direction: Direction,
): CanonicalFieldMapping[] {
  return mappings.flatMap((mapping) => {
    if (!mapping.isConfirmed || RELATIONSHIP_FIELDS.has(mapping.targetField.id)) return [];
    const targetDataset = resolveTargetDataset(mapping.targetField.id, direction);
    if (!targetDataset) return [];
    return [{
      id: mapping.id,
      sourceColumn: mapping.erpColumn,
      targetDataset,
      targetField: mapping.targetField.id,
      targetDataType: mapping.targetField.dataType,
      transformations: mapping.transformations,
    }];
  });
}

function escapeCsv(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function datasetRows(
  result: CanonicalizationResult,
  dataset: SampleDataset,
): Array<Buyer | InvoiceHeader | InvoiceLine> {
  return result[dataset];
}

export function buildCanonicalCsv(
  result: CanonicalizationResult,
  dataset: SampleDataset,
  direction: Direction,
): string {
  const columns = getTemplateHeaderColumns(dataset, direction);
  const rows = datasetRows(result, dataset);
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => {
      const canonicalField = resolveTemplateColumnCanonicalId(column, direction);
      return escapeCsv((row as unknown as Record<string, unknown>)[canonicalField]);
    }).join(',')),
  ].join('\n') + '\n';
}
