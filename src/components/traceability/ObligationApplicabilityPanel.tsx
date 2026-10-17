import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleSlash2, FlaskConical } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  getRegulatoryObligations,
  type ObligationImplementationState,
} from '@/lib/registry/regulatoryObligationRegistry';
import { buildObligationApplicabilityReport } from '@/modules/scenarioContext/obligationApplicability';
import {
  buildObligationRuntimeComparison,
  type ObligationRuntimeComparisonStatus,
} from '@/modules/scenarioContext/obligationRuntimeComparison';
import type { ScenarioLensInvoice } from '@/modules/scenarioLens/types';
import type { Buyer } from '@/types/compliance';
import type { ValidationExecutionEvidence } from '@/types/validationExecution';
import { cn } from '@/lib/utils';

interface ObligationApplicabilityPanelProps {
  invoices: ScenarioLensInvoice[];
  buyers: Buyer[];
  preferredInvoiceId?: string | null;
  comparisonInvoices?: ScenarioLensInvoice[];
  validationExecutions?: ValidationExecutionEvidence[];
}

const STATE_STYLE = {
  applicable: { label: 'Applicable', icon: CheckCircle2, className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700' },
  not_applicable: { label: 'Not applicable', icon: CircleSlash2, className: 'border-muted-foreground/20 bg-muted text-muted-foreground' },
  unresolved: { label: 'Unresolved', icon: AlertCircle, className: 'border-amber-500/25 bg-amber-500/10 text-amber-700' },
} as const;

const IMPLEMENTATION_LABEL: Record<ObligationImplementationState, string> = {
  implemented: 'Implemented',
  partially_implemented: 'Partial',
  not_implemented: 'Not implemented',
  external_boundary: 'External boundary',
};

export function ObligationApplicabilityPanel({
  invoices,
  buyers,
  preferredInvoiceId,
  comparisonInvoices = invoices,
  validationExecutions = [],
}: ObligationApplicabilityPanelProps) {
  const initialInvoiceId = preferredInvoiceId && invoices.some((invoice) => invoice.invoiceId === preferredInvoiceId)
    ? preferredInvoiceId
    : invoices[0]?.invoiceId ?? '';
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoiceId);

  useEffect(() => {
    if (preferredInvoiceId && invoices.some((invoice) => invoice.invoiceId === preferredInvoiceId)) {
      setSelectedInvoiceId(preferredInvoiceId);
      return;
    }
    if (!invoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)) {
      setSelectedInvoiceId(invoices[0]?.invoiceId ?? '');
    }
  }, [invoices, preferredInvoiceId, selectedInvoiceId]);

  const selectedInvoice = invoices.find((invoice) => invoice.invoiceId === selectedInvoiceId) ?? invoices[0];
  const buyer = selectedInvoice
    ? buyers.find((candidate) => candidate.buyer_id === selectedInvoice.buyerId) ?? null
    : null;
  const report = useMemo(
    () => selectedInvoice
      ? buildObligationApplicabilityReport({
          header: selectedInvoice.header,
          lines: selectedInvoice.lines,
          buyer,
        })
      : null,
    [buyer, selectedInvoice]
  );
  const obligationById = useMemo(
    () => new Map(getRegulatoryObligations().map((entry) => [entry.termId, entry])),
    []
  );
  const runtimeComparison = useMemo(
    () => buildObligationRuntimeComparison(
      comparisonInvoices.map((invoice) => ({
        header: invoice.header,
        lines: invoice.lines,
        buyer: buyers.find((candidate) => candidate.buyer_id === invoice.buyerId) ?? null,
      })),
      validationExecutions
    ),
    [buyers, comparisonInvoices, validationExecutions]
  );

  return (
    <Card className="border border-primary/15 shadow-sm" data-testid="obligation-applicability-panel">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Obligation applicability review</h2>
              <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/5 text-primary">
                <FlaskConical className="h-3 w-3" /> Shadow · non-authoritative
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-3xl">
              Review how DCS interprets registered PINT-AE obligations for one invoice. These decisions do not affect validation, readiness, or upload blocking.
            </p>
          </div>
          <label className="flex min-w-[260px] flex-col gap-1 text-xs font-medium text-muted-foreground">
            Invoice context
            <select
              aria-label="Invoice context"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={selectedInvoice?.invoiceId ?? ''}
              onChange={(event) => setSelectedInvoiceId(event.target.value)}
              disabled={invoices.length === 0}
            >
              {invoices.length === 0 ? <option value="">No invoice data available</option> : null}
              {invoices.map((invoice) => (
                <option key={invoice.invoiceId} value={invoice.invoiceId}>
                  {invoice.invoiceNumber || invoice.invoiceId}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!report ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Upload invoice data to review obligation applicability.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3" aria-label="Shadow applicability summary">
              <Summary label="Applicable" value={report.summary.applicable} className="text-emerald-700" />
              <Summary label="Not applicable" value={report.summary.not_applicable} className="text-muted-foreground" />
              <Summary label="Unresolved" value={report.summary.unresolved} className="text-amber-700" />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[940px] text-xs">
                <thead className="border-b bg-muted/35 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Obligation</th>
                    <th className="px-3 py-2 text-left font-medium">Decision</th>
                    <th className="px-3 py-2 text-left font-medium">Responsibility</th>
                    <th className="px-3 py-2 text-left font-medium">Implementation</th>
                    <th className="px-3 py-2 text-left font-medium">Reason and evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.decisions.map((item) => {
                    const obligation = obligationById.get(item.termId);
                    const style = STATE_STYLE[item.state];
                    const Icon = style.icon;
                    return (
                      <tr key={item.termId} className="border-b last:border-0 align-top">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-foreground">{item.termId}</div>
                          <div className="mt-0.5 text-muted-foreground">{obligation?.businessTerm}</div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={cn('gap-1 whitespace-nowrap', style.className)}>
                            <Icon className="h-3 w-3" /> {style.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{formatToken(obligation?.responsibility)}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {obligation ? IMPLEMENTATION_LABEL[obligation.implementationState] : 'Unknown'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-foreground">{item.reason}</div>
                          <div className="mt-1 text-muted-foreground">
                            Evidence: {item.evidenceFields.length ? item.evidenceFields.join(', ') : 'registry definition'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/10 p-4" data-testid="runtime-comparison">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Shadow/runtime comparison</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Population-level comparison across {runtimeComparison.invoiceCount} loaded invoice(s). Runtime evidence is aggregated by rule, so this does not assert invoice-level causality.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(runtimeComparison.summary) as Array<[ObligationRuntimeComparisonStatus, number]>).map(([status, count]) => (
                  <Badge key={status} variant="outline" className={cn('text-xs', comparisonClass(status))}>
                    {comparisonLabel(status)}: {count}
                  </Badge>
                ))}
              </div>
              <div className="space-y-2">
                {runtimeComparison.rows.filter((row) => row.status !== 'aligned').map((row) => (
                  <div key={row.termId} className="flex flex-col gap-1 rounded-md border bg-background p-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="font-semibold text-foreground">{row.termId}</span>
                      <span className="ml-2 text-muted-foreground">{row.businessTerm}</span>
                      <p className="mt-1 text-muted-foreground">{row.reason}</p>
                    </div>
                    <Badge variant="outline" className={cn('w-fit whitespace-nowrap', comparisonClass(row.status))}>
                      {comparisonLabel(row.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold', className)}>{value}</div>
    </div>
  );
}

function formatToken(value?: string): string {
  if (!value) return 'Unknown';
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function comparisonLabel(status: ObligationRuntimeComparisonStatus): string {
  const labels: Record<ObligationRuntimeComparisonStatus, string> = {
    aligned: 'Aligned',
    applicable_not_evaluated: 'Applicable · not evaluated',
    not_applicable_but_evaluated: 'Outside shadow scope · evaluated',
    unsupported: 'No runtime rule',
    policy_review: 'Policy review',
  };
  return labels[status];
}

function comparisonClass(status: ObligationRuntimeComparisonStatus): string {
  if (status === 'aligned') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700';
  if (status === 'policy_review') return 'border-blue-500/25 bg-blue-500/10 text-blue-700';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-700';
}
