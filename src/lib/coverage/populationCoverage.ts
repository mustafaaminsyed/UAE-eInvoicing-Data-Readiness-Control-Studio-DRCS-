// =============================================================================
// Population Coverage — Deterministic column population analysis
// Computes per-column population rates from uploaded CSV data
// =============================================================================

export interface ColumnPopulation {
  column: string;
  totalRows: number;
  populatedCount: number;
  populationPct: number;
}

export interface DatasetPopulation {
  dataset: 'buyers' | 'headers' | 'lines';
  columns: ColumnPopulation[];
}

function isPopulated(value: string | undefined | null, dataType?: string): boolean {
  if (value === undefined || value === null) return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  // For numbers, check parsability
  if (dataType?.toLowerCase().includes('number') || dataType?.toLowerCase().includes('decimal')) {
    return !isNaN(Number(trimmed));
  }
  // For dates, basic check
  if (dataType?.toLowerCase().includes('date')) {
    return /^\d{4}-\d{2}-\d{2}/.test(trimmed);
  }
  return true;
}

export function computeColumnPopulation(
  rows: Record<string, string>[],
  columns: string[],
): ColumnPopulation[] {
  if (rows.length === 0) return columns.map(c => ({ column: c, totalRows: 0, populatedCount: 0, populationPct: 100 }));
  
  return columns.map(column => {
    const populatedCount = rows.filter(row => isPopulated(row[column])).length;
    return {
      column,
      totalRows: rows.length,
      populatedCount,
      populationPct: (populatedCount / rows.length) * 100,
    };
  });
}

export function computeAllDatasetPopulations(
  parsedData: {
    buyers: Record<string, string>[] | null;
    headers: Record<string, string>[] | null;
    lines: Record<string, string>[] | null;
  }
): DatasetPopulation[] {
  const result: DatasetPopulation[] = [];
  
  for (const [key, rows] of Object.entries(parsedData)) {
    if (rows && rows.length > 0) {
      const columns = Object.keys(rows[0]);
      result.push({
        dataset: key as 'buyers' | 'headers' | 'lines',
        columns: computeColumnPopulation(rows, columns),
      });
    }
  }
  
  return result;
}

/** Get population % for a specific column in a dataset */
export function getColumnPopulationPct(
  populations: DatasetPopulation[],
  dataset: string,
  column: string
): number | null {
  const ds = populations.find(p => p.dataset === dataset);
  if (!ds) return null;
  const col = ds.columns.find(c => c.column === column);
  return col ? col.populationPct : null;
}
