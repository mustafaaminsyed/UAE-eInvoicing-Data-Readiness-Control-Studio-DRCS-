import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  FileText,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompliance } from '@/context/ComplianceContext';
import { cn } from '@/lib/utils';
import type { Exception, InvoiceHeader, ParsedData, Severity } from '@/types/compliance';

type DatasetFilter = 'all' | 'AR' | 'AP';
type ViewMode = 'lineage' | 'record' | 'control';
type NodeType = 'source' | 'mapping' | 'rule' | 'exception' | 'evidence';

interface TwinNode {
  id: string;
  label: string;
  type: NodeType;
  status: string;
  supportLine: string;
  stageSummary: string;
  whatHappened: string;
  whyItMatters: string;
  nextAction: string;
}

interface TwinIssue {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium';
  note: string;
  field?: string;
  invoiceId?: string;
  checkId?: string;
}

interface TwinContext {
  id: string;
  entity: string;
  dataset: 'AR' | 'AP';
  invoice: string;
  viewHint: string;
  summary: string;
  notes: string[];
  issues: TwinIssue[];
  nodes: TwinNode[];
  edgeCount: number;
  metadata?: {
    invoiceId?: string;
    buyerName?: string;
    lineCount?: number;
    issueCount?: number;
    sourceRowNumber?: number;
    mappingProfileLabel?: string;
    runLabel?: string | null;
    primaryField?: string;
  };
}

