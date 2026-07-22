import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  CircleAlert,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { WorkflowNavigator, buildWorkflowItems } from '@/components/shared/WorkflowNavigator';
import { WorkflowPageHeader } from '@/components/shared/WorkflowPageHeader';
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
import { WORKFLOW_UTILITY_BUTTON_CLASS } from '@/lib/workflowShellStyles';
import type { Severity } from '@/types/compliance';

type ValidationCategory =
  | 'Schema'
  | 'Counterparty'
  | 'Tax'
  | 'Calculation'
  | 'Workflow';

type ValidationStatus = 'Passed' | 'Failed' | 'Review';

interface ValidationRule {
  id: string;
  name: string;
  category: ValidationCategory;
  severity: Severity;
  status: ValidationStatus;
  affectedRecords: number;
  description: string;
  whyItMatters: string;
  sampleFields: string[];
  sampleRecords: string[];
  nextAction: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'UAE-UC1-CHK-012',
    name: 'Seller identity completeness',
    category: 'Counterparty',
    severity: 'Critical',
    status: 'Failed',
    affectedRecords: 18,
    description: 'Confirms that regulated seller identity fields are present before the invoice proceeds to submission.',
    whyItMatters: 'Missing seller identity details can block regulator acceptance and weaken audit traceability.',
    sampleFields: ['seller_name', 'seller_trn', 'seller_address'],
    sampleRecords: ['INV-10428', 'INV-10432', 'INV-10491'],
    nextAction: 'Review source master data and correct missing seller identity values before rerunning validation.',
  },
  {
    id: 'UAE-UC1-CHK-018',
    name: 'Buyer TRN format',
    category: 'Counterparty',
    severity: 'High',
    status: 'Failed',
    affectedRecords: 11,
    description: 'Checks whether buyer tax registration identifiers match the required governed format.',
    whyItMatters: 'Malformed registration identifiers can cause rejection, reconciliation issues, and downstream exception churn.',
    sampleFields: ['buyer_trn', 'buyer_id'],
    sampleRecords: ['INV-10398', 'INV-10411', 'INV-10476'],
    nextAction: 'Coordinate with the data owner to normalize buyer registration values and confirm reference sources.',
  },
  {
    id: 'UAE-UC1-CHK-024',
    name: 'Invoice header mandatory fields',
    category: 'Schema',
    severity: 'Critical',
    status: 'Passed',
    affectedRecords: 0,
    description: 'Ensures core invoice header fields are present across the evaluated population.',
    whyItMatters: 'Header completeness is the baseline gate for deterministic validation and evidence generation.',
    sampleFields: ['invoice_number', 'issue_date', 'currency'],
    sampleRecords: ['INV-10244', 'INV-10301'],
    nextAction: 'No immediate action. Keep this rule stable while upstream template changes are introduced.',
  },
  {
    id: 'UAE-UC1-CHK-031',
    name: 'VAT amount reconciliation',
    category: 'Calculation',
    severity: 'High',
    status: 'Review',
    affectedRecords: 7,
    description: 'Compares expected VAT amounts against header and line-level calculations for consistency.',
    whyItMatters: 'Calculation drift creates filing risk and usually points to either mapping issues or manual overrides.',
    sampleFields: ['vat_total', 'vat_amount', 'tax_category_rate'],
    sampleRecords: ['INV-10405', 'INV-10454'],
    nextAction: 'Inspect whether the mismatch comes from source math, mapping logic, or rounding policy before escalation.',
  },
  {
    id: 'UAE-UC1-CHK-037',
    name: 'Tax category coherence',
    category: 'Tax',
    severity: 'Medium',
    status: 'Review',
    affectedRecords: 6,
    description: 'Checks whether tax category codes remain coherent with the chosen VAT treatment and invoice content.',
    whyItMatters: 'Inconsistent tax categories reduce explainability and can create downstream evidence gaps.',
    sampleFields: ['tax_category_code', 'vat_rate', 'invoice_type'],
    sampleRecords: ['INV-10377', 'INV-10420'],
    nextAction: 'Confirm the intended VAT treatment for these scenarios and align tax category mapping guidance.',
  },
  {
    id: 'UAE-UC1-CHK-044',
    name: 'Line net total math',
    category: 'Calculation',
    severity: 'High',
    status: 'Passed',
    affectedRecords: 0,
    description: 'Verifies that line net values reconcile with quantity, unit price, and discount assumptions.',
    whyItMatters: 'Line-level math integrity is foundational for total reconciliation and downstream evidence packaging.',
    sampleFields: ['quantity', 'unit_price', 'line_total_excl_vat'],
    sampleRecords: ['INV-10219', 'INV-10277'],
    nextAction: 'No action required. Keep monitoring this rule alongside future pricing or discount model changes.',
  },
  {
    id: 'UAE-UC1-CHK-052',
    name: 'Duplicate invoice number detection',
    category: 'Workflow',
    severity: 'Medium',
    status: 'Passed',
    affectedRecords: 0,
    description: 'Detects duplicated invoice numbers within the current validation scope.',
    whyItMatters: 'Duplicate operational identifiers cause confusion in triage, evidence, and regulator-facing reporting.',
    sampleFields: ['invoice_number', 'seller_trn'],
    sampleRecords: ['INV-10044', 'INV-10111'],
    nextAction: 'No immediate action. Continue tracking as dataset volumes expand.',
  },
  {
    id: 'UAE-UC1-CHK-061',
    name: 'Run context completeness',
    category: 'Workflow',
    severity: 'Low',
    status: 'Passed',
    affectedRecords: 0,
    description: 'Confirms that the validation run carries enough metadata to support explainability and downstream review.',
    whyItMatters: 'Healthy run context improves operator trust and keeps evidence packages business-readable.',
    sampleFields: ['dataset_type', 'run_scope', 'mapping_profile'],
    sampleRecords: ['Run-AR-2026-03-20'],
    nextAction: 'No action required. Maintain this baseline as workflow telemetry evolves.',
  },
];

