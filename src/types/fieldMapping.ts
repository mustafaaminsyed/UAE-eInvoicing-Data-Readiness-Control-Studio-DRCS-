import { Direction } from './direction';

// Field Mapping Types for ERP → PINT-AE transformation

// PINT-AE Target Field Definition
export interface PintAEField {
  id: string;
  name: string;
  description: string;
  ibtReference: string;
  category: 'header' | 'seller' | 'buyer' | 'line' | 'totals' | 'tax';
  isMandatory: boolean;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
  allowedValues?: string[];
}

export type ExecutionReadyFieldId = string;

// Transformation Types
export type TransformationType = 
  | 'none'
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'date_parse'
  | 'static_value'
  | 'lookup'
  | 'combine'
  | 'split'
  | 'regex_extract';

export interface Transformation {
  type: TransformationType;
  config: Record<string, any>;
}

// Field Mapping with transformations
export interface FieldMapping {
  id: string;
  erpColumn: string;
  erpColumnIndex: number;
  targetField: PintAEField;
  confidence: number;
  isConfirmed: boolean;
  transformations: Transformation[];
  sampleValues: string[];
}

// Dataset type for upload
export type DatasetType = 'header' | 'lines' | 'parties' | 'combined';

// Detected column type
export interface DetectedColumn {
  name: string;
  index: number;
  detectedType: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  sampleValues: string[];
  nullCount: number;
  uniqueCount: number;
}

// Mapping Template Metadata
export interface MappingTemplateMetadata {
  templateName: string;
  description?: string;
  clientName?: string;
  tenantId?: string;
  legalEntity?: string;
  sellerTrn?: string;
  erpType?: string;
  documentType: string;
  version: number;
  effectiveDate?: string;
  notes?: string;
  direction?: Direction;
}

// Full Mapping Template
export interface MappingTemplate extends MappingTemplateMetadata {
  id?: string;
  isActive: boolean;
  mappings: FieldMapping[];
  createdAt?: string;
  updatedAt?: string;
}

// Template list item for display
export interface MappingTemplateListItem {
  id: string;
  templateName: string;
  erpType?: string;
  sellerTrn?: string;
  legalEntity?: string;
  documentType: string;
  version: number;
  isActive: boolean;
  updatedAt?: string;
  mappingsCount: number;
}

// Version diff
export interface MappingDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

// ERP Preview Data
export interface ERPPreviewData {
  fileName: string;
  columns: string[];
  detectedColumns: DetectedColumn[];
  rows: Record<string, string>[];
  totalRows: number;
  datasetType: DatasetType;
}

// Mapping Suggestion
export interface MappingSuggestion {
  erpColumn: string;
  erpColumnIndex: number;
  targetField: PintAEField;
  confidence: number;
  reason: string;
  sampleValues: string[];
}

// Coverage Analysis
export interface CoverageAnalysis {
  mappedMandatory: PintAEField[];
  unmappedMandatory: PintAEField[];
  mappedOptional: PintAEField[];
  unmappedOptional: PintAEField[];
  mandatoryCoverage: number;
  totalCoverage: number;
}

// Validation Result
export interface ValidationResult {
  field: string;
  column: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
  sampleIssues?: { row: number; value: string; issue: string }[];
}

// Transformation test result
export interface TransformationTestResult {
  success: boolean;
  originalValue: string;
  transformedValue: string;
  error?: string;
}

// Conditional Field Questionnaire
export interface ConditionalQuestion {
  id: string;
  question: string;
  fieldIds: string[];
  answer?: boolean;
}

// Wizard Step
export type MappingWizardStep = 'upload' | 'mapping' | 'analysis' | 'save';

