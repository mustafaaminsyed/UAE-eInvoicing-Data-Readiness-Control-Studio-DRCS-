import { ComplianceCheck, DataContext, Exception, CheckResult, InvoiceHeader } from '@/types/compliance';
import { EvidenceRuleExecutionTelemetryRow } from '@/types/evidence';
import { Direction } from '@/types/direction';
import { ValidationExecutionEvidence } from '@/types/validationExecution';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// TRN validation regex (UAE format: 15 digits)
const TRN_REGEX = /^\d{15}$/;

function resolveLineAllowance(dataLine: DataContext['lines'][number]): number {
  return dataLine.line_allowance_amount ?? dataLine.line_discount ?? 0;
}

function getReverseChargeBuyerIds(data: DataContext): Set<string> {
  const ids = new Set<string>();
  data.lines.forEach((line) => {
    const category = String(line.tax_category_code || '').trim().toUpperCase();
    if (!['AE', 'RC', 'REVERSE_CHARGE'].includes(category)) return;
    const buyerId = data.headerMap.get(line.invoice_id)?.buyer_id;
    if (buyerId) ids.add(buyerId);
  });
  return ids;
}

export const checksRegistry: ComplianceCheck[] = [
  {
    id: 'buyer_trn_missing',
    name: 'Buyer TRN Missing',
    description: 'Requires Buyer TRN only when a deterministic source-data condition establishes applicability',
    severity: 'Critical',
    category: 'buyer',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      const requiredBuyerIds = getReverseChargeBuyerIds(data);
      data.buyers.forEach(buyer => {
        if (requiredBuyerIds.has(buyer.buyer_id) && (!buyer.buyer_trn || buyer.buyer_trn.trim() === '')) {
          exceptions.push({
            id: generateId(),
            checkId: 'buyer_trn_missing',
            checkName: 'Buyer TRN Missing',
            severity: 'Critical',
            message: `Buyer "${buyer.buyer_name}" (ID: ${buyer.buyer_id}) is missing the TRN required for reverse-charge treatment (IBR-103-AE)`,
            buyerId: buyer.buyer_id,
            field: 'buyer_trn',
            actualValue: buyer.buyer_trn || '(empty)',
          });
        }
      });
      return exceptions;
    },
  },
  {
    id: 'buyer_trn_invalid_format',
    name: 'Buyer TRN Invalid Format',
    description: 'Validates TRN format (15 digits for UAE)',
    severity: 'High',
    category: 'buyer',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      data.buyers.forEach(buyer => {
        if (buyer.buyer_trn && buyer.buyer_trn.trim() !== '' && !TRN_REGEX.test(buyer.buyer_trn)) {
          exceptions.push({
            id: generateId(),
            checkId: 'buyer_trn_invalid_format',
            checkName: 'Buyer TRN Invalid Format',
            severity: 'High',
            message: `Buyer "${buyer.buyer_name}" has invalid TRN format: ${buyer.buyer_trn}`,
            buyerId: buyer.buyer_id,
            field: 'buyer_trn',
            expectedValue: '15-digit number',
            actualValue: buyer.buyer_trn,
          });
        }
      });
      return exceptions;
    },
  },
  {
    id: 'duplicate_invoice_number',
    name: 'Duplicate Invoice Number',
    description: 'Checks for duplicate invoice numbers per seller TRN',
    severity: 'Critical',
    category: 'header',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      const invoicesBySellerAndNumber = new Map<string, InvoiceHeader[]>();
      
      data.headers.forEach(header => {
        const key = `${header.seller_trn}|${header.invoice_number}`;
        if (!invoicesBySellerAndNumber.has(key)) {
          invoicesBySellerAndNumber.set(key, []);
        }
        invoicesBySellerAndNumber.get(key)!.push(header);
      });

      invoicesBySellerAndNumber.forEach((invoices, key) => {
        if (invoices.length > 1) {
          invoices.forEach(invoice => {
            exceptions.push({
              id: generateId(),
              checkId: 'duplicate_invoice_number',
              checkName: 'Duplicate Invoice Number',
              severity: 'Critical',
              message: `Duplicate invoice number "${invoice.invoice_number}" for seller ${invoice.seller_trn}`,
              invoiceId: invoice.invoice_id,
              invoiceNumber: invoice.invoice_number,
              sellerTrn: invoice.seller_trn,
              field: 'invoice_number',
              actualValue: `${invoices.length} occurrences`,
            });
          });
        }
      });
      return exceptions;
    },
  },
  {
    id: 'header_totals_mismatch',
    name: 'Header Totals Mismatch',
    description: 'Validates total_incl_vat = total_excl_vat + vat_total',
    severity: 'Critical',
    category: 'header',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      data.headers.forEach(header => {
        if (header.total_incl_vat !== undefined && 
            header.total_excl_vat !== undefined && 
            header.vat_total !== undefined) {
          const expected = header.total_excl_vat + header.vat_total;
          const diff = Math.abs(header.total_incl_vat - expected);
          if (diff > 0.01) {
            exceptions.push({
              id: generateId(),
              checkId: 'header_totals_mismatch',
              checkName: 'Header Totals Mismatch',
              severity: 'Critical',
              message: `Invoice ${header.invoice_number}: total_incl_vat (${header.total_incl_vat}) != total_excl_vat (${header.total_excl_vat}) + vat_total (${header.vat_total})`,
              invoiceId: header.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              field: 'total_incl_vat',
              expectedValue: expected,
              actualValue: header.total_incl_vat,
            });
          }
        }
      });
      return exceptions;
    },
  },
  {
    id: 'line_totals_mismatch',
    name: 'Line Totals Mismatch',
    description: 'Validates line_total_excl_vat = (quantity * unit_price) - line allowance/discount',
    severity: 'High',
    category: 'line',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      data.lines.forEach(line => {
        const allowance = resolveLineAllowance(line);
        const expected = (line.quantity * line.unit_price) - allowance;
        const diff = Math.abs(line.line_total_excl_vat - expected);
        if (diff > 0.01) {
          const header = data.headerMap.get(line.invoice_id);
          exceptions.push({
            id: generateId(),
            checkId: 'line_totals_mismatch',
            checkName: 'Line Totals Mismatch',
            severity: 'High',
            message: `Line ${line.line_number}: line_total_excl_vat (${line.line_total_excl_vat}) != (${line.quantity} * ${line.unit_price}) - ${allowance}`,
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            lineNumber: line.line_number,
            field: 'line_total_excl_vat',
            expectedValue: expected,
            actualValue: line.line_total_excl_vat,
          });
        }
      });
      return exceptions;
    },
  },
  {
    id: 'vat_calc_mismatch',
    name: 'VAT Calculation Mismatch',
    description: 'Validates vat_amount = line_total_excl_vat * vat_rate',
    severity: 'High',
    category: 'line',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      data.lines.forEach(line => {
        const expected = line.line_total_excl_vat * (line.vat_rate / 100);
        const diff = Math.abs(line.vat_amount - expected);
        if (diff > 0.01) {
          const header = data.headerMap.get(line.invoice_id);
          exceptions.push({
            id: generateId(),
            checkId: 'vat_calc_mismatch',
            checkName: 'VAT Calculation Mismatch',
            severity: 'High',
            message: `Line ${line.line_number}: vat_amount (${line.vat_amount}) != line_total_excl_vat (${line.line_total_excl_vat}) * vat_rate/100 (${line.vat_rate}/100)`,
            invoiceId: line.invoice_id,
            invoiceNumber: header?.invoice_number,
            sellerTrn: header?.seller_trn,
            buyerId: header?.buyer_id,
            lineId: line.line_id,
            lineNumber: line.line_number,
            field: 'vat_amount',
            expectedValue: expected.toFixed(2),
            actualValue: line.vat_amount,
          });
        }
      });
      return exceptions;
    },
  },
  {
    id: 'negative_without_credit_note',
    name: 'Negative Value Without Credit Note',
    description: 'Flags negative line totals on non-credit note invoices',
    severity: 'Critical',
    category: 'line',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      data.lines.forEach(line => {
        if (line.line_total_excl_vat < 0) {
          const header = data.headerMap.get(line.invoice_id);
          if (header && header.invoice_type !== 'CREDIT_NOTE') {
            exceptions.push({
              id: generateId(),
              checkId: 'negative_without_credit_note',
              checkName: 'Negative Value Without Credit Note',
              severity: 'Critical',
              message: `Line ${line.line_number} has negative total (${line.line_total_excl_vat}) but invoice type is "${header.invoice_type || 'not specified'}"`,
              invoiceId: line.invoice_id,
              invoiceNumber: header?.invoice_number,
              sellerTrn: header?.seller_trn,
              buyerId: header?.buyer_id,
              lineId: line.line_id,
              lineNumber: line.line_number,
              field: 'line_total_excl_vat',
              expectedValue: 'CREDIT_NOTE invoice type',
              actualValue: header.invoice_type || 'not specified',
            });
          }
        }
      });
      return exceptions;
    },
  },
  {
    id: 'buyer_not_found',
    name: 'Buyer ID Missing or Not Found',
    description: 'Validates buyer_id exists and is found in buyers file',
    severity: 'Critical',
    category: 'cross-file',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      data.headers.forEach(header => {
        if (!header.buyer_id || header.buyer_id.trim() === '') {
          exceptions.push({
            id: generateId(),
            checkId: 'buyer_not_found',
            checkName: 'Buyer ID Missing or Not Found',
            severity: 'Critical',
            message: `Invoice ${header.invoice_number}: buyer_id is missing`,
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            field: 'buyer_id',
            actualValue: '(empty)',
          });
        } else if (!data.buyerMap.has(header.buyer_id)) {
          exceptions.push({
            id: generateId(),
            checkId: 'buyer_not_found',
            checkName: 'Buyer ID Missing or Not Found',
            severity: 'Critical',
            message: `Invoice ${header.invoice_number}: buyer_id "${header.buyer_id}" not found in buyers file`,
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            field: 'buyer_id',
            actualValue: header.buyer_id,
          });
        }
      });
      return exceptions;
    },
  },
  {
    id: 'missing_mandatory_fields',
    name: 'Missing Mandatory Header Fields',
    description: 'Checks for required fields: invoice_id, invoice_number, issue_date, seller_trn, currency',
    severity: 'Critical',
    category: 'header',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      const mandatoryFields = ['invoice_id', 'invoice_number', 'issue_date', 'seller_trn', 'currency'];
      
      data.headers.forEach(header => {
        mandatoryFields.forEach(field => {
          const value = (header as any)[field];
          if (value === undefined || value === null || String(value).trim() === '') {
            exceptions.push({
              id: generateId(),
              checkId: 'missing_mandatory_fields',
              checkName: 'Missing Mandatory Header Fields',
              severity: 'Critical',
              message: `Invoice ${header.invoice_number || header.invoice_id}: missing mandatory field "${field}"`,
              invoiceId: header.invoice_id,
              invoiceNumber: header.invoice_number,
              sellerTrn: header.seller_trn,
              buyerId: header.buyer_id,
              field: field,
              expectedValue: 'non-empty value',
              actualValue: value || '(empty)',
            });
          }
        });
      });
      return exceptions;
    },
  },
  {
    id: 'mixed_vat_rates_no_total',
    name: 'Mixed VAT Rates Without VAT Total',
    description: 'Warns when invoice has multiple VAT rates but vat_total is missing or zero',
    severity: 'Medium',
    category: 'cross-file',
    run: (data: DataContext): Exception[] => {
      const exceptions: Exception[] = [];
      
      data.headers.forEach(header => {
        const lines = data.linesByInvoice.get(header.invoice_id) || [];
        const vatRates = new Set(lines.map(l => l.vat_rate));
        const hasTaxableBase = lines.some(l => l.line_total_excl_vat > 0);
        
        if (vatRates.size > 1 && hasTaxableBase && (!header.vat_total || header.vat_total === 0)) {
          exceptions.push({
            id: generateId(),
            checkId: 'mixed_vat_rates_no_total',
            checkName: 'Mixed VAT Rates Without VAT Total',
            severity: 'Medium',
            message: `Invoice ${header.invoice_number} has ${vatRates.size} different VAT rates but vat_total is ${header.vat_total || 0}`,
            invoiceId: header.invoice_id,
            invoiceNumber: header.invoice_number,
            sellerTrn: header.seller_trn,
            buyerId: header.buyer_id,
            field: 'vat_total',
            expectedValue: 'non-zero when multiple VAT rates exist',
            actualValue: header.vat_total || 0,
          });
        }
      });
      return exceptions;
    },
  },
];

