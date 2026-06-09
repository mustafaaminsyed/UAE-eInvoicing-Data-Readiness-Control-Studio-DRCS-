import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileArchive,
  FileCheck2,
  FolderClock,
  Link2,
  ScanSearch,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

type EvidenceStatus = 'Generated' | 'Pending' | 'Ready to export';
type EvidenceType = 'Invoice packet' | 'Dataset pack' | 'Exception narrative' | 'Audit bundle';

interface EvidenceRecord {
  id: string;
  reference: string;
  type: EvidenceType;
  status: EvidenceStatus;
  generatedDate: string;
  traceabilityCoverage: number;
  entityOrDataset: string;
  summary: string;
  linkedContext: string[];
  artifacts: string[];
  traceabilityNotes: string;
  nextAction: string;
}

const EVIDENCE_RECORDS: EvidenceRecord[] = [
  {
    id: 'EVP-2026-031',
    reference: 'INV-10428',
    type: 'Invoice packet',
    status: 'Ready to export',
    generatedDate: '2026-03-18',
    traceabilityCoverage: 96,
    entityOrDataset: 'Dariba Retail LLC',
    summary: 'Regulator-facing packet for invoice INV-10428 with mapped lineage, validation outcome, and exception resolution notes.',
    linkedContext: ['Rule UAE-UC1-CHK-012', 'Exception EXC-10428', 'Data Twin lineage snapshot'],
    artifacts: ['Invoice header extract', 'Validation findings summary', 'Exception resolution note', 'Traceability snapshot'],
    traceabilityNotes: 'Source, mapping, rule, and exception stages are linked end-to-end with operator notes attached.',
    nextAction: 'Export the packet and attach the final sign-off note for the seller master-data correction.',
  },
  {
    id: 'EVP-2026-028',
    reference: 'AR March 2026',
    type: 'Dataset pack',
    status: 'Generated',
    generatedDate: '2026-03-17',
    traceabilityCoverage: 89,
    entityOrDataset: 'AR outbound dataset',
    summary: 'Dataset-level evidence bundle covering readiness metrics, rule outcomes, and entity-level exceptions for the March AR run.',
    linkedContext: ['Validation run AR-2026-03-17', 'Dashboard readiness summary', 'Exception queue snapshot'],
    artifacts: ['Submission manifest', 'Validation scorecard', 'Top exception list', 'Coverage appendix'],
    traceabilityNotes: 'Most invoices carry full lineage; a small subset still relies on workflow-level exception summaries.',
    nextAction: 'Review pending evidence items before promoting this pack to audit-ready status.',
  },
  {
    id: 'EVP-2026-026',
    reference: 'INV-10411',
    type: 'Exception narrative',
    status: 'Pending',
    generatedDate: '2026-03-16',
    traceabilityCoverage: 72,
    entityOrDataset: 'Dariba Retail LLC',
    summary: 'Narrative draft for buyer registration-format failures tied to one ERP channel and an active exception workflow.',
    linkedContext: ['Rule UAE-UC1-CHK-018', 'Exception EXC-10411', 'Buyer identity mapping review'],
    artifacts: ['Affected-record sample', 'Rule description', 'Owner handoff note'],
    traceabilityNotes: 'Exception context is linked, but the final buyer master-data evidence has not yet been attached.',
    nextAction: 'Complete the buyer source evidence attachment, then regenerate the narrative for export.',
  },
  {
    id: 'EVP-2026-024',
    reference: 'INV-10405',
    type: 'Audit bundle',
    status: 'Pending',
    generatedDate: '2026-03-15',
    traceabilityCoverage: 78,
    entityOrDataset: 'Al Noor Trading',
    summary: 'Audit bundle for VAT reconciliation issues with trace summaries and calculation-path notes prepared for reviewer follow-up.',
    linkedContext: ['Rule UAE-UC1-CHK-031', 'Exception EXC-10405', 'Calculation lineage trace'],
    artifacts: ['VAT comparison report', 'Lineage screenshot', 'Reviewer comment log'],
    traceabilityNotes: 'Calculation stages are connected, but the final evidence note still needs confirmation from finance operations.',
    nextAction: 'Validate the calculation note with the finance owner and regenerate the export-ready bundle.',
  },
  {
    id: 'EVP-2026-019',
    reference: 'Mena Distribution',
    type: 'Dataset pack',
    status: 'Ready to export',
    generatedDate: '2026-03-13',
    traceabilityCoverage: 94,
    entityOrDataset: 'Mena Distribution',
    summary: 'Entity-level dataset pack combining intake history, validation outcome, and resolved exception context for audit review.',
    linkedContext: ['Submission workspace snapshot', 'Resolved exception EXC-10192', 'Evidence timeline'],
    artifacts: ['Dataset profile', 'Resolved exception history', 'Traceability index', 'Export manifest'],
    traceabilityNotes: 'Traceability is complete across the included records and the export manifest is already prepared.',
    nextAction: 'Export the bundle to the audit workspace or hand off to Evidence Pack for final packaging.',
  },
];

