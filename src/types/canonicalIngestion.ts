import type { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type { Transformation } from '@/types/fieldMapping';

export type CanonicalDataset = 'buyers' | 'headers' | 'lines';
export type CanonicalValueOrigin = 'direct' | 'transformed' | 'static' | 'generated' | 'missing';

export interface CanonicalFieldMapping {
  id: string;
  sourceColumn: string;
  targetDataset: CanonicalDataset;
  targetField: string;
  targetDataType?: 'string' | 'number' | 'date' | 'boolean';
  transformations: Transformation[];
}

export interface CanonicalKeyRule {
  mode: 'source' | 'generated';
  sourceColumns: string[];
  prefix?: string;
}

export interface CanonicalRelationshipRules {
  buyerKey: CanonicalKeyRule;
  invoiceKey: CanonicalKeyRule;
  lineKey: CanonicalKeyRule;
  lineNumberColumn?: string;
}

export interface CanonicalizationInput {
  sourceFile: string;
  sourceSheet?: string;
  /** Stable tenant/legal-entity/mapping scope included in generated identifiers. */
  keyScope?: string;
  rows: Record<string, string>[];
  mappings: CanonicalFieldMapping[];
  relationships: CanonicalRelationshipRules;
}

export type CanonicalDiagnosticCode =
  | 'missing_key_source'
  | 'invalid_key_rule'
  | 'transformation_failed'
  | 'invalid_number'
  | 'invalid_boolean'
  | 'reserved_relationship_field'
  | 'conflicting_record'
  | 'duplicate_line_id'
  | 'orphan_header'
  | 'orphan_line';

export interface CanonicalizationDiagnostic {
  severity: 'error' | 'warning';
  code: CanonicalDiagnosticCode;
  message: string;
  sourceRow?: number;
  dataset?: CanonicalDataset;
  recordId?: string;
  targetField?: string;
}

export interface CanonicalSourceAttribution {
  dataset: CanonicalDataset;
  recordId: string;
  targetField: string;
  sourceFile: string;
  sourceSheet?: string;
  sourceRow: number;
  sourceColumn?: string;
  sourceValue?: string;
  outputValue?: string;
  origin: CanonicalValueOrigin;
  mappingId?: string;
}

export interface CanonicalizationResult {
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  diagnostics: CanonicalizationDiagnostic[];
  provenance: CanonicalSourceAttribution[];
  canExport: boolean;
  canLoadDiagnosticDataset: boolean;
}