export function runAllChecks(data: DataContext): CheckResult[] {
  return checksRegistry.map(check => {
    const exceptions = check.run(data);
    const totalRecords = check.id === 'buyer_trn_missing'
      ? data.buyers.filter((buyer) => Boolean(buyer.buyer_trn?.trim()) || getReverseChargeBuyerIds(data).has(buyer.buyer_id)).length
      : check.category === 'buyer'
      ? data.buyers.length 
      : check.category === 'line' 
        ? data.lines.length 
        : data.headers.length;
    
    return {
      checkId: check.id,
      checkName: check.name,
      severity: check.severity,
      passed: totalRecords - exceptions.length,
      failed: exceptions.length,
      exceptions,
    };
  });
}

export function runAllChecksWithTelemetry(
  data: DataContext,
  direction: Direction = 'AR'
): { checkResults: CheckResult[]; telemetry: EvidenceRuleExecutionTelemetryRow[]; executionEvidence: ValidationExecutionEvidence[] } {
  const checkResults = runAllChecks(data);
  const reverseChargeBuyerIds = getReverseChargeBuyerIds(data);
  const telemetry = checksRegistry.map((check) => {
    const result = checkResults.find((entry) => entry.checkId === check.id);
    const candidateCount = check.category === 'buyer'
        ? data.buyers.length
        : check.category === 'line'
          ? data.lines.length
          : data.headers.length;
    const executionCount = check.id === 'buyer_trn_missing'
      ? data.buyers.filter((buyer) => Boolean(buyer.buyer_trn?.trim()) || reverseChargeBuyerIds.has(buyer.buyer_id)).length
      : candidateCount;
    const notEvaluatedCount = check.id === 'buyer_trn_missing'
      ? Math.max(candidateCount - executionCount, 0)
      : 0;

    return {
      rule_id: check.id,
      execution_count: executionCount,
      failure_count: result?.failed ?? 0,
      execution_source: 'runtime' as const,
      direction,
      control_class: 'supplementary_data_readiness' as const,
      layer: 'core' as const,
      candidate_count: candidateCount,
      applicable_count: executionCount + notEvaluatedCount,
      passed_count: Math.max(executionCount - (result?.failed ?? 0), 0),
      not_applicable_count: 0,
      not_evaluated_count: notEvaluatedCount,
      applicability_reason: check.id === 'buyer_trn_missing' && notEvaluatedCount > 0
        ? 'Buyer VAT-registration applicability cannot be established from the supplied source data'
        : undefined,
    };
  });

  const executionEvidence: ValidationExecutionEvidence[] = telemetry.map((row) => {
    const check = checksRegistry.find((item) => item.id === row.rule_id)!;
    const applicableCount = row.applicable_count ?? row.execution_count;
    const notEvaluatedCount = row.not_evaluated_count ?? 0;
    const passedCount = row.passed_count ?? Math.max(row.execution_count - row.failure_count, 0);
    return {
      ruleId: row.rule_id,
      ruleName: check.name,
      controlClass: 'supplementary_data_readiness',
      layer: 'core',
      direction,
      registered: true,
      candidateCount: row.candidate_count ?? applicableCount,
      applicableCount,
      notApplicableCount: row.not_applicable_count ?? 0,
      evaluatedCount: row.execution_count,
      passedCount,
      failedCount: row.failure_count,
      notEvaluatedCount,
      applicability: applicableCount > 0 ? 'applicable' : 'undetermined',
      evaluation: row.execution_count > 0 ? 'evaluated' : 'not_evaluated',
      outcome: row.failure_count > 0 ? 'fail' : notEvaluatedCount > 0 ? 'not_evaluated' : 'pass',
      applicabilityReason: row.applicability_reason,
      executionSource: 'runtime',
    };
  });

  return { checkResults, telemetry, executionEvidence };
}