const TWIN_CONTEXTS: TwinContext[] = [
  {
    id: 'twin-1',
    entity: 'Dariba Retail LLC',
    dataset: 'AR',
    invoice: 'INV-10428',
    viewHint: 'Outbound tax invoice lineage from source ingestion through evidence packaging.',
    summary:
      'One outbound invoice shown as a single connected lineage across source intake, mapping, governed checks, issue handling, and evidence.',
    notes: [
      'Use this space for record-level annotations, operator notes, and handoff commentary.',
      'The canvas keeps lineage stages, operator context, and linked actions together in one workspace.',
      'Selected node context should eventually drive tabs, side panels, and linked issue review.',
    ],
    issues: [
      {
        id: 'issue-1',
        title: 'Seller legal registration detail still needs operator confirmation.',
        severity: 'High',
        note: 'This is currently shown as a downstream validation risk rather than a blocking source error.',
      },
      {
        id: 'issue-2',
        title: 'VAT treatment note should carry into record notes before export.',
        severity: 'Medium',
        note: 'Planned as a contextual annotation workflow in a later iteration.',
      },
    ],
    edgeCount: 4,
    nodes: [
      {
        id: 'source-1',
        label: 'ERP source row',
        type: 'source',
        status: 'Captured',
        supportLine: 'Invoice header captured from the AR intake dataset.',
        stageSummary: 'The source stage represents the raw record exactly as it arrived from the operational system.',
        whatHappened: 'The invoice was ingested from headers.csv, row 10428, for Dariba Retail LLC before any workflow enrichment.',
        whyItMatters: 'Everything downstream depends on the source row being understandable and traceable back to its original intake record.',
        nextAction: 'Use this stage to confirm the source record is the correct starting point before reviewing mapping or rule outcomes.',
      },
      {
        id: 'mapping-1',
        label: 'Mapping profile',
        type: 'mapping',
        status: 'Aligned',
        supportLine: 'Canonical invoice model aligned from source fields.',
        stageSummary: 'The mapping stage aligns source fields to the governed invoice model used across the workflow.',
        whatHappened: 'The record was mapped through the UAE AR baseline v2 profile with 42 / 45 fields aligned.',
        whyItMatters: 'If mapping is unclear or incomplete, every validation outcome and exception downstream becomes harder to trust.',
        nextAction: 'Review mapped coverage and confirm the canonical profile still reflects the intended invoice structure.',
      },
      {
        id: 'rule-1',
        label: 'Validation rule',
        type: 'rule',
        status: 'Issue found',
        supportLine: 'Completeness control flagged the mapped invoice.',
        stageSummary: 'The rule stage shows the governed control that evaluated this invoice in a deterministic way.',
        whatHappened: 'The Seller identity completeness rule ran against the header scope and returned a flagged outcome.',
        whyItMatters: 'This is the point where the platform turns mapped data into a clear compliance finding that can be explained and acted on.',
        nextAction: 'Inspect the flagged fields and confirm whether the issue is caused by missing source data or mapping coverage.',
      },
      {
        id: 'exception-1',
        label: 'Exception case',
        type: 'exception',
        status: 'Pending resolution',
        supportLine: 'Workflow case opened for triage and remediation.',
        stageSummary: 'The exception stage captures how a failing control becomes an accountable workflow item.',
        whatHappened: 'A high-severity case was raised and assigned to operations review with the state still pending resolution.',
        whyItMatters: 'Operators need a governed place to resolve issues without losing the relationship back to the rule and the source record.',
        nextAction: 'Review ownership, confirm the remediation path, and move the case toward a resolved workflow state.',
      },
      {
        id: 'evidence-1',
        label: 'Evidence pack',
        type: 'evidence',
        status: 'Draft ready',
        supportLine: 'Evidence bundle prepared with linked audit context.',
        stageSummary: 'The evidence stage shows how lineage, findings, and operator context can be assembled for audit review.',
        whatHappened: 'The invoice is linked to the Quarterly DRCS evidence pack in a draft state with audit-ready retention.',
        whyItMatters: 'Evidence should be easy to explain and export without rebuilding context from separate screens.',
        nextAction: 'Open the Evidence workspace when the issue path is resolved and the invoice is ready for export packaging.',
      },
    ],
  },
  {
    id: 'twin-2',
    entity: 'Horizon Trading FZCO',
    dataset: 'AP',
    invoice: 'AP-88217',
    viewHint: 'Inbound invoice twin showing a supplier-facing record through mapping and governed checks.',
    summary:
      'One inbound supplier invoice shown as a connected object instead of a series of disconnected screens.',
    notes: [
      'Use view modes to pivot between relationship context, record metadata, and control path emphasis.',
      'The right-side panel should eventually support invoice, line, and counterparty sub-record drill-down.',
      'Related issues stay visible here so operators can keep context while reviewing lineage and record detail.',
    ],
    issues: [
      {
        id: 'issue-3',
        title: 'Buyer TRN mismatch remains attached to this supplier invoice flow.',
        severity: 'Critical',
        note: 'Detail panel should eventually link directly into the exception queue and source record trace.',
      },
    ],
    edgeCount: 4,
    nodes: [
      {
        id: 'source-2',
        label: 'Vendor source row',
        type: 'source',
        status: 'Captured',
        supportLine: 'Supplier invoice captured in the inbound intake flow.',
        stageSummary: 'The source stage represents the supplier-originated record before it is transformed or reviewed.',
        whatHappened: 'The invoice was captured from vendor_headers.csv, row 88217, for Horizon Trading FZCO.',
        whyItMatters: 'Inbound traceability still starts with the original supplier row, even when later stages apply overlays and governed checks.',
        nextAction: 'Confirm the intake row and supplier context before reviewing mapping and rule outcomes.',
      },
      {
        id: 'mapping-2',
        label: 'Mapping overlay',
        type: 'mapping',
        status: 'Drafted',
        supportLine: 'Inbound overlay aligned supplier data to the governed model.',
        stageSummary: 'The mapping stage applies the dataset-specific overlay that aligns supplier data to the canonical invoice shape.',
        whatHappened: 'The AP intake overlay was applied and aligned 37 / 40 fields for the inbound invoice.',
        whyItMatters: 'Overlay quality determines whether inbound invoices remain explainable when they move into deterministic checks.',
        nextAction: 'Inspect the missing mappings before depending on downstream control results.',
      },
      {
        id: 'rule-2',
        label: 'Rule execution',
        type: 'rule',
        status: 'Critical issue',
        supportLine: 'Counterparty controls surfaced a blocking result.',
        stageSummary: 'The rule stage presents the governed check outcome for this inbound invoice.',
        whatHappened: 'The Inbound counterparty checks rule set completed in a ready state and returned 1 critical issue.',
        whyItMatters: 'This is where the workflow becomes actionable because governed logic has identified a concrete issue path.',
        nextAction: 'Review the failing control and confirm whether the issue should move directly into exception handling.',
      },
      {
        id: 'exception-2',
        label: 'Issue node',
        type: 'exception',
        status: 'Escalated',
        supportLine: 'Critical supplier issue routed to the resolution queue.',
        stageSummary: 'The exception stage shows how an inbound issue is routed into ownership and resolution workflow.',
        whatHappened: 'A critical case was escalated to the supplier readiness team for investigation and follow-through.',
        whyItMatters: 'Escalation should stay attached to the exact invoice journey so teams can resolve the issue with full trace context.',
        nextAction: 'Confirm ownership, capture the remediation note, and link the resolution outcome back into the twin.',
      },
      {
        id: 'evidence-2',
        label: 'Evidence record',
        type: 'evidence',
        status: 'Pending',
        supportLine: 'Support artifacts staged but not yet ready for export.',
        stageSummary: 'The evidence stage represents the retained artifacts that support downstream audit and regulator review.',
        whatHappened: 'Three supporting artifacts were staged and remain in a pending review state for audit and regulator audiences.',
        whyItMatters: 'Good evidence packaging keeps the narrative connected to the same invoice journey teams used to investigate the issue.',
        nextAction: 'Return here once the case is resolved and the final evidence bundle is ready to move into export packaging.',
      },
    ],
  },
];

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  lineage: 'Lineage map',
  record: 'Record context',
  control: 'Control path',
};

const STAGE_ORDER: NodeType[] = ['source', 'mapping', 'rule', 'exception', 'evidence'];

const NODE_STYLES: Record<
  NodeType,
  {
    label: string;
    icon: typeof Database;
    badgeClass: string;
    cardClass: string;
  }