// PINT-AE UC1 Standard Tax Invoice Fields (aligned with check pack)
export const PINT_AE_UC1_FIELDS: PintAEField[] = [
  // Header Fields
  { id: 'invoice_id', name: 'Invoice ID', description: 'Internal invoice join key for header and line linkage', ibtReference: 'SYS-INV-ID', category: 'header', isMandatory: true, dataType: 'string' },
  { id: 'invoice_number', name: 'Invoice Number', description: 'Unique invoice identifier', ibtReference: 'IBT-001', category: 'header', isMandatory: true, dataType: 'string' },
  { id: 'issue_date', name: 'Issue Date', description: 'Invoice issue date', ibtReference: 'IBT-002', category: 'header', isMandatory: true, dataType: 'date', format: 'YYYY-MM-DD' },
  { id: 'invoice_type', name: 'Invoice Type Code', description: 'Invoice type (380=invoice, 381=credit note)', ibtReference: 'IBT-003', category: 'header', isMandatory: true, dataType: 'string', allowedValues: ['380', '381', '383', '384'] },
  { id: 'currency', name: 'Document Currency', description: 'ISO 4217 currency code', ibtReference: 'IBT-005', category: 'header', isMandatory: true, dataType: 'string', format: '^[A-Z]{3}$' },
  { id: 'tax_currency', name: 'Tax Accounting Currency', description: 'Must be AED for UAE', ibtReference: 'IBT-006', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'fx_rate', name: 'Exchange Rate', description: 'FX rate to AED (required if non-AED)', ibtReference: 'BTUAE-002', category: 'header', isMandatory: false, dataType: 'number' },
  { id: 'payment_due_date', name: 'Payment Due Date', description: 'Payment due date', ibtReference: 'IBT-009', category: 'header', isMandatory: false, dataType: 'date' },
  { id: 'buyer_reference', name: 'Buyer Reference', description: 'Buyer reference/PO number', ibtReference: 'IBT-010', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'spec_id', name: 'Specification Identifier', description: 'PINT-AE specification ID', ibtReference: 'IBT-024', category: 'header', isMandatory: true, dataType: 'string' },
  { id: 'buyer_id', name: 'Buyer ID', description: 'Internal counterparty join key between headers and buyers', ibtReference: 'SYS-BUYER-ID', category: 'header', isMandatory: true, dataType: 'string' },
  { id: 'transaction_type_code', name: 'Transaction Type Code', description: 'UAE transaction type code for invoice scenario signaling', ibtReference: 'BTUAE-02', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'principal_id', name: 'Principal ID', description: 'Principal identifier required for disclosed-agent billing overlays', ibtReference: 'BTAE-14', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'invoicing_period_start_date', name: 'Invoicing Period Start Date', description: 'Start date for summary-invoice invoicing periods', ibtReference: 'IBG-14', category: 'header', isMandatory: false, dataType: 'date', format: 'YYYY-MM-DD' },
  { id: 'invoicing_period_end_date', name: 'Invoicing Period End Date', description: 'End date for summary-invoice invoicing periods', ibtReference: 'IBG-14', category: 'header', isMandatory: false, dataType: 'date', format: 'YYYY-MM-DD' },
  { id: 'deliver_to_address_line_1', name: 'Deliver-To Address Line 1', description: 'Deliver-to street address line 1 for export overlays', ibtReference: 'IBT-075', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'deliver_to_city', name: 'Deliver-To City', description: 'Deliver-to city for export overlays', ibtReference: 'IBT-077', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'deliver_to_country_subdivision', name: 'Deliver-To Country Subdivision', description: 'Deliver-to country subdivision for export overlays', ibtReference: 'IBT-079', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'deliver_to_country_code', name: 'Deliver-To Country Code', description: 'Deliver-to country code for export overlays', ibtReference: 'IBT-080', category: 'header', isMandatory: false, dataType: 'string', format: '^[A-Z]{2}$' },
  { id: 'payment_means_code', name: 'Payment Means Code', description: 'UNCL4461 payment means code', ibtReference: 'IBT-081', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'note', name: 'Invoice Note', description: 'Free-text invoice note', ibtReference: 'IBT-022', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'supply_date', name: 'Supply Date', description: 'Actual supply date when tracked separately from issue date', ibtReference: 'IBT-073', category: 'header', isMandatory: false, dataType: 'date' },
  { id: 'business_process', name: 'Business Process Type', description: 'Fixed or enumerated business process value for the document profile', ibtReference: 'IBT-023', category: 'header', isMandatory: false, dataType: 'string' },
  
  // Seller Fields
  { id: 'seller_name', name: 'Seller Name', description: 'Seller trading name', ibtReference: 'IBT-027', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_legal_reg_id', name: 'Seller Legal Registration ID', description: 'Seller legal registration identifier', ibtReference: 'IBT-030', category: 'seller', isMandatory: false, dataType: 'string' },
  { id: 'seller_trn', name: 'Seller TRN', description: 'UAE Tax Registration Number (15 digits)', ibtReference: 'IBT-031', category: 'seller', isMandatory: true, dataType: 'string', format: '^\\d{15}$' },
  { id: 'seller_electronic_address', name: 'Seller Electronic Address', description: 'PEPPOL participant ID or email', ibtReference: 'IBT-034', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_address', name: 'Seller Street', description: 'Seller address line', ibtReference: 'IBT-035', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_city', name: 'Seller City', description: 'Seller city name', ibtReference: 'IBT-037', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_subdivision', name: 'Seller Subdivision', description: 'UAE emirate code', ibtReference: 'IBT-039', category: 'seller', isMandatory: false, dataType: 'string', allowedValues: ['AE-AZ', 'AE-AJ', 'AE-FU', 'AE-SH', 'AE-DU', 'AE-RK', 'AE-UQ'] },
  { id: 'seller_country', name: 'Seller Country', description: 'ISO country code', ibtReference: 'IBT-040', category: 'seller', isMandatory: true, dataType: 'string', format: '^[A-Z]{2}$' },
  { id: 'seller_legal_reg_id_type', name: 'Seller Legal Registration Type', description: 'Seller legal registration scheme/type', ibtReference: 'BTUAE-15', category: 'seller', isMandatory: false, dataType: 'string' },
  
  // Buyer Fields
  { id: 'buyer_name', name: 'Buyer Name', description: 'Buyer legal/trading name', ibtReference: 'IBT-044', category: 'buyer', isMandatory: true, dataType: 'string' },
  { id: 'buyer_trn', name: 'Buyer TRN', description: 'Buyer Tax Registration Number', ibtReference: 'IBT-048', category: 'buyer', isMandatory: false, dataType: 'string', format: '^\\d{15}$' },
  { id: 'buyer_electronic_address', name: 'Buyer Electronic Address', description: 'Buyer PEPPOL ID or email', ibtReference: 'IBT-049', category: 'buyer', isMandatory: true, dataType: 'string' },
  { id: 'buyer_address', name: 'Buyer Address', description: 'Buyer street address', ibtReference: 'IBT-050', category: 'buyer', isMandatory: true, dataType: 'string' },
  { id: 'buyer_city', name: 'Buyer City', description: 'Buyer city name', ibtReference: 'IBT-052', category: 'buyer', isMandatory: false, dataType: 'string' },
  { id: 'buyer_postcode', name: 'Buyer Postcode', description: 'Buyer postcode or ZIP code', ibtReference: 'IBT-053', category: 'buyer', isMandatory: false, dataType: 'string' },
  { id: 'buyer_subdivision', name: 'Buyer Subdivision', description: 'Buyer state or subdivision code', ibtReference: 'IBT-054', category: 'buyer', isMandatory: false, dataType: 'string' },
  { id: 'buyer_country', name: 'Buyer Country', description: 'ISO country code', ibtReference: 'IBT-055', category: 'buyer', isMandatory: true, dataType: 'string', format: '^[A-Z]{2}$' },
  
  // Line Item Fields
  { id: 'line_id', name: 'Line ID', description: 'Unique line identifier', ibtReference: 'IBT-126', category: 'line', isMandatory: true, dataType: 'string' },
  { id: 'line_number', name: 'Line Number', description: 'Line sequence number for the invoice', ibtReference: 'SYS-LINE-NUM', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'quantity', name: 'Quantity', description: 'Invoiced quantity', ibtReference: 'IBT-129', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'unit_of_measure', name: 'Unit of Measure', description: 'UNECE Rec 20 unit code', ibtReference: 'IBT-130', category: 'line', isMandatory: false, dataType: 'string' },
  { id: 'unit_price', name: 'Unit Price', description: 'Item net price', ibtReference: 'IBT-146', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'line_discount', name: 'Line Discount', description: 'Line-level discount amount before VAT', ibtReference: 'SYS-LINE-DISCOUNT', category: 'line', isMandatory: false, dataType: 'number' },
  { id: 'line_total_excl_vat', name: 'Line Net Amount', description: 'Line total excl VAT', ibtReference: 'IBT-131', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'description', name: 'Item Description', description: 'Item name/description', ibtReference: 'IBT-153', category: 'line', isMandatory: true, dataType: 'string' },
  { id: 'item_name', name: 'Item Name', description: 'Item name used when separate from description', ibtReference: 'IBT-154', category: 'line', isMandatory: false, dataType: 'string' },
  { id: 'vat_rate', name: 'VAT Rate', description: 'VAT/tax percentage', ibtReference: 'IBT-152', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'vat_amount', name: 'Line VAT Amount', description: 'Line VAT amount', ibtReference: 'BTUAE-08', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'tax_category_code', name: 'Tax Category Code', description: 'VAT category code at header or line level', ibtReference: 'IBT-151', category: 'tax', isMandatory: false, dataType: 'string' },
  { id: 'tax_category_rate', name: 'Tax Category Rate', description: 'VAT category rate at header or tax breakdown level', ibtReference: 'IBT-119', category: 'tax', isMandatory: false, dataType: 'number' },
  { id: 'exemption_reason_code', name: 'Exemption Reason Code', description: 'Exemption code required for exempt VAT scenarios', ibtReference: 'IBT-151', category: 'line', isMandatory: false, dataType: 'string' },
  { id: 'exemption_reason_text', name: 'Exemption Reason Text', description: 'Exemption reason text for exempt VAT scenarios', ibtReference: 'IBT-151', category: 'line', isMandatory: false, dataType: 'string' },
  { id: 'goods_service_type', name: 'Goods / Service Type', description: 'Goods or service type required for reverse-charge VAT scenarios', ibtReference: 'IBT-151', category: 'line', isMandatory: false, dataType: 'string' },
  { id: 'line_allowance_amount', name: 'Line Allowance Amount', description: 'Line-level allowance amount', ibtReference: 'SYS-LINE-ALLOWANCE', category: 'line', isMandatory: false, dataType: 'number' },
  { id: 'line_charge_amount', name: 'Line Charge Amount', description: 'Line-level charge amount', ibtReference: 'SYS-LINE-CHARGE', category: 'line', isMandatory: false, dataType: 'number' },
  
  // Totals Fields
  { id: 'total_excl_vat', name: 'Total Excl VAT', description: 'Invoice total excluding VAT', ibtReference: 'IBT-109', category: 'totals', isMandatory: true, dataType: 'number' },
  { id: 'vat_total', name: 'Total VAT', description: 'Total VAT amount', ibtReference: 'IBT-110', category: 'totals', isMandatory: true, dataType: 'number' },
  { id: 'total_incl_vat', name: 'Total Incl VAT', description: 'Invoice total including VAT', ibtReference: 'IBT-112', category: 'totals', isMandatory: true, dataType: 'number' },
  { id: 'amount_due', name: 'Amount Due', description: 'Amount due for payment', ibtReference: 'IBT-115', category: 'totals', isMandatory: false, dataType: 'number' },
  { id: 'document_level_allowance_total', name: 'Document Allowance Total', description: 'Total document-level allowance amount', ibtReference: 'SYS-DOC-ALLOWANCE', category: 'totals', isMandatory: false, dataType: 'number' },
  { id: 'document_level_charge_total', name: 'Document Charge Total', description: 'Total document-level charge amount', ibtReference: 'SYS-DOC-CHARGE', category: 'totals', isMandatory: false, dataType: 'number' },
  { id: 'rounding_amount', name: 'Rounding Amount', description: 'Document-level rounding adjustment', ibtReference: 'SYS-ROUNDING', category: 'totals', isMandatory: false, dataType: 'number' },
];

// Conditional fields based on business scenarios
export const CONDITIONAL_QUESTIONS: ConditionalQuestion[] = [
  {
    id: 'foreign_currency',
    question: 'Do you issue invoices in currencies other than AED?',
    fieldIds: ['fx_rate', 'tax_currency'],
  },
  {
    id: 'payment_terms',
    question: 'Do you track payment due dates on invoices?',
    fieldIds: ['payment_due_date', 'amount_due'],
  },
  {
    id: 'buyer_trn',
    question: 'Do you capture buyer TRN for B2B invoices?',
    fieldIds: ['buyer_trn'],
  },
  {
    id: 'emirate_codes',
    question: 'Do you maintain UAE emirate codes in your address data?',
    fieldIds: ['seller_subdivision'],
  },
];

// ERP Types
export const ERP_TYPES = [
  'SAP S/4HANA',
  'SAP ECC',
  'Oracle NetSuite',
  'Oracle E-Business Suite',
  'Microsoft Dynamics 365',
  'Microsoft Dynamics NAV',
  'Tally Prime',
  'Zoho Books',
  'QuickBooks',
  'Sage',
  'Custom ERP',
  'Other',
];

// Document Types
export const DOCUMENT_TYPES = [
  'UC1 Standard Tax Invoice',
  'UC1 Credit Note',
  'UC2 Simplified Tax Invoice',
];

export const LEGACY_PINT_FIELD_ID_ALIASES: Record<string, string> = {
  seller_endpoint: 'seller_electronic_address',
  seller_street: 'seller_address',
  buyer_endpoint: 'buyer_electronic_address',
  line_quantity: 'quantity',
  line_unit_price: 'unit_price',
  line_net_amount: 'line_total_excl_vat',
  line_description: 'description',
  line_vat_rate: 'vat_rate',
  line_vat_amount: 'vat_amount',
};

const PINT_FIELD_BY_ID = new Map<string, PintAEField>(
  PINT_AE_UC1_FIELDS.map((field) => [field.id, field])
);

export function getCanonicalPintFieldId(fieldId: string | undefined | null): string | null {
  if (!fieldId) return null;
  return LEGACY_PINT_FIELD_ID_ALIASES[fieldId] || fieldId;
}

export function getPintFieldById(fieldId: string | undefined | null): PintAEField | undefined {
  const canonicalId = getCanonicalPintFieldId(fieldId);
  if (!canonicalId) return undefined;
  return PINT_FIELD_BY_ID.get(canonicalId);
}

export function getPintFieldDisplayId(fieldId: string | undefined | null): string | null {
  if (!fieldId) return null;
  return getCanonicalPintFieldId(fieldId);
}

export function normalizeFieldMapping(mapping: FieldMapping): FieldMapping {
  const normalizedField = getPintFieldById(mapping.targetField?.id) || mapping.targetField;
  return {
    ...mapping,
    targetField: normalizedField,
  };
}

export function normalizeFieldMappings(mappings: FieldMapping[]): FieldMapping[] {
  return mappings.map(normalizeFieldMapping);
}
