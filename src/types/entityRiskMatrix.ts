import type { ComplianceRadarAxisKey, ReadinessBand } from '@/lib/analytics/complianceRadar';

export type EntityRiskMatrixSort = 'lowest_score' | 'average_score' | 'exception_count';

export type EntityRiskMatrixDrillDownMode = 'precise' | 'contextual';

export interface EntityRiskMatrixDimensionDefinition {
  key: ComplianceRadarAxisKey;
  label: string;
  description: string;
}

export interface EntityRiskMatrixCell {
  entityId: string;
  dimension: ComplianceRadarAxisKey;
  score: number;
  band: ReadinessBand;
  invoiceCount: number;
  exceptionCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  explanation: string;
  isApproximation: boolean;
  sampleSizeWarning: boolean;
  drillDownMode: EntityRiskMatrixDrillDownMode;
}

export interface EntityRiskMatrixRow {
  entityId: string;
  entityName: string;
  entityType: 'seller';
  invoiceCount: number;
  totalExceptions: number;
  criticalCount: number;
  averageScore: number;
  lowestScore: number;
  overallBand: ReadinessBand;
  hasElevatedRisk: boolean;
  sampleSizeWarning: boolean;
  cells: EntityRiskMatrixCell[];
}

export interface EntityRiskMatrixResult {
  dimensions: EntityRiskMatrixDimensionDefinition[];
  rows: EntityRiskMatrixRow[];
  approximationNotes: string[];
}

export interface EntityRiskMatrixFilters {
  search: string;
  sortBy: EntityRiskMatrixSort;
  rowLimit: number;
  elevatedRiskOnly: boolean;
}

export interface EntityRiskMatrixFocus {
  entityId: string;
  entityName: string;
  dimension: ComplianceRadarAxisKey;
  drillDownMode: EntityRiskMatrixDrillDownMode;
}