function getStatusClasses(status: ValidationStatus) {
  if (status === 'Passed') return 'border-success/25 bg-success/10 text-success';
  if (status === 'Review') return 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium';
  return 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical';
}

export default function ValidationPage() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(VALIDATION_RULES[0]?.id ?? null);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(VALIDATION_RULES.map((rule) => rule.category)))],
    []
  );

  const filteredRules = useMemo(
    () =>
      VALIDATION_RULES.filter((rule) => {
        if (categoryFilter !== 'all' && rule.category !== categoryFilter) return false;
        if (severityFilter !== 'all' && rule.severity !== severityFilter) return false;
        if (statusFilter !== 'all' && rule.status !== statusFilter) return false;
        return true;
      }),
    [categoryFilter, severityFilter, statusFilter]
  );

  useEffect(() => {
    if (!filteredRules.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId(filteredRules[0]?.id ?? null);
    }
  }, [filteredRules, selectedRuleId]);

  const selectedRule =
    filteredRules.find((rule) => rule.id === selectedRuleId) ??
    VALIDATION_RULES.find((rule) => rule.id === selectedRuleId) ??
    null;

  const summary = useMemo(() => {
    const total = VALIDATION_RULES.length;
    const passed = VALIDATION_RULES.filter((rule) => rule.status === 'Passed').length;
    const failed = VALIDATION_RULES.filter((rule) => rule.status === 'Failed').length;
    const criticalFailures = VALIDATION_RULES.filter(
      (rule) => rule.status === 'Failed' && rule.severity === 'Critical'
    ).length;

    return {
      total,
      passRate: Math.round((passed / total) * 100),
      failed,
      criticalFailures,
    };
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <WorkflowPageHeader
        title="Validation Explorer"
        description="Review rule outcomes, filter the current validation surface, and inspect failure context without leaving the workflow shell."
        icon={<FileSearch className="h-7 w-7" />}
        className="animate-fade-in"
        actions={
          <>
            <Button variant="outline" size="sm" className={WORKFLOW_UTILITY_BUTTON_CLASS} onClick={() => navigate('/check-registry')}>
              Open Check Registry
            </Button>
            <Button size="sm" className={WORKFLOW_UTILITY_BUTTON_CLASS} onClick={() => navigate('/run')}>
              Open Run Checks
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <WorkflowNavigator
        current="validation"
        fallbackPath="/run"
        className="animate-fade-in"
        helperText="Move through the ingestion workflow without losing context as you progress into mapping and validation."
        items={buildWorkflowItems(['mapping', 'run', 'validation', 'dashboard', 'exceptions'])}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Rules Evaluated"
          value={summary.total}
          subtitle="Current validation scope"
          icon={<BookCheck className="h-5 w-5" />}
          className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Pass Rate"
          value={`${summary.passRate}%`}
          subtitle="Rules currently passing"
          icon={<ShieldCheck className="h-5 w-5" />}
          variant={summary.passRate >= 75 ? 'success' : 'warning'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Failed Rules"
          value={summary.failed}
          subtitle="Rules requiring action"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={summary.failed > 0 ? 'warning' : 'default'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
        <StatsCard
          title="Critical Failures"
          value={summary.criticalFailures}
          subtitle="Immediate blockers"
          icon={<CircleAlert className="h-5 w-5" />}
          variant={summary.criticalFailures > 0 ? 'danger' : 'success'}
          className="rounded-[24px] border-border/70 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Rule explorer
                </p>
                <h2 className="text-xl font-semibold text-foreground">Validation rules</h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Review the current validation surface, filter rule outcomes, and inspect rule-level context without
                  leaving the workflow shell.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FilterField
                label="Category"
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                options={categories}
                placeholder="All categories"
              />
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
                options={['all', 'Passed', 'Failed', 'Review']}
                placeholder="All statuses"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {filteredRules.length} visible
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {VALIDATION_RULES.length} total
              </Badge>
              <span>Select a rule to inspect its operational context.</span>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/78">
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Rule ID</TableHead>
                    <TableHead>Rule name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Affected records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.length > 0 ? (
                    filteredRules.map((rule) => (
                      <TableRow
                        key={rule.id}
                        className={cn(
                          'cursor-pointer border-border/60 bg-transparent hover:bg-muted/35',
                          selectedRule?.id === rule.id && 'bg-primary/6'
                        )}
                        onClick={() => setSelectedRuleId(rule.id)}
                        aria-selected={selectedRule?.id === rule.id}
                      >
                        <TableCell className="font-medium text-foreground">{rule.id}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">{rule.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{rule.category}</TableCell>
                        <TableCell>
                          <SeverityBadge severity={rule.severity} />
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              getStatusClasses(rule.status)
                            )}
                          >
                            {rule.status}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{rule.affectedRecords}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-10 text-center">
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">No rules match the current filters.</p>
                          <p className="text-sm text-muted-foreground">
                            Adjust the category, severity, or status filters to bring more rules back into view.
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
          {selectedRule ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                    Selected rule
                  </Badge>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-foreground">{selectedRule.name}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{selectedRule.id}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
                  <FileSearch className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedRule.category}
                </Badge>
                <SeverityBadge severity={selectedRule.severity} />
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                    getStatusClasses(selectedRule.status)
                  )}
                >
                  {selectedRule.status}
                </span>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {selectedRule.affectedRecords} affected
                </Badge>
              </div>

              <DetailSection title="Rule description">
                {selectedRule.description}
              </DetailSection>

              <DetailSection title="Why it matters">
                {selectedRule.whyItMatters}
              </DetailSection>

              <DetailSection title="Sample affected fields / records">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.sampleFields.map((field) => (
                      <Badge key={field} variant="outline" className="border-border/70 bg-background/80">
                        {field}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.sampleRecords.map((record) => (
                      <Badge key={record} variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                        {record}
                      </Badge>
                    ))}
                  </div>
                </div>
              </DetailSection>

              <DetailSection title="Recommended next action">
                {selectedRule.nextAction}
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