> = {
  source: {
    label: 'Source',
    icon: Database,
    badgeClass: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    cardClass: 'border-sky-500/20 bg-sky-500/8 text-sky-700 dark:text-sky-200',
  },
  mapping: {
    label: 'Mapping',
    icon: GitBranch,
    badgeClass: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    cardClass: 'border-violet-500/20 bg-violet-500/8 text-violet-700 dark:text-violet-200',
  },
  rule: {
    label: 'Rule',
    icon: ShieldCheck,
    badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    cardClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-200',
  },
  exception: {
    label: 'Exception',
    icon: AlertTriangle,
    badgeClass: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    cardClass: 'border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-200',
  },
  evidence: {
    label: 'Evidence',
    icon: FileText,
    badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    cardClass: 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-200',
  },
};

function getStageIndex(type: NodeType) {
  return STAGE_ORDER.indexOf(type);
}

function getSeverityClass(severity: TwinIssue['severity']) {
  if (severity === 'Critical') return 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical';
  if (severity === 'High') return 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium';
  return 'border-primary/15 bg-primary/10 text-primary';
}

function toTwinIssueSeverity(severity?: Severity): TwinIssue['severity'] {
  if (severity === 'Critical' || severity === 'High' || severity === 'Medium') return severity;
  return 'Medium';
}

function getWorstSeverity(exceptions: Exception[]): Severity | null {
  if (exceptions.some((exception) => exception.severity === 'Critical')) return 'Critical';
  if (exceptions.some((exception) => exception.severity === 'High')) return 'High';
  if (exceptions.some((exception) => exception.severity === 'Medium')) return 'Medium';
  if (exceptions.some((exception) => exception.severity === 'Low')) return 'Low';
  return null;
}

function getSelectedNodeRecordNotes(activeContext: TwinContext, selectedNode: TwinNode): string[] {
  const metadata = activeContext.metadata;
  const baseNotes = [
    `Invoice reference: ${activeContext.invoice}. Dataset: ${activeContext.dataset}.`,
    `Entity: ${activeContext.entity}. Buyer/counterparty: ${metadata?.buyerName || 'not provided'}.`,
  ];

  if (selectedNode.type === 'source') {
    return baseNotes.concat([
      `Source row: ${metadata?.sourceRowNumber ?? 'not provided'}.`,
      'This source node is anchored to the loaded invoice record before mapping, rules, or evidence interpretation.',
    ]);
  }

  if (selectedNode.type === 'mapping') {
    return baseNotes.concat([
      `Mapping profile in use: ${metadata?.mappingProfileLabel || 'Default workspace mapping'}.`,
      `Primary field focus: ${metadata?.primaryField || 'No exception field currently highlighted'}.`,
    ]);
  }

  if (selectedNode.type === 'rule') {
    return baseNotes.concat([
      `Linked issue count: ${metadata?.issueCount ?? activeContext.issues.length}.`,
      'This rule stage is invoice-specific and summarizes the selected record rather than a portfolio-level result.',
    ]);
  }

  if (selectedNode.type === 'exception') {
    return baseNotes.concat([
      'The issue cards in this workspace are scoped to the selected invoice journey.',
      'Use the Exceptions workspace when you need queue ownership, triage, and remediation state.',
    ]);
  }

  return baseNotes.concat([
    `Latest run context: ${metadata?.runLabel || 'No completed run timestamp available yet.'}`,
    'Evidence readiness remains tied to this invoice path so teams do not need to rebuild audit context elsewhere.',
  ]);
}

function getPrimaryAction(selectedNode: TwinNode, activeContext: TwinContext) {
  const metadata = activeContext.metadata;

  if (selectedNode.type === 'mapping') {
    const params = new URLSearchParams({ tab: 'create', dataset: activeContext.dataset });
    if (metadata?.primaryField) params.set('field', metadata.primaryField);
    return { label: 'Open Mapping Studio', path: `/mapping?${params.toString()}` };
  }

  if (selectedNode.type === 'rule') {
    return { label: 'Open Traceability', path: buildTwinWorkspacePath('/traceability', metadata) };
  }

  if (selectedNode.type === 'exception') {
    return { label: 'Review Exceptions', path: buildTwinWorkspacePath('/exceptions', metadata) };
  }

  if (selectedNode.type === 'evidence') {
    return { label: 'Open Evidence', path: '/evidence' };
  }

  if (metadata?.invoiceId) {
    return { label: 'Open Invoice Detail', path: `/invoice/${encodeURIComponent(metadata.invoiceId)}` };
  }

  return { label: 'Open Traceability', path: buildTwinWorkspacePath('/traceability', metadata) };
}

