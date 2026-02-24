// =============================================================================
// DR Registry — Maps UAE PINT-AE DR IDs → internal columns → template files
// Driven by templates_manifest.json + spec registry
// =============================================================================

import { getRegistryFields, isMandatoryField, SpecRegistryField } from '@/lib/registry/specRegistry';

export interface DRRegistryEntry {
  dr_id: string;
  business_term: string;
  dataset_file: 'buyers' | 'headers' | 'lines' | null;
  internal_column_names: string[];
  mandatory_for_default_use_case: boolean;
  data_type: string;
  format_pattern: string;
  code_list_reference: string | null;
  category: string;
  vat_law_status: string;
  data_responsibility: string;
  pint_ae_reference: string; // UBL XML path or PINT-AE reference
  asp_derived: boolean;
}

// Map from DR ID to internal column names and dataset file
// This is the bridge between the PINT-AE spec and the CSV templates
const DR_TO_COLUMN_MAP: Record<string, { dataset: 'buyers' | 'headers' | 'lines'; columns: string[] }> = {
  // Buyer fields
  'IBT-044': { dataset: 'buyers', columns: ['buyer_name'] },
  'IBT-048': { dataset: 'buyers', columns: ['buyer_trn'] },
  'IBT-049': { dataset: 'buyers', columns: ['buyer_electronic_address'] },
  'IBT-050': { dataset: 'buyers', columns: ['buyer_address'] },
  'IBT-052': { dataset: 'buyers', columns: ['buyer_city'] },
  'IBT-054': { dataset: 'buyers', columns: ['buyer_subdivision'] },
  'IBT-055': { dataset: 'buyers', columns: ['buyer_country'] },

  // Header fields
  'IBT-001': { dataset: 'headers', columns: ['invoice_number'] },
  'IBT-002': { dataset: 'headers', columns: ['issue_date'] },
  'IBT-003': { dataset: 'headers', columns: ['invoice_type'] },
  'IBT-005': { dataset: 'headers', columns: ['currency'] },
  'IBT-007': { dataset: 'headers', columns: ['fx_rate'] },
  'IBT-009': { dataset: 'headers', columns: ['payment_due_date'] },
  'IBT-027': { dataset: 'headers', columns: ['seller_name'] },
  'IBT-030': { dataset: 'headers', columns: ['seller_legal_reg_id'] },
  'IBT-031': { dataset: 'headers', columns: ['seller_trn'] },
  'IBT-034': { dataset: 'headers', columns: ['seller_electronic_address'] },
  'IBT-035': { dataset: 'headers', columns: ['seller_address'] },
  'IBT-037': { dataset: 'headers', columns: ['seller_city'] },
  'IBT-039': { dataset: 'headers', columns: ['seller_subdivision'] },
  'IBT-040': { dataset: 'headers', columns: ['seller_country'] },
  'IBT-081': { dataset: 'headers', columns: ['payment_means_code'] },
  'IBT-109': { dataset: 'headers', columns: ['total_excl_vat'] },
  'IBT-110': { dataset: 'headers', columns: ['vat_total'] },
  'IBT-112': { dataset: 'headers', columns: ['total_incl_vat'] },
  'IBT-115': { dataset: 'headers', columns: ['amount_due'] },
  'IBT-118': { dataset: 'headers', columns: ['tax_category_code'] },
  'IBT-119': { dataset: 'headers', columns: ['tax_category_rate'] },
  'BTUAE-02': { dataset: 'headers', columns: ['transaction_type_code'] },
  'BTUAE-15': { dataset: 'headers', columns: ['seller_legal_reg_id_type'] },

  // Line fields
  'IBT-126': { dataset: 'lines', columns: ['line_id', 'line_number'] },
  'IBT-129': { dataset: 'lines', columns: ['quantity'] },
  'IBT-130': { dataset: 'lines', columns: ['unit_of_measure'] },
  'IBT-131': { dataset: 'lines', columns: ['line_total_excl_vat'] },
  'IBT-146': { dataset: 'lines', columns: ['unit_price'] },
  'IBT-148': { dataset: 'lines', columns: ['unit_price'] }, // gross price maps to same input
  'IBT-151': { dataset: 'lines', columns: ['tax_category_code'] },
  'IBT-152': { dataset: 'lines', columns: ['vat_rate'] },
  'IBT-153': { dataset: 'lines', columns: ['description'] },
  'IBT-154': { dataset: 'lines', columns: ['item_name'] },
  'BTUAE-08': { dataset: 'lines', columns: ['vat_amount'] },

  // Derived/calculated fields (no user input column — derived from inputs)
  'IBT-106': { dataset: 'headers', columns: ['total_excl_vat'] },
  'IBT-116': { dataset: 'headers', columns: ['total_excl_vat'] },
  'IBT-117': { dataset: 'headers', columns: ['vat_total'] },

  // ASP-owned fields — not in templates
  'IBT-023': { dataset: 'headers', columns: [] },
  'IBT-024': { dataset: 'headers', columns: [] },
  'IBT-031-1': { dataset: 'headers', columns: [] },
  'IBT-034-1': { dataset: 'headers', columns: [] },
  'IBT-048-1': { dataset: 'buyers', columns: [] },
  'IBT-049-1': { dataset: 'buyers', columns: [] },
  'IBT-149': { dataset: 'lines', columns: [] },
};

