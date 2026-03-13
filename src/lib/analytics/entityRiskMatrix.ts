import type { ClientHealth } from '@/types/cases';
import type { Exception, InvoiceHeader, Severity } from '@/types/compliance';
import type { EntityScore } from '@/types/customChecks';
import {
  COMPLIANCE_RADAR_DIMENSIONS,
  getComplianceRadarDimensionDefinition,
  getReadinessBand,
  type ComplianceRadarAxisKey,
  type ComplianceRadarDimension,
  type ReadinessBand,
} from '@/lib/analytics/complianceRadar';
import {
  getEntityRiskMatrixDimensionExceptions,
  getEntityRiskMatrixMappingDefinition,
} from '@/lib/analytics/entityRiskMatrixMappings';
import type {
  EntityRiskMatrixCell,
  EntityRiskMatrixFilters,
  EntityRiskMatrixResult,
  EntityRiskMatrixRow,
} from '@/types/entityRiskMatrix';

const LOW_VOLUME_THRESHOLD = 5;

interface SellerAggregate {
  entityId: string;
  entityName?: string;
  score: number;
  totalExceptions: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface EntityRiskMatrixPortfolioBaselines {
  dimensions: ComplianceRadarDimension[];
}

export interface EntityRiskMatrixEntityAggregates {
  sellers: EntityScore[];
  clientHealth: ClientHealth[];
}

export interface EntityRiskMatrixOperationalFacts {
  exceptions: Exception[];
  headers: InvoiceHeader[];
}

export interface EntityRiskMatrixBuildInput {
  portfolio: EntityRiskMatrixPortfolioBaselines;
  entities: EntityRiskMatrixEntityAggregates;
  operational: EntityRiskMatrixOperationalFacts;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function weightedAverage(items: Array<{ value: number; weight: number }>): number {
  let sum = 0;
  let totalWeight = 0;
  items.forEach((item) => {
    if (!Number.isFinite(item.value) || item.weight <= 0) return;
    sum += item.value * item.weight;
    totalWeight += item.weight;
  });
  if (totalWeight === 0) return 50;
  return clamp(sum / totalWeight);
}

function severityWeight(severity: Severity): number {
  if (severity === 'Critical') return 25;
  if (severity === 'High') return 15;
  if (severity === 'Medium') return 8;
  return 3;
}

function buildFallbackSellerAggregates(
  exceptions: Exception[],
  headers: InvoiceHeader[]
): SellerAggregate[] {
  const sellerMap = new Map<
    string,
    {
      entityName?: string;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
    }
  >();

  headers.forEach((header) => {
    if (!sellerMap.has(header.seller_trn)) {
      sellerMap.set(header.seller_trn, {
        entityName: header.seller_name || undefined,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });
    }
  });

  exceptions.forEach((exception) => {
    if (!exception.sellerTrn) return;
    if (!sellerMap.has(exception.sellerTrn)) {
      sellerMap.set(exception.sellerTrn, {
        entityName: undefined,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });
    }
    const aggregate = sellerMap.get(exception.sellerTrn);
    if (!aggregate) return;
    if (exception.severity === 'Critical') aggregate.criticalCount += 1;
    else if (exception.severity === 'High') aggregate.highCount += 1;
    else if (exception.severity === 'Medium') aggregate.mediumCount += 1;
    else aggregate.lowCount += 1;
  });

  return Array.from(sellerMap.entries()).map(([entityId, aggregate]) => {
    const totalExceptions =
      aggregate.criticalCount + aggregate.highCount + aggregate.mediumCount + aggregate.lowCount;
    const weightedPenalty =
      aggregate.criticalCount * 25 +
      aggregate.highCount * 15 +
      aggregate.mediumCount * 8 +
      aggregate.lowCount * 3;
    return {
      entityId,
      entityName: aggregate.entityName,
      score: clamp(100 - weightedPenalty),
      totalExceptions,
      criticalCount: aggregate.criticalCount,
      highCount: aggregate.highCount,
      mediumCount: aggregate.mediumCount,
      lowCount: aggregate.lowCount,
    };
  });
}

function toSellerAggregates(
  sellers: EntityScore[],
  exceptions: Exception[],
  headers: InvoiceHeader[]
): SellerAggregate[] {
  const sellerScores = sellers.filter((seller) => seller.entity_type === 'seller');
  if (sellerScores.length > 0) {
    return sellerScores.map((seller) => ({
      entityId: seller.entity_id,
      entityName: seller.entity_name,
      score: seller.score,
      totalExceptions: seller.total_exceptions,
      criticalCount: seller.critical_count,
      highCount: seller.high_count,
      mediumCount: seller.medium_count,
      lowCount: seller.low_count,
    }));
  }
  return buildFallbackSellerAggregates(exceptions, headers);
}

function buildHeadersBySeller(headers: InvoiceHeader[]): Map<string, InvoiceHeader[]> {
  const map = new Map<string, InvoiceHeader[]>();
  headers.forEach((header) => {
    const existing = map.get(header.seller_trn) || [];
    existing.push(header);
    map.set(header.seller_trn, existing);
  });
  return map;
}

function buildExceptionsBySeller(exceptions: Exception[]): Map<string, Exception[]> {
  const map = new Map<string, Exception[]>();
  exceptions.forEach((exception) => {
    if (!exception.sellerTrn) return;
    const existing = map.get(exception.sellerTrn) || [];
    existing.push(exception);
    map.set(exception.sellerTrn, existing);
  });
  return map;
}

function buildClientHealthBySeller(clientHealth: ClientHealth[]): Map<string, ClientHealth> {
  return new Map(clientHealth.map((health) => [health.seller_trn, health]));
}

function scoreFromExceptions(exceptions: Exception[], invoiceCount: number): number {
  if (exceptions.length === 0) return 100;
  const weightedPenalty = exceptions.reduce((sum, exception) => {
    return sum + severityWeight(exception.severity);
  }, 0);
  const denominator = Math.max(invoiceCount, 1);
  return clamp(100 - weightedPenalty / denominator);
}

function getBaselineScore(
  baselines: Map<ComplianceRadarAxisKey, ComplianceRadarDimension>,
  key: ComplianceRadarAxisKey
): number {
  return baselines.get(key)?.score ?? 50;
}

function getSampleSizeWarning(invoiceCount: number): boolean {
  return invoiceCount <= 0 || invoiceCount < LOW_VOLUME_THRESHOLD;
}

function withSampleSizeStabilizer(
  items: Array<{ value: number; weight: number }>,
  sampleSizeWarning: boolean
): Array<{ value: number; weight: number }> {
  if (!sampleSizeWarning) return items;
  return items.map((item, index) => {
    if (index === 0) return { ...item, weight: item.weight + 0.15 };
    if (index === 1) return { ...item, weight: Math.max(0.05, item.weight - 0.1) };
    return item;
  });
}

function buildDimensionScore(
  dimension: ComplianceRadarAxisKey,
  baselineScore: number,
  aggregate: SellerAggregate,
  invoiceCount: number,
  dimensionExceptions: Exception[],
  clientHealthScore: number | null,
  sampleSizeWarning: boolean
): { score: number; isApproximation: boolean } {
  const dimensionSignalScore = scoreFromExceptions(dimensionExceptions, invoiceCount);
  const criticalShareInverse =
    aggregate.totalExceptions > 0
      ? clamp(100 - (aggregate.criticalCount / aggregate.totalExceptions) * 100)
      : 100;
  const exceptionLoadInverse =
    invoiceCount > 0
      ? clamp(100 - (aggregate.totalExceptions / invoiceCount) * 100)
      : aggregate.totalExceptions > 0
        ? 0
        : 100;
  const sellerHealthScore = weightedAverage([
    { value: criticalShareInverse, weight: 0.45 },
    { value: exceptionLoadInverse, weight: 0.35 },
    { value: aggregate.score, weight: 0.2 },
  ]);

  if (dimension === 'mandatory_coverage') {
    return {
      score: weightedAverage(
        withSampleSizeStabilizer(
          [
            { value: baselineScore, weight: 0.55 },
            { value: dimensionSignalScore, weight: 0.3 },
            { value: aggregate.score, weight: 0.15 },
          ],
          sampleSizeWarning
        )
      ),
      isApproximation: true,
    };
  }

  if (dimension === 'pint_structure_readiness') {
    return {
      score: weightedAverage(
        withSampleSizeStabilizer(
          [
            { value: baselineScore, weight: 0.55 },
            { value: dimensionSignalScore, weight: 0.25 },
            { value: aggregate.score, weight: 0.2 },
          ],
          sampleSizeWarning
        )
      ),
      isApproximation: true,
    };
  }

  if (dimension === 'tax_logic_integrity') {
    return {
      score: weightedAverage(
        withSampleSizeStabilizer(
          [
            { value: aggregate.score, weight: 0.45 },
            { value: dimensionSignalScore, weight: 0.4 },
            { value: criticalShareInverse, weight: 0.15 },
          ],
          sampleSizeWarning
        )
      ),
      isApproximation: false,
    };
  }

  if (dimension === 'codelist_conformance') {
    return {
      score: weightedAverage(
        withSampleSizeStabilizer(
          [
            { value: baselineScore, weight: 0.55 },
            { value: dimensionSignalScore, weight: 0.3 },
            { value: aggregate.score, weight: 0.15 },
          ],
          sampleSizeWarning
        )
      ),
      isApproximation: true,
    };
  }

  if (dimension === 'master_data_quality') {
    const referenceHealthScore = clientHealthScore ?? aggregate.score;
    return {
      score: weightedAverage(
        withSampleSizeStabilizer(
          [
            { value: referenceHealthScore, weight: 0.5 },
            { value: dimensionSignalScore, weight: 0.35 },
            { value: criticalShareInverse, weight: 0.15 },
          ],
          sampleSizeWarning
        )
      ),
      isApproximation: clientHealthScore === null,
    };
  }

  return {
    score: weightedAverage(
      withSampleSizeStabilizer(
        [
          { value: sellerHealthScore, weight: 0.7 },
          { value: aggregate.score, weight: 0.3 },
        ],
        sampleSizeWarning
      )
    ),
    isApproximation: false,
  };
}

function buildCellExplanation(
  dimension: ComplianceRadarAxisKey,
  isApproximation: boolean,
  sampleSizeWarning: boolean
): string {
  const definition = getComplianceRadarDimensionDefinition(dimension);
  const mapping = getEntityRiskMatrixMappingDefinition(dimension);
  const qualifiers: string[] = [];
  if (isApproximation) qualifiers.push('Estimated from related seller-level signals.');
  if (sampleSizeWarning) qualifiers.push('Low invoice volume reduces confidence.');
  return `${definition.explanation} ${mapping.description}${qualifiers.length > 0 ? ` ${qualifiers.join(' ')}` : ''}`.trim();
}

export function buildEntityRiskMatrixResult(input: EntityRiskMatrixBuildInput): EntityRiskMatrixResult {
  const baselines = new Map(
    input.portfolio.dimensions.map((dimension) => [dimension.key, dimension] as const)
  );
  const sellerAggregates = toSellerAggregates(
    input.entities.sellers,
    input.operational.exceptions,
    input.operational.headers
  );
  const headersBySeller = buildHeadersBySeller(input.operational.headers);
  const exceptionsBySeller = buildExceptionsBySeller(input.operational.exceptions);
  const healthBySeller = buildClientHealthBySeller(input.entities.clientHealth);

  const rows: EntityRiskMatrixRow[] = sellerAggregates.map((aggregate) => {
    const headers = headersBySeller.get(aggregate.entityId) || [];
    const sellerExceptions = exceptionsBySeller.get(aggregate.entityId) || [];
    const clientHealth = healthBySeller.get(aggregate.entityId);
    const invoiceCount =
      headers.length > 0 ? headers.length : clientHealth?.total_invoices || 0;
    const sampleSizeWarning = getSampleSizeWarning(invoiceCount);

    const cells: EntityRiskMatrixCell[] = COMPLIANCE_RADAR_DIMENSIONS.map((dimensionDefinition) => {
      const baselineScore = getBaselineScore(baselines, dimensionDefinition.key);
      const dimensionExceptions = getEntityRiskMatrixDimensionExceptions(
        sellerExceptions,
        dimensionDefinition.key
      );
      const matchedCriticalCount = dimensionExceptions.filter(
        (exception) => exception.severity === 'Critical'
      ).length;
      const matchedHighCount = dimensionExceptions.filter(
        (exception) => exception.severity === 'High'
      ).length;
      const matchedMediumCount = dimensionExceptions.filter(
        (exception) => exception.severity === 'Medium'
      ).length;
      const matchedLowCount = dimensionExceptions.filter(
        (exception) => exception.severity === 'Low'
      ).length;
      const scoring = buildDimensionScore(
        dimensionDefinition.key,
        baselineScore,
        aggregate,
        invoiceCount,
        dimensionExceptions,
        clientHealth?.score ?? null,
        sampleSizeWarning
      );
      const mapping = getEntityRiskMatrixMappingDefinition(dimensionDefinition.key);

      return {
        entityId: aggregate.entityId,
        dimension: dimensionDefinition.key,
        score: scoring.score,
        band: getReadinessBand(scoring.score),
        invoiceCount,
        exceptionCount: dimensionExceptions.length,
        criticalCount: matchedCriticalCount,
        highCount: matchedHighCount,
        mediumCount: matchedMediumCount,
        lowCount: matchedLowCount,
        explanation: buildCellExplanation(
          dimensionDefinition.key,
          scoring.isApproximation,
          sampleSizeWarning
        ),
        isApproximation: scoring.isApproximation,
        sampleSizeWarning,
        drillDownMode: mapping.drillDownMode,
      };
    });

    const averageScore = weightedAverage(cells.map((cell) => ({ value: cell.score, weight: 1 })));
    const lowestScore = Math.min(...cells.map((cell) => cell.score));
    const overallBand = getReadinessBand(averageScore);

    return {
      entityId: aggregate.entityId,
      entityName: aggregate.entityName || clientHealth?.client_name || aggregate.entityId,
      entityType: 'seller',
      invoiceCount,
      totalExceptions: aggregate.totalExceptions,
      criticalCount: aggregate.criticalCount,
      averageScore,
      lowestScore,
      overallBand,
      hasElevatedRisk: cells.some(
        (cell) => cell.band === 'critical' || cell.band === 'exposed'
      ),
      sampleSizeWarning,
      cells,
    };
  });

  const approximationNotes = [
    'Seller-level Mandatory Field Coverage, PINT Structure Readiness, and Code List Conformance are anchored to portfolio baselines and adjusted by seller-specific exception signals.',
    'Master Data Quality falls back to seller aggregate quality when direct client health is unavailable.',
    'Low invoice-volume sellers are stabilized toward portfolio baselines and marked with a subtle confidence warning.',
  ];

  return {
    dimensions: COMPLIANCE_RADAR_DIMENSIONS.map((dimension) => {
      const mapping = getEntityRiskMatrixMappingDefinition(dimension.key);
      return {
        key: dimension.key,
        label: dimension.label,
        description: `${dimension.explanation} ${mapping.description}`,
      };
    }),
    rows,
    approximationNotes,
  };
}

export function applyEntityRiskMatrixFilters(
  rows: EntityRiskMatrixRow[],
  filters: EntityRiskMatrixFilters
): EntityRiskMatrixRow[] {
  const search = filters.search.trim().toLowerCase();
  const sortedRows = rows
    .filter((row) => {
      if (!search) return true;
      return (
        row.entityName.toLowerCase().includes(search) ||
        row.entityId.toLowerCase().includes(search)
      );
    })
    .filter((row) => (filters.elevatedRiskOnly ? row.hasElevatedRisk : true))
    .sort((left, right) => {
      if (filters.sortBy === 'average_score') return left.averageScore - right.averageScore;
      if (filters.sortBy === 'exception_count')
        return right.totalExceptions - left.totalExceptions || left.lowestScore - right.lowestScore;
      return left.lowestScore - right.lowestScore || left.averageScore - right.averageScore;
    });

  if (filters.rowLimit <= 0) return sortedRows;
  return sortedRows.slice(0, filters.rowLimit);
}

export function getReadinessBandLabel(band: ReadinessBand): string {
  if (band === 'controlled') return 'Controlled';
  if (band === 'watch') return 'Watch';
  if (band === 'exposed') return 'Exposed';
  return 'Critical';
}
