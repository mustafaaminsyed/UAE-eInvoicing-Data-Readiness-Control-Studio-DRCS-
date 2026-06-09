import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarRange,
  FileStack,
  Filter,
  FolderOpen,
  PlayCircle,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { useCompliance } from '@/context/ComplianceContext';
import { getUploadAuditLogs } from '@/lib/uploadAudit';
import { cn } from '@/lib/utils';
import type { Buyer, Exception, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type { DatasetType } from '@/types/datasets';

type SubmissionStatus = 'ready' | 'failed' | 'processing';

interface SubmissionRecord {
  id: string;
  datasetName: string;
  entity: string;
  period: string;
  status: SubmissionStatus;
  readinessScore: number;
  direction: DatasetType;
  invoiceCount: number;
  updatedAt: string;
  source: 'workspace' | 'history' | 'demo';
  note: string;
  fileNames: string[];
}

const FALLBACK_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'demo-1',
    datasetName: 'AR intake 01',
    entity: 'Dariba Retail LLC',
    period: 'Mar 2026',
    status: 'ready',
    readinessScore: 94,
    direction: 'AR',
    invoiceCount: 482,
    updatedAt: '2026-03-18T09:15:00.000Z',
    source: 'demo',
    note: 'Dataset package is structurally complete and ready for the next validation run.',
    fileNames: ['dariba_retail_buyers.csv', 'dariba_retail_headers.csv', 'dariba_retail_lines.csv'],
  },
  {
    id: 'demo-2',
    datasetName: 'AP intake 02',
    entity: 'Horizon Trading FZCO',
    period: 'Feb 2026',
    status: 'failed',
    readinessScore: 63,
    direction: 'AP',
    invoiceCount: 316,
    updatedAt: '2026-03-17T13:40:00.000Z',
    source: 'demo',
    note: 'Submission needs structural follow-up before it should be handed into validation.',
    fileNames: ['horizon_buyers.csv', 'horizon_headers.csv', 'horizon_lines.csv'],
  },
  {
    id: 'demo-3',
    datasetName: 'AR intake 03',
    entity: 'Nexa Distribution LLC',
    period: 'Jan 2026',
    status: 'processing',
    readinessScore: 81,
    direction: 'AR',
    invoiceCount: 228,
    updatedAt: '2026-03-19T06:10:00.000Z',
    source: 'demo',
    note: 'Validation orchestration is currently in progress for this submission package.',
    fileNames: ['nexa_buyers.csv', 'nexa_headers.csv', 'nexa_lines.csv'],
  },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMonthYear(value: Date) {
  return value.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function prettifyToken(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function prettifyFileStem(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveEntityFromHeaders(headers: InvoiceHeader[], buyers: Buyer[], direction: DatasetType) {
  const headerEntity = headers.find((header) => header.seller_name)?.seller_name;
  if (headerEntity) return headerEntity;

  const buyerEntity = buyers.find((buyer) => buyer.buyer_name)?.buyer_name;
  if (buyerEntity) return buyerEntity;

  return direction === 'AR' ? 'Outbound entity' : 'Inbound entity';
}

function deriveEntityFromFiles(fileNames: string[], fallback: string) {
  const source = fileNames[0];
  if (!source) return fallback;

  const cleaned = prettifyFileStem(source)
    .replace(/\b(headers?|lines?|buyers?|invoice|invoices|dataset|data|inbound|outbound|ar|ap)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? prettifyToken(cleaned) : fallback;
}

function derivePeriodFromHeaders(headers: InvoiceHeader[]) {
  const dates = headers
    .map((header) => header.issue_date || header.invoicing_period_start_date || header.invoicing_period_end_date)
    .map((value) => (value ? new Date(value) : null))
    .filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  if (dates.length === 0) {
    return 'Current period';
  }

  const first = dates[0];
  const last = dates[dates.length - 1];

  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    return formatMonthYear(first);
  }

  if (first.getFullYear() === last.getFullYear()) {
    return `${first.toLocaleDateString('en-US', { month: 'short' })}-${last.toLocaleDateString('en-US', {
      month: 'short',
    })} ${last.getFullYear()}`;
  }

  return `${formatMonthYear(first)} - ${formatMonthYear(last)}`;
}

function getStatusClasses(status: SubmissionStatus) {
  if (status === 'ready') {
    return 'border-success/25 bg-success/10 text-success';
  }

  if (status === 'processing') {
    return 'border-primary/20 bg-primary/10 text-primary';
  }

  return 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical';
}

function getStatusLabel(status: SubmissionStatus) {
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  return 'Failed';
}

function buildWorkspaceSubmission(input: {
  datasetType: DatasetType;
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  exceptions: Exception[];
  passRate: number;
  isChecksRun: boolean;
  isRunning: boolean;
  updatedAt: string | null;
}): SubmissionRecord | null {
  const {
    datasetType,
    buyers,
    headers,
    lines,
    exceptions,
    passRate,
    isChecksRun,
    isRunning,
    updatedAt,
  } = input;

  const rowCount = buyers.length + headers.length + lines.length;
  if (rowCount === 0) {
    return null;
  }

  const coverageScore = average([
    headers.length > 0 ? 100 : 0,
    buyers.length > 0 ? 100 : 0,
    lines.length > 0 ? 100 : 0,
  ]);
  const readinessScore = clampScore(
    average([isChecksRun ? passRate : 78, coverageScore, headers.length > 0 ? 92 : 54]) -
      Math.min(exceptions.length, 12) * 2
  );
  const status: SubmissionStatus = isRunning ? 'processing' : isChecksRun && exceptions.length > 0 ? 'failed' : 'ready';

  return {
    id: `workspace-${datasetType}`,
    datasetName: `${datasetType} current workspace`,
    entity: deriveEntityFromHeaders(headers, buyers, datasetType),
    period: derivePeriodFromHeaders(headers),
    status,
    readinessScore,
    direction: datasetType,
    invoiceCount: headers.length,
    updatedAt: updatedAt || new Date().toISOString(),
    source: 'workspace',
    note:
      status === 'processing'
        ? 'Validation orchestration is currently running on the active workspace dataset.'
        : status === 'failed'
        ? 'This workspace has validation findings that should be reviewed before submission handoff.'
        : 'The active dataset is staged cleanly and can move into validation when needed.',
    fileNames: [
      `${datasetType.toLowerCase()} buyers dataset`,
      `${datasetType.toLowerCase()} headers dataset`,
      `${datasetType.toLowerCase()} lines dataset`,
    ],
  };
}

function buildHistoricalSubmission(
  index: number,
  entry: ReturnType<typeof getUploadAuditLogs>[number]
): SubmissionRecord {
  const missingColumns = entry.datasets.reduce((sum, dataset) => sum + dataset.requiredMissing.length, 0);
  const unmatchedRows = entry.relationalChecks.reduce((sum, check) => sum + check.unmatchedCount, 0);
  const relationalScore = entry.relationalChecks.length
    ? average(entry.relationalChecks.map((check) => check.matchPct))
    : 84;
  const fileCoverageScore = (entry.datasets.length / 3) * 100;
  const readinessScore = clampScore(
    average([fileCoverageScore, relationalScore, 100 - missingColumns * 12]) - Math.min(unmatchedRows, 20)
  );
  const status: SubmissionStatus = missingColumns > 0 || unmatchedRows > 0 ? 'failed' : 'ready';
  const fallbackEntity = entry.datasetType === 'AR' ? 'Outbound entity' : 'Inbound entity';

  return {
    id: `audit-${entry.id}`,
    datasetName: `${entry.datasetType || 'AR'} intake ${String(index + 1).padStart(2, '0')}`,
    entity: deriveEntityFromFiles(
      entry.datasets.map((dataset) => dataset.fileName),
      fallbackEntity
    ),
    period: formatMonthYear(new Date(entry.createdAt)),
    status,
    readinessScore,
    direction: entry.datasetType || 'AR',
    invoiceCount: entry.headersCount,
    updatedAt: entry.createdAt,
    source: 'history',
    note:
      status === 'failed'
        ? 'Structural issues or relational mismatches were detected during intake review.'
        : 'Dataset package is structurally complete and ready for validation.',
    fileNames: entry.datasets.map((dataset) => dataset.fileName),
  };
}

export default function SubmissionsPage() {
  const navigate = useNavigate();
  const {
    activeDatasetType,
    getDataForDataset,
    hasDatasetLoaded,
    getDashboardStats,
    exceptions,
    isChecksRun,
    isRunning,
    lastChecksRunAt,
  } = useCompliance();

  const [entityFilter, setEntityFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const records = useMemo(() => {
    const workspaceRecords: SubmissionRecord[] = (['AR', 'AP'] as DatasetType[])
      .filter((datasetType) => hasDatasetLoaded(datasetType))
      .map((datasetType) => {
        const data = getDataForDataset(datasetType);
        const scopedExceptions = exceptions.filter(
          (exception) => (exception.datasetType || exception.direction || datasetType) === datasetType
        );
        const stats = getDashboardStats(datasetType);

        return buildWorkspaceSubmission({
          datasetType,
          buyers: data.buyers,
          headers: data.headers,
          lines: data.lines,
          exceptions: scopedExceptions,
          passRate: stats.passRate,
          isChecksRun,
          isRunning: isRunning && activeDatasetType === datasetType,
          updatedAt: lastChecksRunAt,
        });
      })
      .filter((record): record is SubmissionRecord => Boolean(record));

    const historyRecords = getUploadAuditLogs().map((entry, index) => buildHistoricalSubmission(index, entry));
    const combined = [...workspaceRecords, ...historyRecords];

    if (combined.length === 0) {
      return FALLBACK_SUBMISSIONS;
    }

    return combined.sort((left, right) => {
      if (left.source === 'workspace' && right.source !== 'workspace') return -1;
      if (left.source !== 'workspace' && right.source === 'workspace') return 1;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [
    activeDatasetType,
    exceptions,
    getDashboardStats,
    getDataForDataset,
    hasDatasetLoaded,
    isChecksRun,
    isRunning,
    lastChecksRunAt,
  ]);

  const entities = useMemo(
    () => ['all', ...Array.from(new Set(records.map((record) => record.entity))).sort((left, right) => left.localeCompare(right))],
    [records]
  );
  const periods = useMemo(
    () => ['all', ...Array.from(new Set(records.map((record) => record.period))).sort((left, right) => right.localeCompare(left))],
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        if (entityFilter !== 'all' && record.entity !== entityFilter) return false;
        if (periodFilter !== 'all' && record.period !== periodFilter) return false;
        if (statusFilter !== 'all' && record.status !== statusFilter) return false;
        return true;
      }),
    [entityFilter, periodFilter, records, statusFilter]
  );

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!filteredRecords.some((record) => record.id === selectedId)) {
      setSelectedId(filteredRecords[0].id);
    }
  }, [filteredRecords, selectedId]);

  const selectedSubmission =
    filteredRecords.find((record) => record.id === selectedId) ||
    records.find((record) => record.id === selectedId) ||
    null;

  const summary = useMemo(
    () => ({
      total: records.length,
      ready: records.filter((record) => record.status === 'ready').length,
      failed: records.filter((record) => record.status === 'failed').length,
      processing: records.filter((record) => record.status === 'processing').length,
    }),
    [records]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Dataset intake</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Submission queue</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Review dataset packages, filter readiness state, and hand selected submissions into validation without
                leaving the workflow shell.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/upload')}>
              <Upload className="h-4 w-4" />
              Upload dataset
            </Button>
            <Button className="rounded-full" onClick={() => navigate('/run')} disabled={!selectedSubmission}>
              <PlayCircle className="h-4 w-4" />
              Run validation
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile label="Datasets" value={String(summary.total)} tone="default" />
          <SummaryTile label="Ready" value={String(summary.ready)} tone="success" />
          <SummaryTile label="Failed" value={String(summary.failed)} tone="danger" />
          <SummaryTile label="Processing" value={String(summary.processing)} tone="primary" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filters
                </p>
                <h3 className="text-lg font-semibold text-foreground">Datasets</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[620px]">
                <FilterSelect
                  label="Entity"
                  value={entityFilter}
                  onValueChange={setEntityFilter}
                  options={entities}
                  placeholder="All entities"
                />
                <FilterSelect
                  label="Period"
                  value={periodFilter}
                  onValueChange={setPeriodFilter}
                  options={periods}
                  placeholder="All periods"
                />
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as 'all' | SubmissionStatus)}
                  options={['all', 'ready', 'failed', 'processing']}
                  placeholder="All statuses"
                  formatOption={(value) => getStatusLabel(value as SubmissionStatus)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {filteredRecords.length} visible
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {records.length} total
              </Badge>
              <span>
                Select a dataset row to open the submission workspace placeholder and hand it off to the next step.
              </span>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/75">
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Dataset name</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Readiness score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        className={cn(
                          'cursor-pointer border-border/60 bg-transparent hover:bg-muted/35',
                          selectedSubmission?.id === record.id && 'bg-primary/6'
                        )}
                        onClick={() => setSelectedId(record.id)}
                      >
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{record.datasetName}</p>
                              <Badge variant="outline" className="border-border/70 bg-background/80 text-[11px]">
                                {record.direction}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {record.invoiceCount} invoices · updated {formatDateTime(record.updatedAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px] text-sm text-foreground">{record.entity}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{record.period}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              getStatusClasses(record.status)
                            )}
                          >
                            {getStatusLabel(record.status)}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">{record.readinessScore}%</span>
                              <span className="text-muted-foreground">
                                {record.source === 'workspace'
                                  ? 'Workspace'
                                  : record.source === 'history'
                                  ? 'Historical'
                                  : 'Preview'}
                              </span>
                            </div>
                            <Progress value={record.readinessScore} className="h-2.5 rounded-full bg-muted/80" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="py-10 text-center">
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">No submissions match the current filters.</p>
                          <p className="text-sm text-muted-foreground">
                            Adjust the entity, period, or status filters to bring more datasets back into view.
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
          {selectedSubmission ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                    Submission workspace
                  </Badge>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold text-foreground">{selectedSubmission.datasetName}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Placeholder detail view for dataset-level review, approvals, and run orchestration inside the new
                      submissions workspace.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
                  <FileStack className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailMetric label="Entity" value={selectedSubmission.entity} />
                <DetailMetric label="Period" value={selectedSubmission.period} icon={<CalendarRange className="h-4 w-4" />} />
                <DetailMetric label="Status" value={getStatusLabel(selectedSubmission.status)} />
                <DetailMetric label="Readiness" value={`${selectedSubmission.readinessScore}%`} />
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Operational note</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedSubmission.note}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                      getStatusClasses(selectedSubmission.status)
                    )}
                  >
                    {getStatusLabel(selectedSubmission.status)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Readiness signal</span>
                    <span className="text-muted-foreground">{selectedSubmission.readinessScore}%</span>
                  </div>
                  <Progress value={selectedSubmission.readinessScore} className="h-2.5 rounded-full bg-muted/80" />
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <p className="text-sm font-semibold text-foreground">Attached dataset files</p>
                <div className="mt-3 space-y-2">
                  {selectedSubmission.fileNames.map((fileName) => (
                    <div
                      key={`${selectedSubmission.id}-${fileName}`}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2"
                    >
                      <span className="truncate pr-3 text-sm text-foreground">{fileName}</span>
                      <Badge variant="outline" className="border-border/70 bg-background/70 text-[11px]">
                        Attached
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <p className="text-sm font-semibold text-foreground">Next in this workspace</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    Review intake completeness and package metadata.
                  </li>
                  <li className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    Confirm the selected dataset package is the correct handoff for validation.
                  </li>
                  <li className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    Expand this placeholder into a dedicated submission detail workflow when business rules are ready.
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => navigate('/upload')}>
                  <Upload className="h-4 w-4" />
                  Upload dataset
                </Button>
                <Button className="rounded-full" onClick={() => navigate('/run')}>
                  <PlayCircle className="h-4 w-4" />
                  Run validation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-background/60 p-6 text-center">
              <div className="space-y-2">
                <p className="font-medium text-foreground">No submission selected.</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Pick a dataset from the queue to open the submission workspace placeholder.
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'success' | 'danger' | 'primary';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)]',
        tone === 'success' && 'border-success/20 bg-success/8',
        tone === 'danger' && 'border-severity-critical/20 bg-severity-critical/8',
        tone === 'primary' && 'border-primary/20 bg-primary/8',
        tone === 'default' && 'border-border/70 bg-background/75'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  formatOption,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
  formatOption?: (value: string) => string;
}) {
  return (
    <label className="space-y-2">
      <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/80">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option === 'all' ? placeholder : formatOption ? formatOption(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function DetailMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
