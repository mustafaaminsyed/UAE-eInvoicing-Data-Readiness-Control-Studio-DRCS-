import { useMemo, useState } from "react";
import { BookCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { checksRegistry } from "@/lib/checks/checksRegistry";
import UAE_UC1_CHECK_PACK from "@/lib/checks/uaeUC1CheckPack";

type RegistrySource = "Built-in" | "UAE UC1";

interface RegistryRow {
  id: string;
  name: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  source: RegistrySource;
  scope: string;
  ruleType: string;
  ownerTeam?: string;
  mofRuleReference?: string;
  useCase?: string;
  suggestedFix?: string;
  evidenceRequired?: string;
  references: string[];
  enabled: boolean;
  passExample: string;
  failExample: string;
}

const severityClasses: Record<RegistryRow["severity"], string> = {
  Critical: "bg-destructive/10 text-destructive border-destructive/20",
  High: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Low: "bg-sky-500/10 text-sky-700 border-sky-500/20",
};

const severityGuide: Array<{
  level: RegistryRow["severity"];
  title: string;
  guidance: string;
}> = [
  {
    level: "Critical",
    title: "Stop-and-fix issues",
    guidance:
      "Core compliance blockers. Typically breaks submission, legal validity, or key financial integrity and needs immediate remediation.",
  },
  {
    level: "High",
    title: "Major compliance risks",
    guidance:
      "Serious errors that can cause rejection, regulatory risk, or material reporting issues. Prioritize for near-term fix.",
  },
  {
    level: "Medium",
    title: "Important quality gaps",
    guidance:
      "Does not usually block processing immediately, but weakens compliance quality and should be resolved in normal remediation cycles.",
  },
  {
    level: "Low",
    title: "Minor or advisory issues",
    guidance:
      "Low-impact gaps and data hygiene improvements. Fix as part of continuous quality hardening.",
  },
];

const severityOrder: Record<RegistryRow["severity"], number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const builtInExamples: Record<string, { pass: string; fail: string }> = {
  buyer_trn_missing: {
    pass: 'Buyer record includes `buyer_trn = "100123456700003"`.',
    fail: "Buyer record has empty or missing TRN field.",
  },
  buyer_trn_invalid_format: {
    pass: "TRN has exactly 15 digits.",
    fail: 'TRN format like `"AE-12345"` or too-short values.',
  },
  duplicate_invoice_number: {
    pass: "Each seller TRN uses unique invoice numbers.",
    fail: "Same seller has repeated invoice number across headers.",
  },
  header_totals_mismatch: {
    pass: "Header totals satisfy Total = Net + VAT.",
    fail: "Header total with tax does not equal net plus VAT.",
  },
  line_totals_mismatch: {
    pass: "Line net equals (quantity x unit price) minus discount.",
    fail: "Line net value does not match quantity/price math.",
  },
  vat_calc_mismatch: {
    pass: "Line VAT amount equals line net x VAT rate.",
    fail: "Line VAT amount differs from computed tax value.",
  },
  negative_without_credit_note: {
    pass: "Negative lines appear only on credit note invoices.",
    fail: "Negative line appears on standard invoice type.",
  },
  buyer_not_found: {
    pass: "Every header buyer_id matches a buyer record.",
    fail: "Header has buyer_id missing or not present in buyers file.",
  },
  missing_mandatory_fields: {
    pass: "Header has invoice_id, invoice_number, issue_date, seller_trn, currency.",
    fail: "Any mandatory header field is missing or blank.",
  },
  mixed_vat_rates_no_total: {
    pass: "Mixed VAT rates include non-zero VAT total.",
    fail: "Invoice with mixed VAT rates has VAT total missing/zero.",
  },
};

function normalizeRows(): RegistryRow[] {
  const builtInRows: RegistryRow[] = checksRegistry.map((check) => ({
    id: check.id,
    name: check.name,
    description: check.description,
    severity: check.severity,
    source: "Built-in",
    scope: check.category.toUpperCase(),
    ruleType: "Custom",
    ownerTeam: "Internal rules engine",
    references: [],
    enabled: true,
    passExample: builtInExamples[check.id]?.pass ?? "Input data satisfies this validation condition.",
    failExample: builtInExamples[check.id]?.fail ?? "Input data violates this validation condition.",
  }));

  const uc1Rows: RegistryRow[] = UAE_UC1_CHECK_PACK.map((check) => ({
    id: check.check_id,
    name: check.check_name,
    description: check.description ?? "UAE UC1 validation check.",
    severity: check.severity,
    source: "UAE UC1",
    scope: check.scope,
    ruleType: check.rule_type,
    ownerTeam: check.owner_team_default,
    mofRuleReference: check.mof_rule_reference,
    useCase: check.use_case,
    suggestedFix: check.suggested_fix,
    evidenceRequired: check.evidence_required,
    references: check.pint_reference_terms ?? [],
    enabled: check.is_enabled,
    passExample: check.pass_condition ?? "Invoice data passes the expected condition.",
    failExample: check.fail_condition ?? "Invoice data fails the expected condition.",
  }));

  return [...builtInRows, ...uc1Rows].sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] || a.id.localeCompare(b.id)
  );
}

