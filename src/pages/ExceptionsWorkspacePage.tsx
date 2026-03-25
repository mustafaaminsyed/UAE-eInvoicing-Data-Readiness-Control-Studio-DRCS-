import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CircleAlert,
  FolderKanban,
  Link2,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExplanationPackPanel } from '@/components/explanations/ExplanationPackPanel';
import { generateValidationExplanation } from '@/lib/api/validationExplainApi';
import { cn } from '@/lib/utils';
import type { Exception } from '@/types/compliance';
import type { Severity } from '@/types/compliance';
import type { ValidationExplanation } from '@/types/validationExplain';

type ExceptionStatus = 'Open' | 'In progress' | 'Resolved';

interface ExceptionWorkspaceItem {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  entity: string;
  status: ExceptionStatus;
  owner?: string;
  description: string;
  whyItMatters: string;
  impactedFields: string[];
  impactedRecords: string[];
  nextAction: string;
  dataTwinReference: string;
}

const EXCEPTION_RECORDS: ExceptionWorkspaceItem[] = [
  {
    id: 'EXC-10428',
    ruleId: 'UAE-UC1-CHK-012',
    ruleName: 'Seller identity completeness',
    severity: 'Critical',
    entity: 'Dariba Retail LLC',
    status: 'Open',
    owner: 'Amina Saleh',
    description: 'Seller registration details are incomplete for a subset of outbound invoices in the March submission.',
    whyItMatters: 'Missing seller identity data can block acceptance, weaken evidence narratives, and create repeat validation churn.',
    impactedFields: ['seller_name', 'seller_trn', 'seller_address'],
    impactedRecords: ['INV-10428', 'INV-10432', 'INV-10491'],
    nextAction: 'Validate the seller master data extract and republish the missing identity values before the next run.',
    dataTwinReference: 'Open invoice lineage for INV-10428 to inspect source-to-rule context.',
  },
  {
    id: 'EXC-10411',
    ruleId: 'UAE-UC1-CHK-018',
    ruleName: 'Buyer TRN format',
    severity: 'High',
    entity: 'Dariba Retail LLC',
    status: 'In progress',
    owner: 'Farah Khan',
    description: 'Buyer tax registration values are malformed for a group of retail invoices sourced from one ERP channel.',
    whyItMatters: 'Invalid registration identifiers increase rejection risk and make buyer traceability harder to defend.',
    impactedFields: ['buyer_trn', 'buyer_id'],
    impactedRecords: ['INV-10411', 'INV-10476'],
    nextAction: 'Coordinate with the owning team to normalize buyer registration values and confirm the correct format policy.',
    dataTwinReference: 'Review the buyer identity node and mapping stage for INV-10411 in the Data Twin workspace.',
  },
  {
    id: 'EXC-10405',
    ruleId: 'UAE-UC1-CHK-031',
    ruleName: 'VAT amount reconciliation',
    severity: 'High',
    entity: 'Al Noor Trading',
    status: 'Open',
    owner: 'Yousef Rahman',
    description: 'Calculated VAT amounts do not reconcile between header totals and line-level math for selected invoices.',
    whyItMatters: 'Tax reconciliation failures can create filing risk and usually indicate either mapping drift or incorrect source math.',
    impactedFields: ['vat_total', 'vat_amount', 'line_total_excl_vat'],
    impactedRecords: ['INV-10405', 'INV-10454'],
    nextAction: 'Compare line calculations against the mapping profile to determine whether the mismatch is source-driven or transformation-driven.',
    dataTwinReference: 'Inspect the calculation lineage path for INV-10405 to isolate where VAT drift is introduced.',
  },
  {
    id: 'EXC-10377',
    ruleId: 'UAE-UC1-CHK-037',
    ruleName: 'Tax category coherence',
    severity: 'Medium',
    entity: 'Al Noor Trading',
    status: 'Resolved',
    owner: 'Lina Haddad',
    description: 'Tax category codes were not aligned to the intended VAT treatment for a small scenario subset.',
    whyItMatters: 'Tax category inconsistencies reduce explainability and can leave evidence packs with unclear tax treatment narratives.',
    impactedFields: ['tax_category_code', 'vat_rate', 'invoice_type'],
    impactedRecords: ['INV-10377', 'INV-10420'],
    nextAction: 'Keep the corrected mapping guidance in place and monitor for recurrence after the next dataset intake.',
    dataTwinReference: 'Reference the resolved rule path for INV-10377 to confirm the corrected category mapping.',
  },
  {
    id: 'EXC-10288',
    ruleId: 'UAE-UC1-CHK-044',
    ruleName: 'Line net total math',
    severity: 'High',
    entity: 'Mena Distribution',
    status: 'In progress',
    owner: 'Hassan Omar',
    description: 'Line net totals do not reconcile cleanly with quantity, unit price, and discount values for discount-heavy invoices.',
    whyItMatters: 'Line-level math issues undermine total accuracy and create avoidable exception noise downstream.',
    impactedFields: ['quantity', 'unit_price', 'line_discount', 'line_total_excl_vat'],
    impactedRecords: ['INV-10288', 'INV-10302'],
    nextAction: 'Confirm the intended discount calculation order and align the transformation rule to the governed pricing logic.',
    dataTwinReference: 'Use the Data Twin view to compare source pricing fields against mapped invoice line totals.',
  },
  {
    id: 'EXC-10192',
    ruleId: 'UAE-UC1-CHK-052',
    ruleName: 'Duplicate invoice number detection',
    severity: 'Medium',
    entity: 'Mena Distribution',
    status: 'Resolved',
    owner: 'Operations queue',
    description: 'A duplicate invoice identifier was detected across two intake batches before validation packaging.',
    whyItMatters: 'Duplicate identifiers confuse triage and evidence generation, even when the underlying records are otherwise healthy.',
    impactedFields: ['invoice_number', 'seller_trn'],
    impactedRecords: ['INV-10192'],
    nextAction: 'Maintain the submission controls that now block duplicate invoice numbers during intake review.',
    dataTwinReference: 'Reference the lineage comparison for INV-10192 to confirm the duplicate path has been retired.',
  },
];