function getSecondaryAction(selectedNode: TwinNode, activeContext: TwinContext) {
  const metadata = activeContext.metadata;

  if (selectedNode.type === 'mapping') {
    return { label: 'Open Traceability', path: buildTwinWorkspacePath('/traceability', metadata) };
  }

  if (selectedNode.type === 'rule') {
    return { label: 'Review Exceptions', path: buildTwinWorkspacePath('/exceptions', metadata) };
  }

  if (selectedNode.type === 'exception') {
    return metadata?.invoiceId
      ? { label: 'Open Invoice Detail', path: `/invoice/${encodeURIComponent(metadata.invoiceId)}` }
      : { label: 'Open Traceability', path: buildTwinWorkspacePath('/traceability', metadata) };
  }

  if (selectedNode.type === 'evidence') {
    return { label: 'Open Traceability', path: buildTwinWorkspacePath('/traceability', metadata) };
  }

  return { label: 'Open Traceability', path: buildTwinWorkspacePath('/traceability', metadata) };
}

function buildTwinWorkspacePath(
  basePath: '/traceability' | '/exceptions',
  metadata?: TwinContext['metadata']
) {
  const params = new URLSearchParams();
  if (metadata?.invoiceId) params.set('invoice', metadata.invoiceId);
  if (metadata?.primaryField) params.set('field', metadata.primaryField);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildLiveTwinContext(
  dataset: 'AR' | 'AP',
  data: ParsedData,
  exceptions: Exception[],
  isChecksRun: boolean,
  options: {
    getInvoiceDetails: (invoiceId: string) => {
      header: InvoiceHeader | undefined;
      lines: { invoice_id: string }[];
      buyer: { buyer_name?: string; buyer_id: string } | undefined;
      exceptions: Exception[];
      pintAEExceptions: { message?: string }[];
    };
    activeMappingProfile: { id: string; version: number } | null;
    lastChecksRunAt: string | null;
    lastChecksRunDatasetType: 'AR' | 'AP' | null;
    runSummary: {
      total_invoices_tested: number;
      total_exceptions: number;
      pass_rate_percent: number;
    } | null;
  }
): TwinContext[] {
  return data.headers.map((header) => {
    const invoiceDetails = options.getInvoiceDetails(header.invoice_id);
    const invoiceExceptions =
      invoiceDetails.exceptions.length > 0
        ? invoiceDetails.exceptions
        : exceptions.filter(
            (exception) =>
              (exception.invoiceId && exception.invoiceId === header.invoice_id) ||
              (exception.invoiceNumber && exception.invoiceNumber === header.invoice_number)
          );
    const worstSeverity = getWorstSeverity(invoiceExceptions);
    const invoiceLabel = header.invoice_number || header.invoice_id;
    const entity = header.seller_name || header.seller_trn || header.buyer_id || 'Loaded entity';
    const issueCount = invoiceExceptions.length;
    const sourceRow = header.source_row_number ? `row ${header.source_row_number}` : 'loaded record';
    const lineCount = invoiceDetails.lines.length;
    const buyerName = invoiceDetails.buyer?.buyer_name || invoiceDetails.buyer?.buyer_id || header.buyer_id || 'not provided';
    const mappedFieldCount = Object.values(header).filter((value) => value !== undefined && value !== null && `${value}`.trim() !== '').length;
    const mappingProfileLabel = options.activeMappingProfile
      ? `${options.activeMappingProfile.id} v${options.activeMappingProfile.version}`
      : 'Default workspace mapping';
    const invoicePintExceptionCount = invoiceDetails.pintAEExceptions.length;
    const runRecency =
      options.lastChecksRunAt && options.lastChecksRunDatasetType === dataset
        ? new Date(options.lastChecksRunAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : null;
    const issues: TwinIssue[] =
      invoiceExceptions.length > 0
        ? invoiceExceptions.slice(0, 3).map((exception) => ({
            id: exception.id,
            title: exception.checkName,
            severity: toTwinIssueSeverity(exception.severity),
            note: exception.message,
            field: exception.field,
            invoiceId: exception.invoiceId,
            checkId: exception.checkId,
          }))
        : [
            {
              id: `${header.invoice_id}-no-issues`,
              title: 'No workflow exceptions currently linked to this invoice.',
              severity: 'Medium',
              note: 'Run checks to populate invoice-specific issue context here.',
            },
          ];

    const nodes: TwinNode[] = [
      {
        id: `${header.invoice_id}-source`,
        label: 'ERP source row',
        type: 'source',
        status: header.source_row_number ? 'Captured' : 'Loaded',
        supportLine: `Invoice header ${sourceRow} from the ${dataset} dataset.`,
        stageSummary: 'The source stage represents the invoice record exactly as it is currently loaded into the workspace.',
        whatHappened: `${invoiceLabel} is loaded with issue date ${header.issue_date || 'not provided'} and counterparty ${header.buyer_id || 'not provided'}.`,
        whyItMatters: 'The twin should always begin from a traceable source record before mapping, rules, or workflow decisions are reviewed.',
        nextAction: 'Confirm the loaded source values and the original invoice identifiers before reviewing downstream stages.',
      },
      {
        id: `${header.invoice_id}-mapping`,
        label: 'Mapping profile',
        type: 'mapping',
        status: options.activeMappingProfile ? 'Profile linked' : isChecksRun ? 'Prepared' : 'Loaded',
        supportLine: `Current workspace data is aligned under ${mappingProfileLabel}.`,
        stageSummary: 'The mapping stage shows which governed mapping profile and canonical invoice shape the twin is currently relying on.',
        whatHappened: `${invoiceLabel} is available with ${lineCount} line item${lineCount === 1 ? '' : 's'}, ${mappedFieldCount} populated header field${mappedFieldCount === 1 ? '' : 's'}, and currency ${header.currency || 'not provided'}.`,
        whyItMatters: 'The mapping stage needs to make the governing profile and current field coverage visible before operators trust downstream controls.',
        nextAction: options.activeMappingProfile
          ? `Review mapping profile ${mappingProfileLabel} if field alignment or transformation coverage needs closer inspection.`
          : 'No explicit mapping profile is linked yet. Use Mapping Studio if this invoice needs a governed profile before the next run.',
      },
      {
        id: `${header.invoice_id}-rule`,
        label: 'Validation rule',
        type: 'rule',
        status: !isChecksRun ? 'Pending run' : issueCount > 0 ? `${worstSeverity || 'Open'} issue` : 'Passed',
        supportLine: 'Validation outcomes are summarized from the current run state for this invoice.',
        stageSummary: 'The rule stage reports whether governed validation has been executed and whether it produced invoice-linked findings.',
        whatHappened: !isChecksRun
          ? 'Checks have not been run yet for the current workspace dataset.'
          : issueCount > 0
          ? `${issueCount} exception${issueCount === 1 ? '' : 's'} are currently linked to ${invoiceLabel}.`
          : `No linked exceptions were found for ${invoiceLabel} in the current run.`,
        whyItMatters: 'This stage turns loaded invoice data into an explainable control outcome that operators can act on.',
        nextAction: issueCount > 0 ? 'Inspect the linked exception details and confirm whether the issue is source-driven or transformation-driven.' : 'If more validation evidence is needed, rerun checks and compare outcomes.',
      },
      {
        id: `${header.invoice_id}-exception`,
        label: 'Exception case',
        type: 'exception',
        status: issueCount > 0 ? `${issueCount} linked` : 'No exceptions',
        supportLine: 'Workflow-linked issue context is derived from the current exception set for this invoice.',
        stageSummary: 'The exception stage shows how invoice-specific findings are carried into operator review and resolution workflow.',
        whatHappened: issueCount > 0
          ? `The current run links ${issueCount} workflow exception${issueCount === 1 ? '' : 's'}${invoicePintExceptionCount > 0 ? ` plus ${invoicePintExceptionCount} PINT-AE exception${invoicePintExceptionCount === 1 ? '' : 's'}` : ''} to ${invoiceLabel}.`
          : 'No active workflow exceptions are currently attached to this invoice.',
        whyItMatters: 'Issue handling should remain attached to the same invoice journey, rather than forcing teams to reconstruct context across screens.',
        nextAction: issueCount > 0 ? 'Open the exceptions workspace to review the linked issue narrative and remediation path.' : 'Continue monitoring this invoice during future runs if additional issues emerge.',
      },
      {
        id: `${header.invoice_id}-evidence`,
        label: 'Evidence pack',
        type: 'evidence',
        status: isChecksRun ? 'Run available' : 'Pending run',
        supportLine: runRecency ? `Latest ${dataset} run completed ${runRecency}.` : 'Evidence readiness reflects whether this invoice has progressed through a completed validation run.',
        stageSummary: 'The evidence stage summarizes whether the current workspace has enough run context and portfolio evidence to support later packaging.',
        whatHappened: isChecksRun
          ? `${invoiceLabel} is part of the latest validation state${options.runSummary ? ` across ${options.runSummary.total_invoices_tested} invoice${options.runSummary.total_invoices_tested === 1 ? '' : 's'} with ${options.runSummary.total_exceptions} total exception${options.runSummary.total_exceptions === 1 ? '' : 's'} and ${options.runSummary.pass_rate_percent.toFixed(1)}% pass rate` : ''}.`
          : 'Evidence context will become meaningful after the validation run has been executed.',
        whyItMatters: 'Evidence should be the last stage of the same invoice journey so audit narratives do not need to be rebuilt elsewhere.',
        nextAction: isChecksRun ? 'Open the evidence workspace when you want to continue from invoice context into audit packaging.' : 'Run checks first so evidence and control context can be attached to this invoice.',
      },
    ];

    return {
      id: `live-${dataset}-${header.invoice_id}`,
      entity,
      dataset,
      invoice: invoiceLabel,
      viewHint:
        dataset === 'AR'
          ? `Outbound invoice lineage for ${invoiceLabel} from loaded source data through validation and evidence context.`
          : `Inbound invoice lineage for ${invoiceLabel} from loaded supplier data through validation and evidence context.`,
      summary: `${invoiceLabel} is built from live workspace data with ${lineCount} line item${lineCount === 1 ? '' : 's'} and ${issueCount} linked exception${issueCount === 1 ? '' : 's'}.`,
      notes: [
        `Issue date: ${header.issue_date || 'not provided'}. Currency: ${header.currency || 'not provided'}.`,
        `Seller reference: ${header.seller_name || header.seller_trn || 'not provided'}. Buyer reference: ${buyerName}.`,
        `Mapping profile: ${mappingProfileLabel}. Source row: ${header.source_row_number ?? 'not provided'}.`,
        isChecksRun ? 'The current twin is grounded in the latest loaded validation state.' : 'Run checks to enrich this twin with rule and exception outcomes.',
      ],
      issues,
      nodes,
      edgeCount: 4,
      metadata: {
        invoiceId: header.invoice_id,
        buyerName,
        lineCount,
        issueCount,
        sourceRowNumber: header.source_row_number,
        mappingProfileLabel,
        runLabel: runRecency,
        primaryField: invoiceExceptions[0]?.field,
      },
    };
  });
}

export default function DataTwinPage() {
  const navigate = useNavigate();
  const {
    getDataForDataset,
    getInvoiceDetails,
    exceptions,
    isChecksRun,
    activeMappingProfileByDirection,
    lastChecksRunAt,
    lastChecksRunDatasetType,
    runSummary,
  } = useCompliance();
  const [entityFilter, setEntityFilter] = useState('all');
  const [datasetFilter, setDatasetFilter] = useState<DatasetFilter>('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('lineage');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const runtimeContexts = useMemo(() => {
    const arData = getDataForDataset('AR');
    const apData = getDataForDataset('AP');
    const arExceptions = exceptions.filter((exception) => (exception.datasetType || 'AR') === 'AR');
    const apExceptions = exceptions.filter((exception) => (exception.datasetType || 'AR') === 'AP');

    return [
      ...buildLiveTwinContext('AR', arData, arExceptions, isChecksRun, {
        getInvoiceDetails,
        activeMappingProfile: activeMappingProfileByDirection.AR,
        lastChecksRunAt,
        lastChecksRunDatasetType,
        runSummary,
      }),
      ...buildLiveTwinContext('AP', apData, apExceptions, isChecksRun, {
        getInvoiceDetails,
        activeMappingProfile: activeMappingProfileByDirection.AP,
        lastChecksRunAt,
        lastChecksRunDatasetType,
        runSummary,
      }),
    ];
  }, [
    activeMappingProfileByDirection.AP,
    activeMappingProfileByDirection.AR,
    exceptions,
    getDataForDataset,
    getInvoiceDetails,
    isChecksRun,
    lastChecksRunAt,
    lastChecksRunDatasetType,
    runSummary,
  ]);

  const twinContexts = runtimeContexts.length > 0 ? runtimeContexts : TWIN_CONTEXTS;

  const entityOptions = useMemo(
    () => ['all', ...Array.from(new Set(twinContexts.map((context) => context.entity)))],
    [twinContexts]
  );

  const visibleContexts = useMemo(
    () =>
      twinContexts.filter((context) => {
        if (entityFilter !== 'all' && context.entity !== entityFilter) return false;
        if (datasetFilter !== 'all' && context.dataset !== datasetFilter) return false;
        return true;
      }),
    [datasetFilter, entityFilter, twinContexts]
  );

  const invoiceOptions = useMemo(
    () => ['all', ...visibleContexts.map((context) => context.invoice)],
    [visibleContexts]
  );

  const activeContext = useMemo(() => {
    if (invoiceFilter !== 'all') {
      return visibleContexts.find((context) => context.invoice === invoiceFilter) ?? visibleContexts[0] ?? twinContexts[0];
    }

    return visibleContexts[0] ?? twinContexts[0];
  }, [invoiceFilter, twinContexts, visibleContexts]);

  useEffect(() => {
    if (!invoiceOptions.includes(invoiceFilter)) {
      setInvoiceFilter('all');
    }
  }, [invoiceFilter, invoiceOptions]);

  useEffect(() => {
    if (!activeContext?.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(activeContext.nodes[0]?.id ?? null);
    }
  }, [activeContext, selectedNodeId]);

  const selectedNode =
    activeContext.nodes.find((node) => node.id === selectedNodeId) ?? activeContext.nodes[0] ?? null;
  const selectedStageIndex = selectedNode ? getStageIndex(selectedNode.type) : 0;
  const selectedRecordNotes = selectedNode ? getSelectedNodeRecordNotes(activeContext, selectedNode) : activeContext.notes;
  const primaryAction = selectedNode ? getPrimaryAction(selectedNode, activeContext) : null;
  const secondaryAction = selectedNode ? getSecondaryAction(selectedNode, activeContext) : null;
  const nodesByType = useMemo(
    () => new Map(activeContext.nodes.map((node) => [node.type, node])),
    [activeContext.nodes]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Entity" value={entityFilter} onValueChange={setEntityFilter} options={entityOptions} placeholder="All entities" />
            <FilterField
              label="Dataset"
              value={datasetFilter}
              onValueChange={(value) => setDatasetFilter(value as DatasetFilter)}
              options={['all', 'AR', 'AP']}
              placeholder="All datasets"
            />
            <FilterField label="Invoice" value={invoiceFilter} onValueChange={setInvoiceFilter} options={invoiceOptions} placeholder="All invoices" />
            <FilterField
              label="View mode"
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              options={['lineage', 'record', 'control']}
              placeholder="View mode"
              formatOption={(value) => VIEW_MODE_LABELS[value as ViewMode]}
            />
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/78 p-4 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current twin</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-foreground">{activeContext.invoice}</p>
                  <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                    {activeContext.dataset}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{activeContext.entity}</span>
                </div>
              </div>
              <Badge variant="outline" className="border-border/70 bg-background/80">
                {VIEW_MODE_LABELS[viewMode]}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Invoice lineage canvas</h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  A structured lineage workspace designed to make stage progression, node context, and related workflow
                  actions understandable at a glance.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/88 dark:bg-card/96">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 grid-veil opacity-40 dark:opacity-15" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_38%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.09),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_26%)]" />
              </div>

              <div className="relative border-b border-border/60 bg-background/70 px-4 py-3 dark:bg-background/18">
                <div className="space-y-2">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                        {VIEW_MODE_LABELS[viewMode]}
                      </Badge>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-foreground">{activeContext.viewHint}</p>
                  </div>
                </div>
              </div>

              <div className="relative px-4 py-4 md:px-5 md:py-5">
                <div className="pointer-events-none absolute inset-x-10 top-[34px] hidden xl:block">
                  <div className="relative h-[2px] rounded-full bg-border/70">
                    <div
                      className="absolute left-0 top-0 h-[2px] rounded-full bg-gradient-to-r from-primary/85 via-emerald-400/75 to-emerald-500/70 transition-all duration-300"
                      style={{
                        width:
                          selectedStageIndex <= 0
                            ? '0%'
                            : `${(selectedStageIndex / (STAGE_ORDER.length - 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:gap-7">
                  {STAGE_ORDER.map((type, index) => {
                    const node = nodesByType.get(type);
                    const isActiveStage = index <= selectedStageIndex;
                    const isSelectedStage = selectedNode?.type === type;
                    const isDimmedStage = index > selectedStageIndex;
                    const connectorIsActive = index < selectedStageIndex;

                    return (
                      <div
                        key={type}
                        className={cn(
                          'relative flex h-full flex-col space-y-3 pt-9 transition-all duration-300 xl:space-y-4',
                          isDimmedStage && 'opacity-92'
                        )}
                      >
                        <div className="absolute left-1/2 top-0 hidden -translate-x-1/2 xl:flex xl:flex-col xl:items-center">
                          <span
                            className={cn(
                              'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm transition-colors duration-300',
                              isSelectedStage
                                ? 'border-primary/30 bg-primary text-primary-foreground'
                                : isActiveStage
                                ? 'border-primary/20 bg-primary/12 text-primary'
                                : 'border-border/70 bg-background/90 text-muted-foreground'
                            )}
                          >
                            {index + 1}
                          </span>
                          <span
                            className={cn(
                              'mt-1 h-4 w-px transition-colors duration-300',
                              isActiveStage ? 'bg-primary/55' : 'bg-border/70'
                            )}
                          />
                        </div>
                        {node ? (
                          <div className="relative h-full">
                            <TwinNodeCard
                              node={node}
                              selected={selectedNode?.id === node.id}
                              active={isActiveStage}
                              dimmed={isDimmedStage}
                              onSelect={() => setSelectedNodeId(node.id)}
                            />
                            {index < STAGE_ORDER.length - 1 ? (
                              <div className="pointer-events-none absolute left-full top-[14px] hidden items-center xl:flex">
                                <span
                                  className={cn(
                                    'h-[2px] w-7 rounded-full transition-colors duration-300',
                                    connectorIsActive ? 'bg-primary/70' : 'bg-border/70'
                                  )}
                                />
                                <span
                                  className={cn(
                                    'h-2.5 w-2.5 rotate-45 border-r border-t transition-colors duration-300',
                                    connectorIsActive ? 'border-primary/70' : 'border-border/70'
                                  )}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          {selectedNode ? (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="outline" className={cn('text-xs', NODE_STYLES[selectedNode.type].badgeClass)}>
                    {NODE_STYLES[selectedNode.type].label} node
                  </Badge>
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-semibold text-foreground">{selectedNode.label}</h2>
                    <p className="text-sm text-muted-foreground">{selectedNode.status}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
                  {(() => {
                    const Icon = NODE_STYLES[selectedNode.type].icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-background/76 p-3.5">
                <p className="text-sm font-semibold text-foreground">What this stage is</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedNode.stageSummary}</p>
              </div>

              <div className="rounded-[24px] border border-primary/10 bg-background/88 p-3.5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.2)]">
                <p className="text-sm font-semibold text-foreground">What happened</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedNode.whatHappened}</p>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-background/76 p-3.5">
                <p className="text-sm font-semibold text-foreground">Why it matters</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedNode.whyItMatters}
                </p>
              </div>

              <div className="rounded-[24px] border border-primary/12 bg-primary/5 p-3.5 shadow-[0_14px_30px_-24px_rgba(37,99,235,0.22)]">
                <p className="text-sm font-semibold text-foreground">Next action</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedNode.nextAction}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {secondaryAction ? (
                    <Button variant="outline" className="rounded-full" onClick={() => navigate(secondaryAction.path)}>
                      {secondaryAction.label}
                    </Button>
                  ) : null}
                  {primaryAction ? (
                    <Button className="rounded-full" onClick={() => navigate(primaryAction.path)}>
                      {primaryAction.label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
        <Tabs defaultValue="summary" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Twin workspace details</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Trace context</h2>
            </div>
            <TabsList className="rounded-full bg-muted/60 p-1">
              <TabsTrigger value="summary" className="rounded-full px-4">Trace summary</TabsTrigger>
              <TabsTrigger value="notes" className="rounded-full px-4">Record notes</TabsTrigger>
              <TabsTrigger value="issues" className="rounded-full px-4">Related issues</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary">
            <div className="grid gap-3 lg:grid-cols-3">
              <SummaryCard
                label="Invoice"
                value={activeContext.invoice}
                note={`Entity: ${activeContext.entity}`}
              />
              <SummaryCard
                label="Selected stage"
                value={`${NODE_STYLES[selectedNode.type].label} - ${selectedNode.status}`}
                note={`Step ${selectedStageIndex + 1} of ${activeContext.nodes.length} on this invoice journey.`}
              />
              <SummaryCard
                label="Linked issues"
                value={`${activeContext.metadata?.issueCount ?? activeContext.issues.length}`}
                note={activeContext.metadata?.lineCount !== undefined
                  ? `${activeContext.metadata.lineCount} line item${activeContext.metadata.lineCount === 1 ? '' : 's'} loaded for this invoice.`
                  : 'Invoice-specific issue context is shown here when available.'}
              />
            </div>
          </TabsContent>

          <TabsContent value="notes">
            <div className="grid gap-3">
              {selectedRecordNotes.map((note, index) => (
                <div key={`${activeContext.id}-note-${index}`} className="rounded-[20px] border border-border/70 bg-background/78 px-4 py-3 text-sm leading-6 text-muted-foreground">
                  {note}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div className="grid gap-3">
              {activeContext.issues.length > 0 ? (
                activeContext.issues.map((issue) => (
                  <div key={issue.id} className="rounded-[22px] border border-border/70 bg-background/78 p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', getSeverityClass(issue.severity))}>
                        {issue.severity}
                      </span>
                      <p className="text-sm font-semibold text-foreground">{issue.title}</p>
                      {issue.field ? (
                        <Badge variant="outline" className="border-border/70 bg-background/80 text-xs">
                          {issue.field}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.note}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate('/exceptions')}>
                        Review In Exceptions
                      </Button>
                      {issue.invoiceId ? (
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate(`/invoice/${encodeURIComponent(issue.invoiceId)}`)}>
                          Open Invoice Detail
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-border/70 bg-background/78 p-4 text-sm leading-6 text-muted-foreground shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]">
                  No invoice-specific issues are currently linked to this twin.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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

function TwinNodeCard({
  node,
  selected,
  active,
  dimmed,
  onSelect,
}: {
  node: TwinNode;
  selected: boolean;
  active: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const config = NODE_STYLES[node.type];
  const Icon = config.icon;

  return (
    <button
      type="button"
      aria-label={node.label}
      aria-pressed={selected}
      className={cn(
        'group flex h-full min-h-[232px] w-full flex-col justify-between rounded-[24px] border bg-background/88 p-5 text-left shadow-[0_16px_28px_-24px_rgba(15,23,42,0.24)] transition duration-300 hover:-translate-y-0.5 dark:bg-card/84',
        config.cardClass,
        active && 'shadow-[0_18px_36px_-24px_rgba(34,197,94,0.28)]',
        selected && 'border-primary/35 bg-background ring-2 ring-primary/50 shadow-[0_22px_44px_-24px_rgba(34,197,94,0.34)]',
        dimmed && 'opacity-92 saturate-95'
      )}
      onClick={onSelect}
    >
      <div className="space-y-5">
        <div className="space-y-2.5">
          <p className="text-lg font-semibold leading-6 text-foreground">{config.label}</p>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              config.badgeClass
            )}
          >
            {node.status}
          </span>
        </div>
        <p className="max-w-[16ch] text-sm leading-7 text-muted-foreground">{node.supportLine}</p>
      </div>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-background/78 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}