function getEvidenceStatusClasses(status: EvidenceStatus) {
  if (status === 'Ready to export') return 'border-success/25 bg-success/10 text-success';
  if (status === 'Generated') return 'border-primary/20 bg-primary/8 text-primary';
  return 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium';
}

function getCoverageClasses(coverage: number) {
  if (coverage >= 90) return 'border-success/25 bg-success/10 text-success';
  if (coverage >= 80) return 'border-primary/20 bg-primary/8 text-primary';
  return 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium';
}

export default function EvidenceWorkspacePage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(EVIDENCE_RECORDS[0]?.id ?? null);

  const scopes = useMemo(
    () => ['all', ...Array.from(new Set(EVIDENCE_RECORDS.map((record) => record.entityOrDataset)))],
    []
  );

  const filteredEvidence = useMemo(
    () =>
      EVIDENCE_RECORDS.filter((record) => {
        if (statusFilter !== 'all' && record.status !== statusFilter) return false;
        if (typeFilter !== 'all' && record.type !== typeFilter) return false;
        if (scopeFilter !== 'all' && record.entityOrDataset !== scopeFilter) return false;
        return true;
      }),
    [scopeFilter, statusFilter, typeFilter]
  );

  useEffect(() => {
    if (!filteredEvidence.some((record) => record.id === selectedEvidenceId)) {
      setSelectedEvidenceId(filteredEvidence[0]?.id ?? null);
    }
  }, [filteredEvidence, selectedEvidenceId]);

  const selectedEvidence =
    filteredEvidence.find((record) => record.id === selectedEvidenceId) ??
    EVIDENCE_RECORDS.find((record) => record.id === selectedEvidenceId) ??
    null;

  const summary = useMemo(() => {
    const generated = EVIDENCE_RECORDS.filter(
      (record) => record.status === 'Generated' || record.status === 'Ready to export'
    ).length;
    const pending = EVIDENCE_RECORDS.filter((record) => record.status === 'Pending').length;
    const fullTraceability = EVIDENCE_RECORDS.filter((record) => record.traceabilityCoverage >= 90).length;
    const auditReady = Math.round(
      (EVIDENCE_RECORDS.filter((record) => record.status === 'Ready to export').length / EVIDENCE_RECORDS.length) * 100
    );

    return { generated, pending, fullTraceability, auditReady };
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Evidence Packs Generated"
          value={summary.generated}
          subtitle="Current delivery inventory"
          icon={<FileArchive className="h-5 w-5" />}
          className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Pending Evidence Items"
          value={summary.pending}
          subtitle="Still awaiting completion"
          icon={<FolderClock className="h-5 w-5" />}
          variant={summary.pending > 0 ? 'warning' : 'success'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Invoices With Full Traceability"
          value={summary.fullTraceability}
          subtitle="Coverage at 90% or above"
          icon={<ScanSearch className="h-5 w-5" />}
          variant={summary.fullTraceability > 0 ? 'success' : 'default'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Audit-ready Percentage"
          value={`${summary.auditReady}%`}
          subtitle="Ready to export now"
          icon={<FileCheck2 className="h-5 w-5" />}
          variant={summary.auditReady >= 50 ? 'success' : 'warning'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Evidence workspace
                </p>
                <h2 className="text-xl font-semibold text-foreground">Evidence inventory</h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Review generated evidence, inspect linked traceability context, and prepare audit-ready bundles
                  without leaving the workflow shell.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => navigate('/traceability')}>
                  View Traceability
                </Button>
                <Button className="rounded-full" onClick={() => navigate('/evidence-pack')}>
                  Open Evidence Pack
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FilterField
                label="Status"
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={['all', 'Generated', 'Pending', 'Ready to export']}
                placeholder="All statuses"
              />
              <FilterField
                label="Type"
                value={typeFilter}
                onValueChange={setTypeFilter}
                options={['all', 'Invoice packet', 'Dataset pack', 'Exception narrative', 'Audit bundle']}
                placeholder="All types"
              />
              <FilterField
                label="Entity or dataset"
                value={scopeFilter}
                onValueChange={setScopeFilter}
                options={scopes}
                placeholder="All scopes"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {filteredEvidence.length} visible
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {EVIDENCE_RECORDS.length} total
              </Badge>
              <span>Select an evidence item to inspect its included artifacts and export readiness.</span>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/78">
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Evidence ID</TableHead>
                    <TableHead>Related invoice or dataset</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated date</TableHead>
                    <TableHead>Traceability coverage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvidence.length > 0 ? (
                    filteredEvidence.map((record) => (
                      <TableRow
                        key={record.id}
                        className={cn(
                          'cursor-pointer border-border/60 bg-transparent hover:bg-muted/35',
                          selectedEvidence?.id === record.id && 'bg-primary/6'
                        )}
                        onClick={() => setSelectedEvidenceId(record.id)}
                        aria-selected={selectedEvidence?.id === record.id}
                      >
                        <TableCell className="font-medium text-foreground">{record.id}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{record.reference}</p>
                            <p className="text-xs text-muted-foreground">{record.entityOrDataset}</p>
                          </div>
                        </TableCell>
                        <TableCell>{record.type}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              getEvidenceStatusClasses(record.status)
                            )}
                          >
                            {record.status}
                          </span>
                        </TableCell>
                        <TableCell>{record.generatedDate}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              getCoverageClasses(record.traceabilityCoverage)
                            )}
                          >
                            {record.traceabilityCoverage}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-10 text-center">
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">No evidence items match the current filters.</p>
                          <p className="text-sm text-muted-foreground">
                            Adjust status, type, or scope filters to bring more evidence items back into view.
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
          {selectedEvidence ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                    Selected evidence
                  </Badge>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-foreground">{selectedEvidence.id}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{selectedEvidence.reference}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedEvidence.type}
                </Badge>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                    getEvidenceStatusClasses(selectedEvidence.status)
                  )}
                >
                  {selectedEvidence.status}
                </span>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedEvidence.entityOrDataset}
                </Badge>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                    getCoverageClasses(selectedEvidence.traceabilityCoverage)
                  )}
                >
                  {selectedEvidence.traceabilityCoverage}% coverage
                </span>
              </div>

              <DetailSection title="Evidence summary">{selectedEvidence.summary}</DetailSection>

              <DetailSection title="Linked rule / exception context">
                <div className="flex flex-wrap gap-2">
                  {selectedEvidence.linkedContext.map((item) => (
                    <Badge key={item} variant="outline" className="border-border/70 bg-background/80">
                      {item}
                    </Badge>
                  ))}
                </div>
              </DetailSection>

              <DetailSection title="Included artifacts">
                <div className="flex flex-wrap gap-2">
                  {selectedEvidence.artifacts.map((artifact) => (
                    <Badge key={artifact} variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                      {artifact}
                    </Badge>
                  ))}
                </div>
              </DetailSection>

              <DetailSection title="Traceability notes">{selectedEvidence.traceabilityNotes}</DetailSection>

              <DetailSection title="Recommended next action">
                <div className="space-y-3">
                  <p>{selectedEvidence.nextAction}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-full" onClick={() => navigate('/data-twin')}>
                      Open Data Twin
                    </Button>
                    <Button className="rounded-full" onClick={() => navigate('/evidence-pack')}>
                      Export action
                    </Button>
                  </div>
                </div>
              </DetailSection>
            </div>
          ) : null}
        </aside>
      </section>
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
