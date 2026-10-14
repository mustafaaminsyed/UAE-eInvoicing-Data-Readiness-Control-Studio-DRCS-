import type { Severity } from '@/types/compliance';

import { formatNumber } from './scoring';
import type { DashboardException, ExceptionBreakdownItem } from './types';

export function computeInvalidCodelistCount(exceptions: DashboardException[]) {
  const codelistTerms = ['codelist', 'code', 'iso3166', 'uncl', 'unece', 'currency', 'payment means'];
  return exceptions.filter((exception) => {
    const haystack = `${exception.checkName} ${exception.message} ${exception.checkId}`.toLowerCase();
    return codelistTerms.some((term) => haystack.includes(term));
  }).length;
}

export function deriveExceptionThemes(exceptions: DashboardException[]) {
  const masterData = exceptions.filter((exception) => {
    const text = `${exception.checkName} ${exception.message}`.toLowerCase();
    return text.includes('seller') || text.includes('buyer') || text.includes('counterparty') || text.includes('trn');
  }).length;

  const taxData = exceptions.filter((exception) => {
    const text = `${exception.checkName} ${exception.message}`.toLowerCase();
    return text.includes('vat') || text.includes('tax') || text.includes('currency');
  }).length;

  const documentShape = Math.max(exceptions.length - masterData - taxData, 0);

  return [
    {
      title: 'Master data breaks',
      value: formatNumber(masterData),
      subtitle: 'Counterparty and registration-quality issues',
    },
    {
      title: 'Tax / currency issues',
      value: formatNumber(taxData),
      subtitle: 'VAT, codelist, and currency-control exceptions',
    },
    {
      title: 'Document structure issues',
      value: formatNumber(documentShape),
      subtitle: 'Invoice-shape, mandatory-field, and sequencing issues',
    },
  ];
}

export function buildBlockingIssues(exceptions: DashboardException[]) {
  const grouped = new Map<
    string,
    ExceptionBreakdownItem & {
      invoiceIds: Set<string>;
    }
  >();
  const severityRank: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

  exceptions.forEach((exception) => {
    const existing = grouped.get(exception.checkId);
    if (!existing) {
      grouped.set(exception.checkId, {
        key: exception.checkId,
        label: exception.checkName,
        count: 1,
        affectedInvoices: exception.invoiceId ? 1 : 0,
        hasInvoiceCoverage: Boolean(exception.invoiceId),
        severity: exception.severity,
        description: exception.message,
        invoiceIds: new Set(exception.invoiceId ? [exception.invoiceId] : []),
      });
      return;
    }

    existing.count += 1;
    if (exception.invoiceId) {
      existing.invoiceIds.add(exception.invoiceId);
      existing.affectedInvoices = existing.invoiceIds.size;
      existing.hasInvoiceCoverage = true;
    }
    if (severityRank[exception.severity] > severityRank[existing.severity]) {
      existing.severity = exception.severity;
    }
  });

  return Array.from(grouped.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}
