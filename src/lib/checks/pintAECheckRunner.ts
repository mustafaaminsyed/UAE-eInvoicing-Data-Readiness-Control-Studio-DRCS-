import { PintAECheck, PintAEException, SLA_HOURS_BY_SEVERITY } from '@/types/pintAE';
import { DataContext, Severity } from '@/types/compliance';
import { isCodeInCodelist } from '@/lib/pintAE/specCatalog';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
const PROFILE_DEFAULTS_ENABLED = (import.meta.env.VITE_ENABLE_TECHNICAL_PROFILE_DEFAULTS || 'true').toLowerCase() === 'true';
const DEFAULT_SPEC_ID = (import.meta.env.VITE_DEFAULT_SPEC_ID || 'urn:peppol:pint:billing-1@ae-1').trim();
const DEFAULT_BUSINESS_PROCESS = (import.meta.env.VITE_DEFAULT_BUSINESS_PROCESS || 'urn:peppol:bis:billing').trim();

function getFieldValue(record: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let value = record;
  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }
  return value;
}

function countDecimals(num: number): number {
  if (Math.floor(num) === num) return 0;
  const str = String(num);
  if (str.indexOf('.') === -1) return 0;
  return str.split('.')[1]?.length || 0;
}

function isEmpty(value: any): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function resolveFieldAlias(field: string): string {
  const aliases: Record<string, string> = {
    seller_endpoint: 'seller_electronic_address',
    buyer_endpoint: 'buyer_electronic_address',
    seller_street: 'seller_address',
  };
  return aliases[field] || field;
}

function isSystemDefaultAllowed(params: Record<string, any>): boolean {
  if (typeof params.allow_system_default === 'boolean') {
    return params.allow_system_default;
  }
  return PROFILE_DEFAULTS_ENABLED;
}

function pickSystemDefault(params: Record<string, any>, envDefault: string): string {
  if (typeof params.system_default_value === 'string' && params.system_default_value.trim()) {
    return params.system_default_value.trim();
  }
  return envDefault;
}

function getDatasetForField(field: string, scope: PintAECheck['scope'], data: DataContext): any[] {
  const normalized = resolveFieldAlias(field);
  if (normalized.startsWith('buyer_')) return data.buyers;
  if (normalized.startsWith('line_') || normalized === 'quantity' || normalized === 'unit_of_measure') return data.lines;
  if (normalized.startsWith('seller_') || normalized.startsWith('invoice_') || normalized === 'currency') return data.headers;
  if (scope === 'Lines') return data.lines;
  if (scope === 'Party') return data.buyers;
  return data.headers;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);
}

function isCreditNoteInvoiceType(value: string): boolean {
  const token = normalizeToken(value);
  if (!token) return false;
  return token.startsWith('381') || token.includes('CREDIT');
}

function shouldRunCodelistForDocumentContext(
  record: any,
  data: DataContext,
  params: Record<string, any>
): boolean {
  const context = normalizeToken(params.document_context || 'both');
  if (!context || context === 'BOTH') return true;

  const invoiceType = normalizeToken(
    record?.invoice_type ??
    data.headerMap.get(record?.invoice_id)?.invoice_type
  );

  if (context === 'CREDIT_NOTE') {
    return isCreditNoteInvoiceType(invoiceType);
  }

  if (context === 'INVOICE') {
    if (!invoiceType) return true;
    return !isCreditNoteInvoiceType(invoiceType);
  }

  return true;
}

function isCommercialScopeApplicable(header: any, params: Record<string, any>): boolean {
  if (normalizeToken(params.apply_when_document_type) !== 'COMMERCIAL') return true;

  const explicitDocumentType = [
    header?.document_type,
    header?.documentType,
    header?.mof_document_type,
    header?.mofDocumentType,
  ]
    .map(normalizeToken)
    .find((value) => value.length > 0);

  if (explicitDocumentType === 'COMMERCIAL' || explicitDocumentType === 'COMMERCIAL_XML') {
    return true;
  }

  const commercialInvoiceTypes = getStringArray(params.commercial_invoice_types).map(normalizeToken);
  if (commercialInvoiceTypes.length === 0) return false;
  return commercialInvoiceTypes.includes(normalizeToken(header?.invoice_type));
}

function pickFirstNonEmptyField(
  records: Array<any | undefined>,
  fields: string[]
): { field?: string; value?: string } {
  for (const field of fields) {
    const resolvedField = resolveFieldAlias(field);
    for (const record of records) {
      if (!record) continue;
      const value = getFieldValue(record, resolvedField);
      if (!isEmpty(value)) {
        return {
          field: resolvedField,
          value: String(value).trim(),
        };
      }
    }
  }
  return {};
}