function getExceptionStatusClasses(status: ExceptionStatus) {
  if (status === 'Resolved') return 'border-success/25 bg-success/10 text-success';
  if (status === 'In progress') return 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium';
  return 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical';
}

export default function ExceptionsWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(
    EXCEPTION_RECORDS[0]?.id ?? null
  );
  const [selectedExplanation, setSelectedExplanation] = useState<ValidationExplanation | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [explanationDialogOpen, setExplanationDialogOpen] = useState(false);
  const twinInvoice = searchParams.get('invoice')?.trim() || null;
  const twinField = searchParams.get('field')?.trim() || null;

  const entities = useMemo(
    () => ['all', ...Array.from(new Set(EXCEPTION_RECORDS.map((exception) => exception.entity)))],
    []
  );

  const filteredExceptions = useMemo(
    () =>
      EXCEPTION_RECORDS.filter((exception) => {
        if (severityFilter !== 'all' && exception.severity !== severityFilter) return false;
        if (statusFilter !== 'all' && exception.status !== statusFilter) return false;
        if (entityFilter !== 'all' && exception.entity !== entityFilter) return false;
        return true;
      }),
    [entityFilter, severityFilter, statusFilter]
  );

  const twinMatchedExceptionId = useMemo(() => {
    const normalizedInvoice = twinInvoice?.toLowerCase();
    const normalizedField = twinField?.toLowerCase();

    if (!normalizedInvoice && !normalizedField) return null;

    const exactInvoiceAndField = EXCEPTION_RECORDS.find((exception) => {
      const invoiceMatch = normalizedInvoice
        ? exception.impactedRecords.some((record) => record.toLowerCase() === normalizedInvoice)
        : true;
      const fieldMatch = normalizedField
        ? exception.impactedFields.some((field) => field.toLowerCase() === normalizedField)
        : true;
      return invoiceMatch && fieldMatch;
    });

    if (exactInvoiceAndField) return exactInvoiceAndField.id;

    const invoiceOnly = normalizedInvoice
      ? EXCEPTION_RECORDS.find((exception) =>
          exception.impactedRecords.some((record) => record.toLowerCase() === normalizedInvoice)
        )
      : null;

    if (invoiceOnly) return invoiceOnly.id;

    const fieldOnly = normalizedField
      ? EXCEPTION_RECORDS.find((exception) =>
          exception.impactedFields.some((field) => field.toLowerCase() === normalizedField)
        )
      : null;

    return fieldOnly?.id ?? null;
  }, [twinField, twinInvoice]);

  useEffect(() => {
    if (!filteredExceptions.some((exception) => exception.id === selectedExceptionId)) {
      setSelectedExceptionId(filteredExceptions[0]?.id ?? null);
    }
  }, [filteredExceptions, selectedExceptionId]);

  useEffect(() => {
    if (twinMatchedExceptionId) {
      setSelectedExceptionId(twinMatchedExceptionId);
    }
  }, [twinMatchedExceptionId]);

  const selectedException =
    filteredExceptions.find((exception) => exception.id === selectedExceptionId) ??
    EXCEPTION_RECORDS.find((exception) => exception.id === selectedExceptionId) ??
    null;

  const selectedComplianceException = useMemo<Exception | null>(() => {
    if (!selectedException) return null;

    return {
      id: selectedException.id,
      checkId: selectedException.ruleId,
      ruleId: selectedException.ruleId,
      checkName: selectedException.ruleName,
      severity: selectedException.severity,
      message: selectedException.description,
      datasetType: 'AR',
      invoiceNumber: selectedException.impactedRecords[0],
      field: selectedException.impactedFields[0],
    };
  }, [selectedException]);

  const summary = useMemo(() => {
    const total = EXCEPTION_RECORDS.length;
    const critical = EXCEPTION_RECORDS.filter((exception) => exception.severity === 'Critical').length;
    const open = EXCEPTION_RECORDS.filter((exception) => exception.status === 'Open').length;
    const resolved = EXCEPTION_RECORDS.filter((exception) => exception.status === 'Resolved').length;
    const inProgress = EXCEPTION_RECORDS.filter((exception) => exception.status === 'In progress').length;

    return { total, critical, open, resolved, inProgress };
  }, []);

  const openExplanationDialog = async () => {
    if (!selectedComplianceException) return;

    setExplanationDialogOpen(true);
    setExplanationLoading(true);
    setExplanationError(null);
    setSelectedExplanation(null);

    try {
      const explanation = await generateValidationExplanation({
        exception: selectedComplianceException,
        datasetType: selectedComplianceException.datasetType,
        mode: 'heuristic_only',
        promptVersion: 'validation_explain_v1',
      });
      setSelectedExplanation(explanation);
    } catch {
      setExplanationError('Unable to generate explanation. Please retry.');
    } finally {
      setExplanationLoading(false);
    }
  };

  const regenerateExplanation = async () => {
    if (!selectedComplianceException) return;

    setExplanationLoading(true);
    setExplanationError(null);

    try {
      const explanation = await generateValidationExplanation({
        exception: selectedComplianceException,
        datasetType: selectedComplianceException.datasetType,
        mode: 'heuristic_only',
        regenerate: true,
        promptVersion: 'validation_explain_v1',
      });
      setSelectedExplanation(explanation);
    } catch {
      setExplanationError('Unable to regenerate explanation.');
    } finally {
      setExplanationLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Exceptions"
          value={summary.total}
          subtitle="Current workflow queue"
          icon={<FolderKanban className="h-5 w-5" />}
          className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Critical Exceptions"
          value={summary.critical}
          subtitle="Immediate regulatory blockers"
          icon={<CircleAlert className="h-5 w-5" />}
          variant={summary.critical > 0 ? 'danger' : 'success'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Open Exceptions"
          value={summary.open}
          subtitle={`${summary.inProgress} in progress`}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={summary.open > 0 ? 'warning' : 'default'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Resolved"
          value={summary.resolved}
          subtitle="Closed with context retained"
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          variant={summary.resolved > 0 ? 'success' : 'default'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Exception workflow
                </p>
                <h2 className="text-xl font-semibold text-foreground">Exception queue</h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Triage exception outcomes, keep accountability visible, and move from validation findings to governed
                  follow-up without leaving the workflow shell.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => navigate('/cases')}>
                  Open Cases
                </Button>
                <Button className="rounded-full" onClick={() => navigate('/data-twin')}>
                  Open Data Twin
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FilterField
                label="Severity"
                value={severityFilter}
                onValueChange={setSeverityFilter}
                options={['all', 'Critical', 'High', 'Medium', 'Low']}
                placeholder="All severities"
              />
              <FilterField
                label="Status"
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={['all', 'Open', 'In progress', 'Resolved']}
                placeholder="All statuses"
              />
              <FilterField
                label="Entity"
                value={entityFilter}
                onValueChange={setEntityFilter}
                options={entities}
                placeholder="All entities"
              />
            </div>

            {(twinInvoice || twinField) && (
              <div className="rounded-[20px] border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">Digital Twin context</span>
                  {twinInvoice ? <Badge variant="outline">Invoice: {twinInvoice}</Badge> : null}
                  {twinField ? <Badge variant="outline">Field: {twinField}</Badge> : null}
                  <span>
                    {twinMatchedExceptionId
                      ? 'A matching exception was preselected for review.'
                      : 'No exact exception match was found, so the queue remains available for manual triage.'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {filteredExceptions.length} visible
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {EXCEPTION_RECORDS.length} total
              </Badge>
              <span>Select an exception to inspect operational context and the recommended fix path.</span>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/78">
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Exception ID</TableHead>
                    <TableHead>Related rule</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.length > 0 ? (
                    filteredExceptions.map((exception) => (
                      <TableRow
                        key={exception.id}
                        className={cn(
                          'cursor-pointer border-border/60 bg-transparent hover:bg-muted/35',
                          selectedException?.id === exception.id && 'bg-primary/6'
                        )}
                        onClick={() => setSelectedExceptionId(exception.id)}
                        aria-selected={selectedException?.id === exception.id}
                      >
                        <TableCell className="font-medium text-foreground">{exception.id}</TableCell>
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{exception.ruleName}</p>
                            <p className="text-xs text-muted-foreground">{exception.ruleId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={exception.severity} />
                        </TableCell>
                        <TableCell>{exception.entity}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              getExceptionStatusClasses(exception.status)
                            )}
                          >
                            {exception.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{exception.owner ?? 'Unassigned'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-10 text-center">
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">No exceptions match the current filters.</p>
                          <p className="text-sm text-muted-foreground">
                            Adjust severity, status, or entity filters to bring more exceptions back into view.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <aside className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          {selectedException ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                    Selected exception
                  </Badge>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-foreground">{selectedException.id}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{selectedException.ruleName}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedException.ruleId}
                </Badge>
                <SeverityBadge severity={selectedException.severity} />
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                    getExceptionStatusClasses(selectedException.status)
                  )}
                >
                  {selectedException.status}
                </span>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedException.entity}
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedException.owner ?? 'Unassigned'}
                </Badge>
              </div>

              <DetailSection title="Description of issue">{selectedException.description}</DetailSection>

              <DetailSection title="Related rule">
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{selectedException.ruleName}</p>
                  <p>{selectedException.whyItMatters}</p>
                </div>
              </DetailSection>

              <DetailSection title="Impacted fields / data">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedException.impactedFields.map((field) => (
                      <Badge key={field} variant="outline" className="border-border/70 bg-background/80">
                        {field}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedException.impactedRecords.map((record) => (
                      <Badge key={record} variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                        {record}
                      </Badge>
                    ))}
                  </div>
                </div>
              </DetailSection>

              <DetailSection title="Recommended fix / action">{selectedException.nextAction}</DetailSection>

              <DetailSection title="AI heuristics explanation">
                <div className="space-y-3">
                  <p>
                    Generate the deterministic heuristics explanation pack for this exception without leaving the
                    workspace.
                  </p>
                  <Button variant="outline" className="rounded-full" onClick={openExplanationDialog}>
                    Explain issue
                  </Button>
                </div>
              </DetailSection>

              <DetailSection title="Data Twin context">
                <div className="space-y-3">
                  <p>{selectedException.dataTwinReference}</p>
                  <Button variant="outline" className="rounded-full" onClick={() => navigate('/data-twin')}>
                    Open Data Twin
                  </Button>
                </div>
              </DetailSection>
            </div>
          ) : null}
        </aside>
      </section>

      <Dialog open={explanationDialogOpen} onOpenChange={setExplanationDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validation Explanation</DialogTitle>
            <DialogDescription>
              Deterministic heuristics explanation pack for the selected exception.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-2 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateExplanation}
              disabled={explanationLoading || !selectedComplianceException}
            >
              Regenerate
            </Button>
          </div>

          <ExplanationPackPanel
            explanation={selectedExplanation}
            exception={selectedComplianceException}
            isLoading={explanationLoading}
            errorMessage={explanationError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/80">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option === 'all' ? placeholder : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-background/78 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}
