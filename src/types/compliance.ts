import { DatasetType } from '@/types/datasets';

export interface Buyer {
  buyer_id: string;
  buyer_name: string;
  buyer_trn?: string;
  buyer_address?: string;
  buyer_country?: string;
  // UC1 expansions
  buyer_city?: string;
  buyer_postcode?: string;
  buyer_subdivision?: string;
  buyer_electronic_address?: string;
}

export interface InvoiceHeader {
  invoice_id: string;
  invoice_number: string;
  issue_date: string;
  seller_trn: string;
  buyer_id: string;
  currency: string;
  invoice_type?: string;
  total_excl_vat?: number;
  vat_total?: number;
  total_incl_vat?: number;
  // UC1 expansions
  seller_name?: string;
  seller_address?: string;
  seller_city?: string;
  seller_country?: string;
  seller_subdivision?: string;
  seller_electronic_address?: string;
  seller_legal_reg_id?: string;
  seller_legal_reg_id_type?: string;
  transaction_type_code?: string;
  payment_due_date?: string;
  payment_means_code?: string;
  fx_rate?: number;
  amount_due?: number;
  tax_category_code?: string;
  tax_category_rate?: number;
  note?: string;
  supply_date?: string;
  tax_currency?: string;
  document_level_allowance_total?: number;
  document_level_charge_total?: number;
  rounding_amount?: number;
  spec_id?: string;
  business_process?: string;
}

export interface InvoiceLine {
  line_id: string;
  invoice_id: string;
  line_number: number;
  description?: string;
  quantity: number;
  unit_price: number;
  line_discount?: number;
  line_total_excl_vat: number;
  vat_rate: number;
  vat_amount: number;
  // UC1 expansions
  unit_of_measure?: string;
  tax_category_code?: string;
  item_name?: string;
  line_allowance_amount?: number;
  line_charge_amount?: number;
}

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Exception {
  id: string;
  checkId: string;
  checkName: string;
  severity: Severity;
  message: string;
  datasetType?: DatasetType;
  invoiceId?: string;
  invoiceNumber?: string;
  sellerTrn?: string;
  buyerId?: string;
  lineId?: string;
  lineNumber?: number;
  field?: string;
  expectedValue?: string | number;
  actualValue?: string | number;
}

export interface CheckResult {
  checkId: string;
  checkName: string;
  severity: Severity;
  passed: number;
  failed: number;
  exceptions: Exception[];
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: 'buyer' | 'header' | 'line' | 'cross-file';
  run: (data: DataContext) => Exception[];
}

export interface DataContext {
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  buyerMap: Map<string, Buyer>;
  headerMap: Map<string, InvoiceHeader>;
  linesByInvoice: Map<string, InvoiceLine[]>;
}

export interface UploadedFiles {
  buyers: File | null;
  headers: File | null;
  lines: File | null;
}

export interface ParsedData {
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
}

export interface DashboardStats {
  totalInvoices: number;
  totalExceptions: number;
  exceptionsBySeverity: Record<Severity, number>;
  topFailingChecks: { checkId: string; checkName: string; count: number }[];
  passRate: number;
}