export default function CheckRegistryPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"All" | RegistryRow["severity"]>("All");
  const [sourceFilter, setSourceFilter] = useState<"All" | RegistrySource>("All");

  const rows = useMemo(() => normalizeRows(), []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (severityFilter !== "All" && row.severity !== severityFilter) return false;
      if (sourceFilter !== "All" && row.source !== sourceFilter) return false;
      if (!search.trim()) return true;

      const q = search.toLowerCase();
      return (
        row.id.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.references.some((term) => term.toLowerCase().includes(q)) ||
        row.passExample.toLowerCase().includes(q) ||
        row.failExample.toLowerCase().includes(q)
      );
    });
  }, [rows, search, severityFilter, sourceFilter]);

  const builtInCount = rows.filter((row) => row.source === "Built-in").length;
  const uc1Count = rows.filter((row) => row.source === "UAE UC1").length;
  const enabledUc1Count = rows.filter((row) => row.source === "UAE UC1" && row.enabled).length;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8">
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
            <BookCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Check & Validation Repository</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog of all active validation checks, rule references, and severity levels.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total Checks" value={rows.length} />
          <SummaryCard label="Built-in Checks" value={builtInCount} />
          <SummaryCard label="UAE UC1 Checks" value={uc1Count} />
          <SummaryCard label="Enabled UC1" value={enabledUc1Count} />
        </div>

        <Card className="border shadow-sm mb-6">
          <CardContent className="p-4 md:p-5">
            <h2 className="text-sm font-semibold text-foreground">Severity Guide</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Use this legend to understand remediation urgency before reviewing individual check cards.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {severityGuide.map((item) => (
                <SeverityGuideTile
                  key={item.level}
                  level={item.level}
                  title={item.title}
                  guidance={item.guidance}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center mb-4">
              <div className="relative md:max-w-sm md:flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  aria-label="Search checks"
                  placeholder="Search by ID, name, or PINT reference..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterButton
                  active={severityFilter === "All"}
                  onClick={() => setSeverityFilter("All")}
                  label="All Severities"
                />
                {(["Critical", "High", "Medium", "Low"] as const).map((severity) => (
                  <FilterButton
                    key={severity}
                    active={severityFilter === severity}
                    onClick={() => setSeverityFilter(severity)}
                    label={severity}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterButton
                  active={sourceFilter === "All"}
                  onClick={() => setSourceFilter("All")}
                  label="All Sources"
                />
                <FilterButton
                  active={sourceFilter === "Built-in"}
                  onClick={() => setSourceFilter("Built-in")}
                  label="Built-in"
                />
                <FilterButton
                  active={sourceFilter === "UAE UC1"}
                  onClick={() => setSourceFilter("UAE UC1")}
                  label="UAE UC1"
                />
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                No checks match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredRows.map((row) => (
                  <CheckCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CheckCard({ row }: { row: RegistryRow }) {
  return (
    <Card className="border h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-primary">{row.id}</p>
            <h3 className="text-base font-semibold text-foreground leading-tight">{row.name}</h3>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge variant="outline" className={severityClasses[row.severity]}>
              {row.severity}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {row.source}
            </Badge>
            {!row.enabled && (
              <Badge variant="outline" className="text-[11px]">
                Disabled
              </Badge>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{row.description}</p>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[11px]">Scope: {row.scope}</Badge>
          <Badge variant="secondary" className="text-[11px]">Type: {row.ruleType}</Badge>
          {row.ownerTeam && (
            <Badge variant="secondary" className="text-[11px]">Owner: {row.ownerTeam}</Badge>
          )}
          {row.mofRuleReference && (
            <Badge variant="secondary" className="text-[11px]">MoF: {row.mofRuleReference}</Badge>
          )}
          {row.useCase && (
            <Badge variant="secondary" className="text-[11px]">{row.useCase}</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ExampleBlock title="Pass Example" text={row.passExample} tone="pass" />
          <ExampleBlock title="Fail Example" text={row.failExample} tone="fail" />
        </div>

        {row.suggestedFix && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Suggested Fix</p>
            <p className="text-xs text-foreground mt-1">{row.suggestedFix}</p>
          </div>
        )}

        {row.evidenceRequired && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Evidence To Collect</p>
            <p className="text-xs text-foreground mt-1">{row.evidenceRequired}</p>
          </div>
        )}

        {row.references.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {row.references.map((reference) => (
              <Badge key={`${row.id}-${reference}`} variant="outline" className="text-[10px]">
                {reference}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExampleBlock({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "pass" | "fail";
}) {
  const cls =
    tone === "pass"
      ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5"
      : "border-destructive/30 bg-destructive/5";

  return (
    <div className={`rounded-md border p-2.5 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-xs text-foreground mt-1">{text}</p>
    </div>
  );
}

function SeverityGuideTile({
  level,
  title,
  guidance,
}: {
  level: RegistryRow["severity"];
  title: string;
  guidance: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={severityClasses[level]}>
          {level}
        </Badge>
        <p className="text-xs font-medium text-foreground">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{guidance}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
