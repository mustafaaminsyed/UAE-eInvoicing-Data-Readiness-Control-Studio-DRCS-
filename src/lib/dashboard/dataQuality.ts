import type { DashboardRecord } from './types';

export const MANDATORY_HEADER_FIELDS = ['invoice_id', 'invoice_number', 'issue_date', 'invoice_type', 'currency', 'buyer_id'];
export const MANDATORY_BUYER_FIELDS = ['buyer_id', 'buyer_name', 'buyer_country'];
export const MANDATORY_LINE_FIELDS = ['line_id', 'line_number', 'description', 'quantity', 'unit_price', 'line_total_excl_vat'];

export function toRecords(input: unknown): DashboardRecord[] {
  return Array.isArray(input) ? (input as DashboardRecord[]) : [];
}

export function presentValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function computeCompleteness(records: DashboardRecord[], fields: string[]) {
  if (records.length === 0 || fields.length === 0) return 0;
  let present = 0;
  records.forEach((record) => {
    fields.forEach((field) => {
      if (presentValue(record[field])) present += 1;
    });
  });
  return (present / (records.length * fields.length)) * 100;
}

export function computeNullFieldRate(groups: Array<{ records: DashboardRecord[]; fields: string[] }>) {
  let totalSlots = 0;
  let emptySlots = 0;

  groups.forEach(({ records, fields }) => {
    records.forEach((record) => {
      fields.forEach((field) => {
        totalSlots += 1;
        if (!presentValue(record[field])) emptySlots += 1;
      });
    });
  });

  if (totalSlots === 0) return 0;
  return (emptySlots / totalSlots) * 100;
}

export function computeConditionalCoverage(headers: DashboardRecord[], buyers: DashboardRecord[]) {
  const requirements: Array<{ present: boolean; expected: number }> = [];
  let qualifyingDocumentCount = 0;

  headers.forEach((header) => {
    const amountDue = Number(header.amount_due ?? 0);
    const currency = String(header.currency ?? '').trim().toUpperCase();
    const invoiceType = String(header.invoice_type ?? '').trim();
    const creditReason = String(header.credit_note_reason_code ?? '').trim().toUpperCase();
    const documentTriggersConditionalFields = amountDue > 0 || (currency !== '' && currency !== 'AED') || invoiceType === '381';

    if (documentTriggersConditionalFields) {
      qualifyingDocumentCount += 1;
    }

    if (amountDue > 0) {
      requirements.push({ present: presentValue(header.payment_due_date), expected: 1 });
    }

    if (currency && currency !== 'AED') {
      requirements.push({ present: presentValue(header.fx_rate), expected: 1 });
      requirements.push({ present: String(header.tax_currency ?? '').trim().toUpperCase() === 'AED', expected: 1 });
    }

    if (invoiceType === '381') {
      requirements.push({ present: presentValue(header.credit_note_reason_code), expected: 1 });
      requirements.push({ present: presentValue(header.credit_note_reason_text), expected: 1 });
      if (creditReason !== 'VD') {
        requirements.push({ present: presentValue(header.preceding_invoice_reference), expected: 1 });
        requirements.push({ present: presentValue(header.preceding_invoice_issue_date), expected: 1 });
      }
    }
  });

  buyers.forEach((buyer) => {
    if (presentValue(buyer.buyer_name)) {
      requirements.push({ present: presentValue(buyer.buyer_trn), expected: 1 });
    }
  });

  const totalExpected = requirements.reduce((sum, item) => sum + item.expected, 0);
  const presentExpected = requirements.filter((item) => item.present).length;

  return {
    completeness: totalExpected === 0 ? 100 : (presentExpected / totalExpected) * 100,
    qualifyingDocumentCount,
  };
}

export function computeDuplicateInvoiceRatio(headers: DashboardRecord[]) {
  if (headers.length === 0) return 0;
  const counts = new Map<string, number>();
  headers.forEach((header) => {
    const key = String(header.invoice_number ?? header.invoice_id ?? '').trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const duplicates = Array.from(counts.values()).reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
  return (duplicates / headers.length) * 100;
}

export function computeCurrencyMismatchCount(headers: DashboardRecord[]) {
  return headers.filter((header) => {
    const currency = String(header.currency ?? '').trim().toUpperCase();
    const taxCurrency = String(header.tax_currency ?? '').trim().toUpperCase();
    const fxRate = Number(header.fx_rate ?? 0);

    if (!currency) return false;
    if (currency === 'AED') return taxCurrency !== '' && taxCurrency !== 'AED';
    return taxCurrency !== 'AED' || !Number.isFinite(fxRate) || fxRate <= 0;
  }).length;
}

export function computeCreditNoteCoverage(headers: DashboardRecord[]) {
  const creditNotes = headers.filter((header) => String(header.invoice_type ?? '').trim() === '381');
  if (creditNotes.length === 0) {
    return {
      count: 0,
      coverage: 100,
      reasonCoverage: 100,
      reasonTextCoverage: 100,
      referenceCoverage: 100,
      issueDateCoverage: 100,
    };
  }

  let satisfied = 0;
  let reasonPresent = 0;
  let reasonTextPresent = 0;
  let referenceRequired = 0;
  let referencePresent = 0;
  let issueDateRequired = 0;
  let issueDatePresent = 0;

  creditNotes.forEach((header) => {
    const reason = String(header.credit_note_reason_code ?? '').trim().toUpperCase();
    const hasReason = reason !== '';
    const hasReasonText = presentValue(header.credit_note_reason_text);
    const hasReference = presentValue(header.preceding_invoice_reference);
    const hasIssueDate = presentValue(header.preceding_invoice_issue_date);

    if (hasReason) reasonPresent += 1;
    if (hasReasonText) reasonTextPresent += 1;
    if (reason !== 'VD') {
      referenceRequired += 1;
      if (hasReference) referencePresent += 1;
      issueDateRequired += 1;
      if (hasIssueDate) issueDatePresent += 1;
    }

    if (hasReason && hasReasonText && (reason === 'VD' || (hasReference && hasIssueDate))) satisfied += 1;
  });

  return {
    count: creditNotes.length,
    coverage: (satisfied / creditNotes.length) * 100,
    reasonCoverage: (reasonPresent / creditNotes.length) * 100,
    reasonTextCoverage: (reasonTextPresent / creditNotes.length) * 100,
    referenceCoverage: referenceRequired === 0 ? 100 : (referencePresent / referenceRequired) * 100,
    issueDateCoverage: issueDateRequired === 0 ? 100 : (issueDatePresent / issueDateRequired) * 100,
  };
}
