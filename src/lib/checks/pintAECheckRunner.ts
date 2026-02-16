import { PintAECheck, PintAEException, SLA_HOURS_BY_SEVERITY } from '@/types/pintAE';
import { DataContext, Severity } from '@/types/compliance';
import { isCodeInCodelist } from '@/lib/pintAE/specCatalog';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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

function getDatasetForField(field: string, scope: PintAECheck['scope'], data: DataContext): any[] {
  const normalized = resolveFieldAlias(field);
  if (normalized.startsWith('buyer_')) return data.buyers;
  if (normalized.startsWith('line_') || normalized === 'quantity' || normalized === 'unit_of_measure') return data.lines;
  if (normalized.startsWith('seller_') || normalized.startsWith('invoice_') || normalized === 'currency') return data.headers;
  if (scope === 'Lines') return data.lines;
  if (scope === 'Party') return data.buyers;
  return data.headers;
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
    case 'UAE-UC1-CHK-010': // Spec Identifier
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
        const allowed: string[] = Array.isArray(params.allowed_values) ? params.allowed_values : [];
        // business_process is ASP-derived in this app's CSV templates.
        // If customer input doesn't provide it, skip instead of raising a false-positive.
        if (!isEmpty(value) && allowed.length > 0 && !allowed.includes(String(value))) {
          exceptions.push(createException({
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            fieldName: field,
            observedValue: String(value),
            expectedValue: allowed.join(', '),
            message: `Invoice ${header.invoice_number}: Invalid business process type "${value}"`,
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
              message: `Invoice ${header.invoice_number}: Total with VAT (${header.total_incl_vat}) ≠ Excl VAT (${header.total_excl_vat}) + VAT (${header.vat_total})`,
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

    // Invoice Must Have ≥1 Line
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
            expectedValue: '≥1 line',
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