function extractCodeListRef(field: SpecRegistryField): string | null {
  const fp = field.format_pattern.toLowerCase();
  if (fp.includes('iso 4217')) return 'ISO 4217';
  if (fp.includes('iso 3166')) return 'ISO 3166-1';
  if (fp.includes('iso 8601')) return 'ISO 8601';
  if (fp.includes('un/cefact 1001') || fp.includes('untdid 1001')) return 'UN/CEFACT 1001';
  if (fp.includes('untdid 4461') || fp.includes('uncl4461')) return 'UNTDID 4461';
  if (fp.includes('un/ece') || fp.includes('unece')) return 'UN/ECE Rec 20';
  if (fp.includes('cef eas')) return 'CEF EAS';
  if (fp.includes('s, z, e, rc')) return 'PINT-AE Tax Category';
  if (fp.includes('tl, eid, pas, cd')) return 'BTUAE-15 ID Types';
  if (fp.includes('auh, dxb') || fp.includes('ae-az')) return 'UAE Emirates';
  return null;
}

export function buildDRRegistry(): DRRegistryEntry[] {
  const fields = getRegistryFields();
  const aspDerivedIds = new Set(['IBT-023', 'IBT-024', 'IBT-031-1', 'IBT-034-1', 'IBT-048-1', 'IBT-049-1', 'IBT-149']);
  return fields.map(field => {
    const mapping = DR_TO_COLUMN_MAP[field.dr_id];
    return {
      dr_id: field.dr_id,
      business_term: field.business_term,
      dataset_file: mapping?.dataset ?? null,
      internal_column_names: mapping?.columns ?? [],
      mandatory_for_default_use_case: isMandatoryField(field),
      data_type: field.data_type,
      format_pattern: field.format_pattern,
      code_list_reference: extractCodeListRef(field),
      category: field.category,
      vat_law_status: field.vat_law_status,
      data_responsibility: field.data_responsibility,
      pint_ae_reference: field.ubl_xml_path || '',
      asp_derived: aspDerivedIds.has(field.dr_id) || field.data_responsibility.includes('ASP'),
    };
  });
}

// ── Ingestible columns — columns the parser/types actually handle ────
// These are the columns that csvParser.ts + types/compliance.ts support.
// Any DR column NOT in this set is "not ingestible" (template-only / future).
export const PARSER_KNOWN_COLUMNS: Record<'buyers' | 'headers' | 'lines', Set<string>> = {
  buyers: new Set([
    'buyer_id', 'buyer_name', 'buyer_trn', 'buyer_address', 'buyer_country',
    'buyer_city', 'buyer_postcode', 'buyer_subdivision', 'buyer_electronic_address',
  ]),
  headers: new Set([
    'invoice_id', 'invoice_number', 'issue_date', 'seller_trn', 'buyer_id',
    'currency', 'invoice_type', 'total_excl_vat', 'vat_total', 'total_incl_vat',
    'seller_name', 'seller_address', 'seller_city', 'seller_country',
    'seller_subdivision', 'seller_electronic_address', 'seller_legal_reg_id',
    'seller_legal_reg_id_type', 'transaction_type_code', 'payment_due_date',
    'payment_means_code', 'fx_rate', 'amount_due', 'tax_category_code',
    'tax_category_rate', 'note', 'supply_date', 'tax_currency',
    'document_level_allowance_total', 'document_level_charge_total',
    'rounding_amount', 'spec_id', 'business_process',
  ]),
  lines: new Set([
    'line_id', 'invoice_id', 'line_number', 'description', 'quantity',
    'unit_price', 'line_discount', 'line_total_excl_vat', 'vat_rate', 'vat_amount',
    'unit_of_measure', 'tax_category_code', 'item_name',
    'line_allowance_amount', 'line_charge_amount',
  ]),
};

/**
 * Returns the mandatory UC1 column names per dataset, derived from the DR registry.
 * Only includes columns that are actually in the parser (ingestible).
 */
export function getMandatoryColumnsForDataset(dataset: 'buyers' | 'headers' | 'lines'): string[] {
  const registry = getDRRegistry();
  const parserCols = PARSER_KNOWN_COLUMNS[dataset];
  const cols = new Set<string>();
  for (const entry of registry) {
    if (entry.dataset_file === dataset && entry.mandatory_for_default_use_case) {
      for (const col of entry.internal_column_names) {
        if (parserCols.has(col)) cols.add(col);
      }
    }
  }
  // Always include join keys as mandatory
  if (dataset === 'buyers') cols.add('buyer_id');
  if (dataset === 'headers') { cols.add('invoice_id'); cols.add('buyer_id'); }
  if (dataset === 'lines') { cols.add('line_id'); cols.add('invoice_id'); }
  return Array.from(cols);
}

/**
 * Check if a DR's columns are ingestible (known to the parser).
 * Returns true if ALL of its columns are in PARSER_KNOWN_COLUMNS for its dataset.
 */
export function isDRIngestible(entry: DRRegistryEntry): boolean {
  if (!entry.dataset_file || entry.internal_column_names.length === 0) return false;
  const known = PARSER_KNOWN_COLUMNS[entry.dataset_file];
  return entry.internal_column_names.every(col => known.has(col));
}

// Singleton
let _registry: DRRegistryEntry[] | null = null;
export function getDRRegistry(): DRRegistryEntry[] {
  if (!_registry) _registry = buildDRRegistry();
  return _registry;
}

export function getDREntry(drId: string): DRRegistryEntry | undefined {
  return getDRRegistry().find(e => e.dr_id === drId);
}
