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
  { id: 'invoice_number', name: 'Invoice Number', description: 'Unique invoice identifier', ibtReference: 'IBT-001', category: 'header', isMandatory: true, dataType: 'string' },
  { id: 'issue_date', name: 'Issue Date', description: 'Invoice issue date', ibtReference: 'IBT-002', category: 'header', isMandatory: true, dataType: 'date', format: 'YYYY-MM-DD' },
  { id: 'invoice_type', name: 'Invoice Type Code', description: 'Invoice type (380=invoice, 381=credit note)', ibtReference: 'IBT-003', category: 'header', isMandatory: true, dataType: 'string', allowedValues: ['380', '381', '383', '384'] },
  { id: 'currency', name: 'Document Currency', description: 'ISO 4217 currency code', ibtReference: 'IBT-005', category: 'header', isMandatory: true, dataType: 'string', format: '^[A-Z]{3}$' },
  { id: 'tax_currency', name: 'Tax Accounting Currency', description: 'Must be AED for UAE', ibtReference: 'IBT-006', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'fx_rate', name: 'Exchange Rate', description: 'FX rate to AED (required if non-AED)', ibtReference: 'IBT-007', category: 'header', isMandatory: false, dataType: 'number' },
  { id: 'payment_due_date', name: 'Payment Due Date', description: 'Payment due date', ibtReference: 'IBT-009', category: 'header', isMandatory: false, dataType: 'date' },
  { id: 'buyer_reference', name: 'Buyer Reference', description: 'Buyer reference/PO number', ibtReference: 'IBT-010', category: 'header', isMandatory: false, dataType: 'string' },
  { id: 'spec_id', name: 'Specification Identifier', description: 'PINT-AE specification ID', ibtReference: 'IBT-024', category: 'header', isMandatory: true, dataType: 'string' },
  
  // Seller Fields
  { id: 'seller_name', name: 'Seller Name', description: 'Seller trading name', ibtReference: 'IBT-027', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_trn', name: 'Seller TRN', description: 'UAE Tax Registration Number (15 digits)', ibtReference: 'IBT-031', category: 'seller', isMandatory: true, dataType: 'string', format: '^\\d{15}$' },
  { id: 'seller_endpoint', name: 'Seller Electronic Address', description: 'PEPPOL participant ID or email', ibtReference: 'IBT-034', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_street', name: 'Seller Street', description: 'Seller address line', ibtReference: 'IBT-035', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_city', name: 'Seller City', description: 'Seller city name', ibtReference: 'IBT-037', category: 'seller', isMandatory: true, dataType: 'string' },
  { id: 'seller_subdivision', name: 'Seller Subdivision', description: 'UAE emirate code', ibtReference: 'IBT-039', category: 'seller', isMandatory: false, dataType: 'string', allowedValues: ['AE-AZ', 'AE-AJ', 'AE-FU', 'AE-SH', 'AE-DU', 'AE-RK', 'AE-UQ'] },
  { id: 'seller_country', name: 'Seller Country', description: 'ISO country code', ibtReference: 'IBT-040', category: 'seller', isMandatory: true, dataType: 'string', format: '^[A-Z]{2}$' },
  
  // Buyer Fields
  { id: 'buyer_name', name: 'Buyer Name', description: 'Buyer legal/trading name', ibtReference: 'IBT-044', category: 'buyer', isMandatory: true, dataType: 'string' },
  { id: 'buyer_trn', name: 'Buyer TRN', description: 'Buyer Tax Registration Number', ibtReference: 'IBT-048', category: 'buyer', isMandatory: false, dataType: 'string', format: '^\\d{15}$' },
  { id: 'buyer_endpoint', name: 'Buyer Electronic Address', description: 'Buyer PEPPOL ID or email', ibtReference: 'IBT-049', category: 'buyer', isMandatory: true, dataType: 'string' },
  { id: 'buyer_address', name: 'Buyer Address', description: 'Buyer street address', ibtReference: 'IBT-050', category: 'buyer', isMandatory: true, dataType: 'string' },
  { id: 'buyer_country', name: 'Buyer Country', description: 'ISO country code', ibtReference: 'IBT-055', category: 'buyer', isMandatory: true, dataType: 'string', format: '^[A-Z]{2}$' },
  
  // Line Item Fields
  { id: 'line_id', name: 'Line ID', description: 'Unique line identifier', ibtReference: 'IBT-126', category: 'line', isMandatory: true, dataType: 'string' },
  { id: 'line_quantity', name: 'Quantity', description: 'Invoiced quantity', ibtReference: 'IBT-129', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'line_unit_price', name: 'Unit Price', description: 'Item net price', ibtReference: 'IBT-146', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'line_net_amount', name: 'Line Net Amount', description: 'Line total excl VAT', ibtReference: 'IBT-131', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'line_description', name: 'Item Description', description: 'Item name/description', ibtReference: 'IBT-153', category: 'line', isMandatory: true, dataType: 'string' },
  { id: 'line_vat_rate', name: 'VAT Rate', description: 'VAT/tax percentage', ibtReference: 'IBT-152', category: 'line', isMandatory: true, dataType: 'number' },
  { id: 'line_vat_amount', name: 'Line VAT Amount', description: 'Line VAT amount', ibtReference: 'IBT-117', category: 'line', isMandatory: true, dataType: 'number' },
  
  // Totals Fields
  { id: 'total_excl_vat', name: 'Total Excl VAT', description: 'Invoice total excluding VAT', ibtReference: 'IBT-109', category: 'totals', isMandatory: true, dataType: 'number' },
  { id: 'vat_total', name: 'Total VAT', description: 'Total VAT amount', ibtReference: 'IBT-110', category: 'totals', isMandatory: true, dataType: 'number' },
  { id: 'total_incl_vat', name: 'Total Incl VAT', description: 'Invoice total including VAT', ibtReference: 'IBT-112', category: 'totals', isMandatory: true, dataType: 'number' },
  { id: 'amount_due', name: 'Amount Due', description: 'Amount due for payment', ibtReference: 'IBT-115', category: 'totals', isMandatory: false, dataType: 'number' },
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