export function runPintAECheck(check: PintAECheck, data: DataContext): PintAEException[] {
  const exceptions: PintAEException[] = [];
  const params = check.parameters || {};
  const timestamp = new Date().toISOString();

  const createException = (opts: {
    invoiceId?: string;
    invoiceNumber?: string;
    sellerTrn?: string;
    buyerId?: string;
    lineId?: string;
    fieldName?: string;
    observedValue?: string;
    expectedValue?: string;
    message: string;
  }): PintAEException => ({
    id: generateId(),
    timestamp,
    check_id: check.check_id,
    check_name: check.check_name,
    severity: check.severity,
    scope: check.scope,
    rule_type: check.rule_type,
    use_case: check.use_case,
    pint_reference_terms: check.pint_reference_terms || [],
    invoice_id: opts.invoiceId,
    invoice_number: opts.invoiceNumber,
    seller_trn: opts.sellerTrn,
    buyer_id: opts.buyerId,
    line_id: opts.lineId,
    field_name: opts.fieldName,
    observed_value: opts.observedValue,
    expected_value_or_rule: opts.expectedValue,
    message: opts.message,
    suggested_fix: check.suggested_fix,
    root_cause_category: 'Unclassified',
    owner_team: check.owner_team_default,
    sla_target_hours: SLA_HOURS_BY_SEVERITY[check.severity],
    case_status: 'Open',
  });

  // Handle based on check_id for specific logic
  switch (check.check_id) {
    // Header Presence Checks
    case 'UAE-UC1-CHK-001': // Invoice Number Present
    case 'UAE-UC1-CHK-002': // Issue Date Present
    case 'UAE-UC1-CHK-004': // Invoice Type Present
    case 'UAE-UC1-CHK-005': // Currency Present
      data.headers.forEach(header => {
        const field = params.field;
        const value = getFieldValue(header, field);
        if (isEmpty(value)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: '(empty)',
            expectedValue: 'Required value',
            message: `Invoice ${header.invoice_number || header.invoice_id}: Missing required field "${field}"`,
          }));
        }
      });
      break;

    // Format Checks
    case 'UAE-UC1-CHK-003': // Date Format YYYY-MM-DD
      if (params.field && params.pattern) {
        const regex = new RegExp(params.pattern);
        data.headers.forEach(header => {
          const value = getFieldValue(header, params.field);
          if (!isEmpty(value) && !regex.test(String(value))) {
            exceptions.push(createException({
              invoiceId: header.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              fieldName: params.field,
              observedValue: String(value),
              expectedValue: `Match pattern: ${params.pattern}`,
              message: `Invoice ${header.invoice_number}: Field "${params.field}" format invalid. Expected pattern: ${params.pattern}`,
            }));
          }
        });
      }
      break;

    // Specification identifier (IBT-024): mandatory + allowed prefixes
    case 'UAE-UC1-CHK-010':
      data.headers.forEach(header => {
        const field = resolveFieldAlias(params.field || 'spec_id');
        const value = getFieldValue(header, field);
        const allowedPrefixes: string[] =
          Array.isArray(params.allowed_prefixes) && params.allowed_prefixes.length > 0
            ? params.allowed_prefixes
            : ['urn:peppol:pint:billing-1@ae-1', 'urn:peppol:pint:selfbilling-1@ae-1'];
        const allowSystemDefault = isSystemDefaultAllowed(params);
        const resolved = isEmpty(value) && allowSystemDefault
          ? pickSystemDefault(params, DEFAULT_SPEC_ID)
          : String(value ?? '').trim();

        if (isEmpty(resolved)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: '(empty)',
            expectedValue: allowedPrefixes.join(' OR '),
            message: `Invoice ${header.invoice_number}: Missing specification identifier`,
          }));
          return;
        }

        const validPrefix = allowedPrefixes.some((prefix) => resolved.startsWith(prefix));
        if (!validPrefix) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: resolved,
            expectedValue: `Starts with: ${allowedPrefixes.join(' OR ')}`,
            message: `Invoice ${header.invoice_number}: Invalid specification identifier "${resolved}"`,
          }));
        }
      });
      break;

    // Currency ISO4217 codelist check from official PINT-AE resources
    case 'UAE-UC1-CHK-006':
      data.headers.forEach(header => {
        const field = params.field || 'currency';
        const value = getFieldValue(header, field);
        if (!isEmpty(value) && !isCodeInCodelist('ISO4217', String(value))) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: String(value),
            expectedValue: 'Valid ISO4217 code from PINT-AE codelist',
            message: `Invoice ${header.invoice_number}: Currency "${value}" is not in the official PINT-AE ISO4217 codelist`,
          }));
        }
      });
      break;

    // Tax accounting currency must be AED
    case 'UAE-UC1-CHK-007':
      data.headers.forEach(header => {
        const baseCurrency = String(params.tax_currency || 'AED').toUpperCase();
        const invoiceCurrency = String(header.currency || '').toUpperCase();
        const taxCurrency = String(header.tax_currency || '').toUpperCase();

        if (invoiceCurrency !== baseCurrency && isEmpty(taxCurrency)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'tax_currency',
            observedValue: '(empty)',
            expectedValue: baseCurrency,
            message: `Invoice ${header.invoice_number}: Tax accounting currency must be ${baseCurrency} when invoice currency is ${invoiceCurrency}`,
          }));
        } else if (!isEmpty(taxCurrency) && taxCurrency !== baseCurrency) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'tax_currency',
            observedValue: taxCurrency,
            expectedValue: baseCurrency,
            message: `Invoice ${header.invoice_number}: Tax accounting currency "${taxCurrency}" must be ${baseCurrency}`,
          }));
        }
      });
      break;

    // FX rate required when invoice currency is not AED
    case 'UAE-UC1-CHK-008':
      data.headers.forEach(header => {
        const currencyField = resolveFieldAlias(params.currency_field || 'currency');
        const fxField = resolveFieldAlias(params.fx_field || 'fx_rate');
        const baseCurrency = String(params.base_currency || 'AED').toUpperCase();
        const currency = String(getFieldValue(header, currencyField) || '').toUpperCase();
        const fxRate = getFieldValue(header, fxField);
        if (!isEmpty(currency) && currency !== baseCurrency && (fxRate === undefined || fxRate === null || Number(fxRate) <= 0)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: fxField,
            observedValue: String(fxRate ?? '(empty)'),
            expectedValue: 'Positive FX rate',
            message: `Invoice ${header.invoice_number}: FX rate is required when currency is ${currency} (base ${baseCurrency})`,
          }));
        }
      });
      break;

    // Payment due date required when amount due > 0
    case 'UAE-UC1-CHK-009':
      data.headers.forEach(header => {
        const amountDue = Number(header.amount_due || 0);
        const dueDate = header.payment_due_date;
        if (amountDue > 0 && isEmpty(dueDate)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'payment_due_date',
            observedValue: '(empty)',
            expectedValue: 'Required when amount_due > 0',
            message: `Invoice ${header.invoice_number}: Payment due date is required because amount due is ${amountDue}`,
          }));
        }
        if (!isEmpty(dueDate) && !isEmpty(header.issue_date)) {
          const issue = new Date(String(header.issue_date));
          const due = new Date(String(dueDate));
          if (!Number.isNaN(issue.getTime()) && !Number.isNaN(due.getTime()) && due < issue) {
            exceptions.push(createException({
              invoiceId: header.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              fieldName: 'payment_due_date',
              observedValue: String(dueDate),
              expectedValue: `On or after issue date ${header.issue_date}`,
              message: `Invoice ${header.invoice_number}: Payment due date (${dueDate}) cannot be earlier than issue date (${header.issue_date})`,
            }));
          }
        }
      });
      break;

    // Business process type in allowed values
    case 'UAE-UC1-CHK-011':
      data.headers.forEach(header => {
        const field = resolveFieldAlias(params.field || 'business_process');
        const value = getFieldValue(header, field);
        const allowed: string[] =
          Array.isArray(params.allowed_values) && params.allowed_values.length > 0
            ? params.allowed_values
            : ['urn:peppol:bis:billing', 'urn:peppol:bis:selfbilling'];
        const allowSystemDefault = isSystemDefaultAllowed(params);
        const resolved = isEmpty(value) && allowSystemDefault
          ? pickSystemDefault(params, DEFAULT_BUSINESS_PROCESS)
          : String(value ?? '').trim();

        if (isEmpty(resolved)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: '(empty)',
            expectedValue: allowed.join(' OR '),
            message: `Invoice ${header.invoice_number}: Missing business process type`,
          }));
          return;
        }

        if (!allowed.includes(resolved)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: resolved,
            expectedValue: allowed.join(', '),
            message: `Invoice ${header.invoice_number}: Invalid business process type "${resolved}"`,
          }));
        }
      });
      break;

    // Seller TRN Pattern
    case 'UAE-UC1-CHK-013':
      data.headers.forEach(header => {
        const trn = header.seller_trn;
        if (!isEmpty(trn) && !/^\d{15}$/.test(trn)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: trn,
            buyerId: header.buyer_id,
            fieldName: 'seller_trn',
            observedValue: trn,
            expectedValue: '15-digit number',
            message: `Invoice ${header.invoice_number}: Seller TRN "${trn}" does not match UAE 15-digit format`,
          }));
        }
      });
      break;

    // Seller address mandatory fields
    case 'UAE-UC1-CHK-015':
      data.headers.forEach(header => {
        const fields: string[] = Array.isArray(params.fields) ? params.fields : ['seller_address', 'seller_city', 'seller_country'];
        fields.map(resolveFieldAlias).forEach((field) => {
          const value = getFieldValue(header, field);
          if (isEmpty(value)) {
            exceptions.push(createException({
              invoiceId: header.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              fieldName: field,
              observedValue: '(empty)',
              expectedValue: 'Required value',
              message: `Invoice ${header.invoice_number}: Missing seller field "${field}"`,
            }));
          }
        });
      });
      break;

    // UAE subdivision code allowed values
    case 'UAE-UC1-CHK-016':
      data.headers.forEach(header => {
        const field = resolveFieldAlias(params.field || 'seller_subdivision');
        const value = getFieldValue(header, field);
        const allowed: string[] = Array.isArray(params.allowed_values) ? params.allowed_values : [];
        if (!isEmpty(value) && allowed.length > 0 && !allowed.includes(String(value))) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: String(value),
            expectedValue: allowed.join(', '),
            message: `Invoice ${header.invoice_number}: Invalid UAE subdivision "${value}"`,
          }));
        }
      });
      break;

    // Buyer TRN Pattern (allow empty)
    case 'UAE-UC1-CHK-018':
      data.buyers.forEach(buyer => {
        const trn = buyer.buyer_trn;
        if (!isEmpty(trn) && !/^\d{15}$/.test(trn)) {
          exceptions.push(createException({
            buyerId: buyer.buyer_id,
            fieldName: 'buyer_trn',
            observedValue: trn || '(empty)',
            expectedValue: '15-digit number (or empty)',
            message: `Buyer "${buyer.buyer_name}": TRN "${trn}" does not match UAE 15-digit format`,
          }));
        }
      });
      break;

    // Buyer Name Present
    case 'UAE-UC1-CHK-017':
      data.buyers.forEach(buyer => {
        if (isEmpty(buyer.buyer_name)) {
          exceptions.push(createException({
            buyerId: buyer.buyer_id,
            fieldName: 'buyer_name',
            observedValue: '(empty)',
            expectedValue: 'Required value',
            message: `Buyer ID "${buyer.buyer_id}": Missing buyer name`,
          }));
        }
      });
      break;

    // Buyer address mandatory fields
    case 'UAE-UC1-CHK-020':
      data.buyers.forEach(buyer => {
        const fields: string[] = Array.isArray(params.fields) ? params.fields : ['buyer_address', 'buyer_country'];
        fields.map(resolveFieldAlias).forEach((field) => {
          const value = getFieldValue(buyer, field);
          if (isEmpty(value)) {
            exceptions.push(createException({
              buyerId: buyer.buyer_id,
              fieldName: field,
              observedValue: '(empty)',
              expectedValue: 'Required value',
              message: `Buyer ${buyer.buyer_id}: Missing buyer field "${field}"`,
            }));
          }
        });
      });
      break;

    // Total With Tax = Without Tax + Tax
    case 'UAE-UC1-CHK-025':
      data.headers.forEach(header => {
        if (header.total_incl_vat !== undefined && 
            header.total_excl_vat !== undefined && 
            header.vat_total !== undefined) {
          const expected = header.total_excl_vat + header.vat_total;
          const diff = Math.abs(header.total_incl_vat - expected);
          const tolerance = params.tolerance || 0.01;
          if (diff > tolerance) {
            exceptions.push(createException({
              invoiceId: header.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              fieldName: 'total_incl_vat',
              observedValue: String(header.total_incl_vat),
              expectedValue: String(expected),
              message: `Invoice ${header.invoice_number}: Total with VAT (${header.total_incl_vat}) != Excl VAT (${header.total_excl_vat}) + VAT (${header.vat_total})`,
            }));
          }
        }
      });
      break;

    // Sum of Line Net Amounts Matches Header
    case 'UAE-UC1-CHK-021':
      data.headers.forEach(header => {
        const invoiceLines = data.linesByInvoice.get(header.invoice_id) || [];
        const lineSum = invoiceLines.reduce((sum, l) => sum + (l.line_total_excl_vat || 0), 0);
        const headerTotal = header.total_excl_vat || 0;
        const diff = Math.abs(lineSum - headerTotal);
        const tolerance = params.tolerance || 0.01;
        if (diff > tolerance) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'total_excl_vat',
            observedValue: String(headerTotal),
            expectedValue: `Sum of lines: ${lineSum.toFixed(2)}`,
            message: `Invoice ${header.invoice_number}: Header total (${headerTotal}) does not match sum of lines (${lineSum.toFixed(2)})`,
          }));
        }
      });
      break;

    // Tax Total = Sum of Tax Breakdown Amounts
    case 'UAE-UC1-CHK-029':
      data.headers.forEach(header => {
        const invoiceLines = data.linesByInvoice.get(header.invoice_id) || [];
        const taxSum = invoiceLines.reduce((sum, l) => sum + (l.vat_amount || 0), 0);
        const headerTax = header.vat_total || 0;
        const diff = Math.abs(taxSum - headerTax);
        const tolerance = params.tolerance || 0.01;
        if (diff > tolerance) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'vat_total',
            observedValue: String(headerTax),
            expectedValue: `Sum of line VAT: ${taxSum.toFixed(2)}`,
            message: `Invoice ${header.invoice_number}: VAT total (${headerTax}) does not match sum of line VAT amounts (${taxSum.toFixed(2)})`,
          }));
        }
      });
      break;

    // Invoice Must Have >=1 Line
    case 'UAE-UC1-CHK-030':
      data.headers.forEach(header => {
        const invoiceLines = data.linesByInvoice.get(header.invoice_id) || [];
        if (invoiceLines.length === 0) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'lines',
            observedValue: '0 lines',
            expectedValue: '>=1 line',
            message: `Invoice ${header.invoice_number}: No line items found. At least one line is required.`,
          }));
        }
      });
      break;

    // Line Identifier Present
    case 'UAE-UC1-CHK-031':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        if (isEmpty(line.line_number)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'line_number',
            observedValue: '(empty)',
            expectedValue: 'Unique line identifier',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line: Missing line identifier`,
          }));
        }
      });
      break;

    // Invoiced Quantity Present
    case 'UAE-UC1-CHK-032':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        if (line.quantity === undefined || line.quantity === null) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'quantity',
            observedValue: '(empty)',
            expectedValue: 'Numeric quantity',
            message: `Invoice ${header?.invoice_number}, Line ${line.line_number}: Missing quantity`,
          }));
        }
      });
      break;

    // Unit of Measure Code Present
    case 'UAE-UC1-CHK-033':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        if (isEmpty(line.unit_of_measure)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'unit_of_measure',
            observedValue: '(empty)',
            expectedValue: 'Required unit of measure code',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line ${line.line_number}: Missing unit of measure`,
          }));
        }
      });
      break;

    // Line Net Amount Formula
    case 'UAE-UC1-CHK-034':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        const discount = line.line_discount || 0;
        const expected = (line.quantity * line.unit_price) - discount;
        const diff = Math.abs(line.line_total_excl_vat - expected);
        const tolerance = params.tolerance || 0.01;
        if (diff > tolerance) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'line_total_excl_vat',
            observedValue: String(line.line_total_excl_vat),
            expectedValue: `(${line.quantity} x ${line.unit_price}) - ${discount} = ${expected.toFixed(2)}`,
            message: `Invoice ${header?.invoice_number}, Line ${line.line_number}: Net amount (${line.line_total_excl_vat}) != (Qty x Price) - Discount (${expected.toFixed(2)})`,
          }));
        }
      });
      break;

    // Tax line amount must be derivable in AED
    case 'UAE-UC1-CHK-035':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        if (!header) return;

        const currencyField = resolveFieldAlias(params.currency_field || 'currency');
        const fxField = resolveFieldAlias(params.fx_field || 'fx_rate');
        const amountField = resolveFieldAlias(params.amount_field || 'line_total_excl_vat');
        const baseCurrency = normalizeToken(params.base_currency || 'AED');
        const requireNonNegative = params.require_non_negative !== false;

        const currency = normalizeToken(getFieldValue(header, currencyField));
        const amountRaw = getFieldValue(line, amountField);
        const amount = Number(amountRaw);

        if (!Number.isFinite(amount)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            lineId: line.line_id,
            fieldName: amountField,
            observedValue: String(amountRaw ?? '(empty)'),
            expectedValue: 'Numeric line amount',
            message: `Invoice ${header.invoice_number}, Line ${line.line_number}: Line amount is not numeric and cannot be converted to AED`,
          }));
          return;
        }

        if (isEmpty(currency)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            lineId: line.line_id,
            fieldName: currencyField,
            observedValue: '(empty)',
            expectedValue: `Currency code (${baseCurrency} or non-${baseCurrency} with FX)`,
            message: `Invoice ${header.invoice_number}, Line ${line.line_number}: Currency is missing so AED line amount cannot be derived`,
          }));
          return;
        }

        if (currency === baseCurrency) {
          if (requireNonNegative && amount < 0) {
            exceptions.push(createException({
              invoiceId: line.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              lineId: line.line_id,
              fieldName: amountField,
              observedValue: String(amount),
              expectedValue: 'Non-negative AED line amount',
              message: `Invoice ${header.invoice_number}, Line ${line.line_number}: AED line amount cannot be negative under current policy`,
            }));
          }
          return;
        }

        const fxRaw = getFieldValue(header, fxField);
        const fx = Number(fxRaw);
        if (!Number.isFinite(fx) || fx <= 0) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            lineId: line.line_id,
            fieldName: fxField,
            observedValue: String(fxRaw ?? '(empty)'),
            expectedValue: `Positive FX rate to ${baseCurrency}`,
            message: `Invoice ${header.invoice_number}, Line ${line.line_number}: Positive FX rate is required to derive AED line amount from ${currency}`,
          }));
          return;
        }

        const amountInAed = amount * fx;
        if (!Number.isFinite(amountInAed) || (requireNonNegative && amountInAed < 0)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            lineId: line.line_id,
            fieldName: amountField,
            observedValue: `${amount} @ FX ${fx}`,
            expectedValue: `Derivable non-negative ${baseCurrency} line amount`,
            message: `Invoice ${header.invoice_number}, Line ${line.line_number}: AED line amount derivation is invalid under current currency policy`,
          }));
        }
      });
      break;

    // Commercial buyer legal registration identifier presence
    case 'UAE-UC1-CHK-036':
      data.headers.forEach(header => {
        if (!isCommercialScopeApplicable(header, params)) return;
        const buyer = data.buyerMap.get(header.buyer_id);
        const identifierFields = getStringArray(params.buyer_identifier_fields);
        const fieldsToUse = identifierFields.length > 0 ? identifierFields : ['buyer_legal_reg_id', 'buyer_trn'];
        const identifier = pickFirstNonEmptyField([buyer, header], fieldsToUse);

        if (isEmpty(identifier.value)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: fieldsToUse.join('|'),
            observedValue: '(empty)',
            expectedValue: 'Buyer legal registration identifier for commercial invoice',
            message: `Invoice ${header.invoice_number}: Buyer legal registration identifier is missing for commercial invoice profile`,
          }));
        }
      });
      break;

    // Commercial buyer legal registration identifier type policy
    case 'UAE-UC1-CHK-037':
      data.headers.forEach(header => {
        if (!isCommercialScopeApplicable(header, params)) return;
        const buyer = data.buyerMap.get(header.buyer_id);

        const identifierFields = getStringArray(params.buyer_identifier_fields);
        const fieldsToUse = identifierFields.length > 0 ? identifierFields : ['buyer_legal_reg_id', 'buyer_trn'];
        const identifier = pickFirstNonEmptyField([buyer, header], fieldsToUse);
        if (isEmpty(identifier.value)) return; // Presence handled by CHK-036

        const typeFields = getStringArray(params.type_fields);
        const typeFieldList = typeFields.length > 0 ? typeFields : ['buyer_legal_reg_id_type', 'buyer_reg_id_type'];
        const explicitType = pickFirstNonEmptyField([buyer, header], typeFieldList);
        const allowDefault = params.allow_default_identifier_type !== false;
        const defaultType = String(params.default_identifier_type || '').trim();
        const resolvedType = !isEmpty(explicitType.value)
          ? String(explicitType.value).trim()
          : (allowDefault ? defaultType : '');

        if (isEmpty(resolvedType)) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: typeFieldList.join('|'),
            observedValue: '(empty)',
            expectedValue: 'Buyer legal registration identifier type',
            message: `Invoice ${header.invoice_number}: Buyer legal registration identifier type is missing for commercial invoice profile`,
          }));
          return;
        }

        const allowedTypes = getStringArray(params.allowed_identifier_types).map(normalizeToken);
        if (allowedTypes.length > 0 && !allowedTypes.includes(normalizeToken(resolvedType))) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: typeFieldList.join('|'),
            observedValue: resolvedType,
            expectedValue: allowedTypes.join(', '),
            message: `Invoice ${header.invoice_number}: Buyer legal registration identifier type "${resolvedType}" is not allowed for commercial invoice profile`,
          }));
        }
      });
      break;

    // Item name presence with description fallback
    case 'UAE-UC1-CHK-038':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        const primaryField = resolveFieldAlias(params.primary_field || 'item_name');
        const fallbackField = resolveFieldAlias(params.fallback_field || 'description');
        const primaryValue = getFieldValue(line, primaryField);
        const fallbackValue = getFieldValue(line, fallbackField);

        if (isEmpty(primaryValue) && isEmpty(fallbackValue)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: `${primaryField}|${fallbackField}`,
            observedValue: '(both empty)',
            expectedValue: 'Item name or description fallback',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line ${line.line_number}: Missing item name (description fallback also empty)`,
          }));
        }
      });
      break;

    // Item description presence with item-name fallback
    case 'UAE-UC1-CHK-039':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        const primaryField = resolveFieldAlias(params.primary_field || 'description');
        const fallbackField = resolveFieldAlias(params.fallback_field || 'item_name');
        const primaryValue = getFieldValue(line, primaryField);
        const fallbackValue = getFieldValue(line, fallbackField);

        if (isEmpty(primaryValue) && isEmpty(fallbackValue)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: `${primaryField}|${fallbackField}`,
            observedValue: '(both empty)',
            expectedValue: 'Item description or item-name fallback',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line ${line.line_number}: Missing item description (item name fallback also empty)`,
          }));
        }
      });
      break;

    // Item price base quantity policy
    case 'UAE-UC1-CHK-040':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        const baseFields = getStringArray(params.base_quantity_fields);
        const baseFieldList = baseFields.length > 0
          ? baseFields
          : ['price_base_quantity', 'line_base_quantity', 'item_price_base_quantity'];
        const explicitBase = pickFirstNonEmptyField([line], baseFieldList);

        let resolvedBaseRaw = explicitBase.value;
        let resolvedBaseSource = explicitBase.field || 'price_base_quantity';
        if (isEmpty(resolvedBaseRaw) && params.allow_default_base_quantity !== false) {
          resolvedBaseRaw = String(params.default_base_quantity ?? 1);
          resolvedBaseSource = 'default_base_quantity_policy';
        }

        const resolvedBase = Number(resolvedBaseRaw);
        if (isEmpty(resolvedBaseRaw) || !Number.isFinite(resolvedBase)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: baseFieldList.join('|'),
            observedValue: String(resolvedBaseRaw ?? '(empty)'),
            expectedValue: 'Positive base quantity (explicit or approved default)',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line ${line.line_number}: Item price base quantity policy is unresolved`,
          }));
          return;
        }

        if (resolvedBase <= 0) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: resolvedBaseSource,
            observedValue: String(resolvedBase),
            expectedValue: 'Base quantity > 0',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line ${line.line_number}: Item price base quantity must be greater than zero`,
          }));
        }

        if (params.require_positive_quantity && (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'quantity',
            observedValue: String(line.quantity),
            expectedValue: 'Quantity > 0 when base quantity policy applies',
            message: `Invoice ${header?.invoice_number || line.invoice_id}, Line ${line.line_number}: Quantity must be positive for base quantity policy`,
          }));
        }
      });
      break;

    // Decimal Precision Checks
    case 'UAE-UC1-CHK-022':
    case 'UAE-UC1-CHK-023':
    case 'UAE-UC1-CHK-024':
    case 'UAE-UC1-CHK-026':
      if (params.field && params.max_decimals !== undefined) {
        data.headers.forEach(header => {
          const value = getFieldValue(header, params.field);
          if (value !== undefined && value !== null) {
            const decimals = countDecimals(Number(value));
            if (decimals > params.max_decimals) {
              exceptions.push(createException({
                invoiceId: header.invoice_id,
                invoiceNumber: header.invoice_number,
                sellerTrn: header.seller_trn,
                buyerId: header.buyer_id,
                fieldName: params.field,
                observedValue: `${value} (${decimals} decimals)`,
                expectedValue: `Max ${params.max_decimals} decimals`,
                message: `Invoice ${header.invoice_number}: Field "${params.field}" has ${decimals} decimal places, maximum allowed is ${params.max_decimals}`,
              }));
            }
          }
        });
      }
      break;

    // Tax breakdown must exist when taxable amounts are present
    case 'UAE-UC1-CHK-027':
      data.headers.forEach(header => {
        const invoiceLines = data.linesByInvoice.get(header.invoice_id) || [];
        const hasHeaderBreakdown =
          !isEmpty(header.tax_category_code) &&
          header.tax_category_rate !== undefined &&
          header.tax_category_rate !== null;
        const hasLineBreakdown = invoiceLines.some((line) => !isEmpty(line.tax_category_code) && line.vat_rate !== undefined && line.vat_rate !== null);
        const hasTaxableAmount = (header.total_excl_vat || 0) > 0 || invoiceLines.some((line) => (line.line_total_excl_vat || 0) > 0);
        if (hasTaxableAmount && !hasHeaderBreakdown && !hasLineBreakdown) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: 'tax_breakdown',
            observedValue: 'missing',
            expectedValue: 'At least one tax category breakdown',
            message: `Invoice ${header.invoice_number}: Missing tax breakdown details (category/rate)`,
          }));
        }
      });
      break;

    // VAT Calculation Check
    case 'UAE-UC1-CHK-028':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        const expected = line.line_total_excl_vat * (line.vat_rate / 100);
        const diff = Math.abs(line.vat_amount - expected);
        const tolerance = params.tolerance || 0.01;
        if (diff > tolerance) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'vat_amount',
            observedValue: String(line.vat_amount),
            expectedValue: `${line.line_total_excl_vat} x (${line.vat_rate}/100) = ${expected.toFixed(2)}`,
            message: `Invoice ${header?.invoice_number}, Line ${line.line_number}: VAT amount (${line.vat_amount}) != Base x Rate/100 (${expected.toFixed(2)})`,
          }));
        }
      });
      break;

    // Default: Generic presence check for other checks
    default:
      if (check.rule_type === 'CodeList' && params.field && params.codelist) {
        const field = resolveFieldAlias(params.field);
        const dataset = getDatasetForField(field, check.scope, data);
        dataset.forEach((record: any) => {
          if (!shouldRunCodelistForDocumentContext(record, data, params)) return;
          const value = getFieldValue(record, field);
          if (!isEmpty(value) && !isCodeInCodelist(String(params.codelist), String(value))) {
            const header = record.invoice_id ? data.headerMap.get(record.invoice_id) : undefined;
            exceptions.push(createException({
              invoiceId: record.invoice_id || header?.invoice_id,
              invoiceNumber: record.invoice_number || header?.invoice_number,
              sellerTrn: record.seller_trn || header?.seller_trn,
              buyerId: record.buyer_id || header?.buyer_id,
              fieldName: field,
              observedValue: String(value),
              expectedValue: `Value from codelist: ${params.codelist}`,
              message: `Field "${field}" has invalid value "${value}" for codelist ${params.codelist}`,
            }));
          }
        });
      } else if (check.rule_type === 'Presence' && params.field) {
        const field = resolveFieldAlias(params.field);
        const dataset = getDatasetForField(field, check.scope, data);
        dataset.forEach((record: any) => {
          const value = getFieldValue(record, field);
          if (isEmpty(value)) {
            const header = record.invoice_id ? data.headerMap.get(record.invoice_id) : undefined;
            exceptions.push(createException({
              invoiceId: record.invoice_id || header?.invoice_id,
              invoiceNumber: record.invoice_number || header?.invoice_number,
              sellerTrn: record.seller_trn || header?.seller_trn,
              buyerId: record.buyer_id || header?.buyer_id,
              lineId: record.line_id,
              fieldName: field,
              observedValue: '(empty)',
              expectedValue: 'Required value',
              message: `Missing required field "${field}" - ${check.check_name}`,
            }));
          }
        });
      }
      break;
  }

  return exceptions;
}

export function runAllPintAEChecks(checks: PintAECheck[], data: DataContext): PintAEException[] {
  const enabledChecks = checks.filter(c => c.is_enabled);
  const allExceptions: PintAEException[] = [];
  
  for (const check of enabledChecks) {
    allExceptions.push(...runPintAECheck(check, data));
  }
  
  return allExceptions;
}
