import { PintAECheck, PintAEException, SLA_HOURS_BY_SEVERITY } from '@/types/pintAE';
import { DataContext, Severity } from '@/types/compliance';
import { isCodeInCodelist } from '@/lib/pintAE/specCatalog';
import { assertExecutablePintAECheck, assertExecutablePintAERuleset } from './pintAEExecutionGuard';
import { RuleExecution } from '@/types/executionLedger';
import { DatasetType } from '@/types/datasets';
import { evaluateLineAmount } from './lineAmounts';
import { evaluateInvoiceNet, evaluateInvoiceGross, evaluatePayable, evaluateVatTotal, evaluateVatBreakdowns, suppliedBreakdowns } from './invoiceAmounts';

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

export function runPintAECheck(check: PintAECheck, data: DataContext): PintAEException[] {
  assertExecutablePintAECheck(check);
  return executePintAECheck(check, data);
}

function executePintAECheck(check: PintAECheck, data: DataContext): PintAEException[] {
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

    // Invoice-level decimal calculations. Missing comparison inputs never pass.
    case 'UAE-UC1-CHK-021':
    case 'UAE-UC1-CHK-025':
    case 'UAE-UC1-CHK-028':
    case 'UAE-UC1-CHK-029':
    case 'UAE-UC1-CHK-035':
      data.headers.forEach(header => {
        const lines = data.linesByInvoice.get(header.invoice_id) || [];
        const result = check.check_id.endsWith('021') ? evaluateInvoiceNet(header, lines)
          : check.check_id.endsWith('025') ? evaluateInvoiceGross(header)
          : check.check_id.endsWith('028') ? evaluateVatBreakdowns(header, lines)
          : check.check_id.endsWith('029') ? evaluateVatTotal(header) : evaluatePayable(header);
        if (result.matches || result.unevaluated) return;
        const field = check.check_id.endsWith('021') ? 'total_excl_vat'
          : check.check_id.endsWith('025') ? 'total_incl_vat'
          : check.check_id.endsWith('028') ? 'tax_breakdowns'
          : check.check_id.endsWith('029') ? 'vat_total' : 'amount_due';
        exceptions.push(createException({
          invoiceId: header.invoice_id, invoiceNumber: header.invoice_number,
          sellerTrn: header.seller_trn, buyerId: header.buyer_id, fieldName: field,
          observedValue: JSON.stringify(getFieldValue(header, field)),
          expectedValue: result.expected ?? result.reason,
          message: `Invoice ${header.invoice_number}: ${result.reason ?? `${field} must equal ${result.expected}`}`,
        }));
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

    // Line Net Amount Formula
    case 'UAE-UC1-CHK-034':
      data.lines.forEach(line => {
        const header = data.headerMap.get(line.invoice_id);
        const calculation = evaluateLineAmount(line);
        if (calculation.unevaluated) return;
        if (!calculation.matches) {
          exceptions.push(createException({
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            fieldName: 'line_total_excl_vat',
            observedValue: String(line.line_total_excl_vat),
            expectedValue: calculation.reason ?? calculation.expected!.toFixed(2),
            message: `Invoice ${header?.invoice_number}, Line ${line.line_number}: ${calculation.reason ?? `Net amount (${line.line_total_excl_vat}) differs from quantity × (net price / base quantity) + charges − allowances (${calculation.expected!.toFixed(2)})`}`,
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

    // A line category is not itself a supplied invoice VAT breakdown.
    case 'UAE-UC1-CHK-027':
      data.headers.forEach(header => {
        const breakdowns = suppliedBreakdowns(header);
        if (!Array.isArray(breakdowns) || !breakdowns.length) {
          exceptions.push(createException({
            invoiceId: header.invoice_id, invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn, buyerId: header.buyer_id,
            fieldName: 'tax_breakdowns', observedValue: 'missing',
            expectedValue: 'At least one supplied category breakdown',
            message: `Invoice ${header.invoice_number}: Missing supplied VAT breakdown`,
          }));
        }
      });
      break;

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

// Describe branches that do not establish a pass. The underlying check is still
// called so this ledger does not silently change the existing exception behavior.
function usesGenericExecutor(check: PintAECheck): boolean {
  return !/^UAE-UC1-CHK-(00[1-9]|0[12][0-9]|03[0-5])$/.test(check.check_id)
    || ['012', '014', '019', '033'].some(suffix => check.check_id === `UAE-UC1-CHK-${suffix}`);
}

function unevaluatedReason(check: PintAECheck, record: any, data: DataContext): 'notApplicable' | 'notEvaluated' | null {
  const params = check.parameters;
  const id = check.check_id;
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (id === 'UAE-UC1-CHK-007' && String(record.currency || '').toUpperCase() === String(params.tax_currency || 'AED').toUpperCase() && isEmpty(record.tax_currency)) return 'notApplicable';
  if (id === 'UAE-UC1-CHK-032' && !numeric(record.quantity)) return 'notEvaluated';
  if (id === 'UAE-UC1-CHK-008') {
    const currency = getFieldValue(record, resolveFieldAlias(params.currency_field || 'currency'));
    if (isEmpty(currency)) return 'notEvaluated';
    if (String(currency).toUpperCase() === String(params.base_currency || 'AED').toUpperCase()) return 'notApplicable';
    if (!numeric(getFieldValue(record, resolveFieldAlias(params.fx_field || 'fx_rate')))) return 'notEvaluated';
  }
  if (id === 'UAE-UC1-CHK-018' && isEmpty(record.buyer_trn)) return 'notApplicable';
  const optionalFormatField = id === 'UAE-UC1-CHK-003' ? params.field
    : id === 'UAE-UC1-CHK-006' ? params.field || 'currency'
    : id === 'UAE-UC1-CHK-013' ? 'seller_trn'
    : id === 'UAE-UC1-CHK-016' ? params.field || 'seller_subdivision' : undefined;
  if (optionalFormatField && isEmpty(getFieldValue(record, resolveFieldAlias(optionalFormatField)))) return 'notEvaluated';
  if (['022', '023', '024', '026'].some(suffix => id === `UAE-UC1-CHK-${suffix}`) && !numeric(getFieldValue(record, params.field))) return 'notEvaluated';
  const invoiceLines = data.linesByInvoice.get(record.invoice_id) || [];
  const monetary = id === 'UAE-UC1-CHK-021' ? evaluateInvoiceNet(record, invoiceLines)
    : id === 'UAE-UC1-CHK-025' ? evaluateInvoiceGross(record)
    : id === 'UAE-UC1-CHK-028' ? evaluateVatBreakdowns(record, invoiceLines)
    : id === 'UAE-UC1-CHK-029' ? evaluateVatTotal(record)
    : id === 'UAE-UC1-CHK-035' ? evaluatePayable(record) : undefined;
  if (monetary?.unevaluated) return 'notEvaluated';
  if (id === 'UAE-UC1-CHK-034' && ![record.quantity, record.unit_price, record.line_total_excl_vat, record.line_discount ?? 0, record.price_base_quantity ?? 1, record.line_allowance_amount ?? 0, record.line_charge_amount ?? 0].every(numeric)) return 'notEvaluated';
  if (id === 'UAE-UC1-CHK-009') {
    if (!numeric(record.amount_due)) return 'notEvaluated';
    if (!isEmpty(record.payment_due_date) && (Number.isNaN(Date.parse(record.payment_due_date)) || isEmpty(record.issue_date) || Number.isNaN(Date.parse(record.issue_date)))) return 'notEvaluated';
    if (record.amount_due <= 0 && isEmpty(record.payment_due_date)) return 'notApplicable';
  }
  if (usesGenericExecutor(check) && check.rule_type === 'CodeList' && isEmpty(getFieldValue(record, resolveFieldAlias(params.field)))) return 'notEvaluated';
  return null;
}

export function runAllPintAEChecks(checks: PintAECheck[], data: DataContext, options: {
  datasetType?: DatasetType;
  onExecution?: (execution: RuleExecution) => void;
} = {}): PintAEException[] {
  assertExecutablePintAERuleset(checks);
  const enabledChecks = checks.filter(c => c.is_enabled);
  const allExceptions: PintAEException[] = [];
  
  for (const check of enabledChecks) {
    // Party metadata includes both seller (header) and buyer records; mirror the
    // actual executor target rather than estimating from its display scope.
    const records = usesGenericExecutor(check) ? getDatasetForField(check.parameters.field, check.scope, data)
      : ['017', '018', '020'].some(suffix => check.check_id === `UAE-UC1-CHK-${suffix}`) ? data.buyers
      : ['031', '032', '034'].some(suffix => check.check_id === `UAE-UC1-CHK-${suffix}`) ? data.lines : data.headers;
    const dataset = records === data.lines ? 'lines' : records === data.buyers ? 'buyers' : 'headers';
    const execution: RuleExecution = {
      check: JSON.parse(JSON.stringify(check)), datasetType: options.datasetType || 'AR',
      evaluatedAt: new Date().toISOString(), engineVersion: 'uc1-execution-v3', status: 'not_evaluated',
      candidateCount: records.length, passed: 0, failed: 0, notApplicable: 0, notEvaluated: 0, errors: 0, exceptionCount: 0,
    };
    for (const record of records) {
      try {
        const findings = executePintAECheck(check, { ...data, [dataset]: [record] });
        allExceptions.push(...findings);
        execution.exceptionCount += findings.length;
        if (findings.length) execution.failed++;
        else {
          const skipped = unevaluatedReason(check, record, data);
          if (skipped) execution[skipped]++;
          else execution.passed++;
        }
      } catch (error) {
        execution.errors++;
        execution.notEvaluated += records.length - execution.passed - execution.failed - execution.notApplicable - execution.notEvaluated - execution.errors;
        execution.status = 'error';
        execution.reason = error instanceof Error ? error.message : 'Rule execution failed';
        options.onExecution?.(execution);
        throw error;
      }
    }
    execution.status = execution.failed ? 'fail' : execution.notEvaluated ? 'not_evaluated'
      : execution.passed ? 'pass' : execution.notApplicable ? 'not_applicable' : 'not_evaluated';
    if (!records.length) execution.reason = 'No candidate records';
    else if (execution.notEvaluated) execution.reason = 'Required evaluation inputs are absent or invalid';
    else if (execution.status === 'not_applicable') execution.reason = 'Current executor condition does not apply';
    options.onExecution?.(execution);
  }
  
  return allExceptions;
}
