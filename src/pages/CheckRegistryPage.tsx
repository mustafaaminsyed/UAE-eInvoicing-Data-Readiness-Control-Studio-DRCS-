import { useEffect, useMemo, useState } from "react";
import { BookCheck, CircleHelp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { checksRegistry } from "@/lib/checks/checksRegistry";
import UAE_UC1_CHECK_PACK from "@/lib/checks/uaeUC1CheckPack";
import { fetchAllCustomChecks } from "@/lib/api/checksApi";
import type { CustomCheckConfig } from "@/types/customChecks";
import {
  PINT_AE_CODELIST_GOVERNANCE_COUNTS,
  countRuntimeCodelistDomains,
} from "@/lib/pintAE/codelistGovernanceSummary";
import { getAffectedDRIdsForRule } from "@/lib/rules/ruleTraceability";

type RegistrySource = "Built-in" | "UAE UC1" | "Custom";

interface RegistryRow {
  id: string;
  name: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  source: RegistrySource;
  scope: string;
  ruleType: string;
  executionLayer?: string;
  ownerTeam?: string;
  mofRuleReference?: string;
  useCase?: string;
  suggestedFix?: string;
  evidenceRequired?: string;
  authoritativeMappings: string[];
  references: string[];
  enabled: boolean;
  passExample: string;
  failExample: string;
}

const ruleTypeDisplayLabels: Record<string, string> = {
  dynamic_codelist: "Dynamic Codelist",
  fixed_literal: "Fixed Literal",
  enumeration: "Enumeration",
  dependency_rule: "Dependency Rule",
  structural_rule: "Structural Rule",
};

const executionLayerDisplayLabels: Record<string, string> = {
  schema: "Schema",
  codelist: "Codelist",
  national_rule: "National Rule",
  dependency_rule: "Dependency",
  semantic_rule: "Semantic",
};

const executionLayerGuidance: Record<string, string> = {
  schema: "Checks baseline field presence, structure, or shape assumptions.",
  codelist: "Checks a value against an official list of allowed codes.",
  national_rule: "Checks a UAE-specific fixed or enumerated national rule.",
  dependency_rule: "Checks whether one field becomes required because another condition is true.",
  semantic_rule: "Checks whether present values contradict UAE VAT treatment logic.",
};

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

function getCustomCheckExamples(
  check: CustomCheckConfig
): { passExample: string; failExample: string } {
  if (check.rule_type === "missing") {
    const field = check.parameters.field || "target field";
    return {
      passExample: `Field "${field}" is populated in each applicable record.`,
      failExample: `Field "${field}" is empty or null for one or more records.`,
    };
  }
  if (check.rule_type === "duplicate") {
    return {
      passExample: "Configured key fields are unique across the selected dataset scope.",
      failExample: "Duplicate key combinations are found in the selected dataset scope.",
    };
  }
  if (check.rule_type === "math") {
    return {
      passExample: "Calculated left and right expressions satisfy the configured operator/tolerance.",
      failExample: "Math expression comparison fails for one or more records.",
    };
  }
  if (check.rule_type === "regex") {
    const field = check.parameters.field || "target field";
    return {
      passExample: `Field "${field}" matches the configured regex pattern.`,
      failExample: `Field "${field}" value does not match the configured regex pattern.`,
    };
  }
  if (check.rule_type === "fuzzy_duplicate") {
    return {
      passExample: "No highly similar vendor+amount+date combinations are found.",
      failExample: "Potential duplicate invoice pair detected for AP investigation.",
    };
  }
  if (check.rule_type === "invoice_number_variant") {
    return {
      passExample: "Normalized invoice numbers are distinct.",
      failExample: "Near-matching normalized invoice numbers are found.",
    };
  }
  if (check.rule_type === "trn_format_similarity") {
    return {
      passExample: "Vendor TRNs are consistently formatted.",
      failExample: "Similar TRN values suggest formatting variance or possible data issue.",
    };
  }
  return {
    passExample: "Custom formula evaluates to true for each applicable record.",
    failExample: "Custom formula evaluates to false for one or more records.",
  };
}

function getRuleTypeLabel(ruleType: string): string {
  return ruleTypeDisplayLabels[ruleType] ?? ruleType.replace(/_/g, " ");
}

function getExecutionLayerLabel(executionLayer?: string): string | undefined {
  if (!executionLayer) return undefined;
  return executionLayerDisplayLabels[executionLayer] ?? executionLayer.replace(/_/g, " ");
}

function normalizeRows(customChecks: CustomCheckConfig[]): RegistryRow[] {
  const builtInRows: RegistryRow[] = checksRegistry.map((check) => ({
    id: check.id,
    name: check.name,
    description: check.description,
    severity: check.severity,
    source: "Built-in",
    scope: check.category.toUpperCase(),
    ruleType: "Custom",
    ownerTeam: "Internal rules engine",
    authoritativeMappings: [],
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
    executionLayer: check.execution_layer,
    ownerTeam: check.owner_team_default,
    mofRuleReference: check.mof_rule_reference,
    useCase: check.use_case,
    suggestedFix: check.suggested_fix,
    evidenceRequired: check.evidence_required,
    authoritativeMappings: getAffectedDRIdsForRule(check.check_id),
    references: check.pint_reference_terms ?? [],
    enabled: check.is_enabled,
    passExample: check.pass_condition ?? "Invoice data passes the expected condition.",
    failExample: check.fail_condition ?? "Invoice data fails the expected condition.",
  }));

  const customRows: RegistryRow[] = customChecks.map((check) => {
    const examples = getCustomCheckExamples(check);
    return {
      id: check.id || `custom-${check.name}`,
      name: check.name,
      description: check.description ?? "User-defined custom check.",
      severity: check.severity,
      source: "Custom",
      scope: check.dataset_scope.toUpperCase(),
      ruleType: `${check.check_type || "VALIDATION"} / ${check.rule_type}`,
      ownerTeam: "Configured via Check Builder",
      authoritativeMappings: [],
      references: [],
      enabled: check.is_active,
      suggestedFix: "Review this custom rule configuration and update source data accordingly.",
      passExample: examples.passExample,
      failExample: examples.failExample,
    };
  });

  return [...builtInRows, ...uc1Rows, ...customRows].sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] || a.id.localeCompare(b.id)
  );
}

export default function CheckRegistryPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"All" | RegistryRow["severity"]>("All");
  const [sourceFilter, setSourceFilter] = useState<"All" | RegistrySource>("All");
  const [customChecks, setCustomChecks] = useState<CustomCheckConfig[]>([]);

  useEffect(() => {
    fetchAllCustomChecks().then(setCustomChecks);
  }, []);

  const rows = useMemo(() => normalizeRows(customChecks), [customChecks]);

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
        row.authoritativeMappings.some((term) => term.toLowerCase().includes(q)) ||
        row.references.some((term) => term.toLowerCase().includes(q)) ||
        row.passExample.toLowerCase().includes(q) ||
        row.failExample.toLowerCase().includes(q)
      );
    });
  }, [rows, search, severityFilter, sourceFilter]);

  const builtInCount = rows.filter((row) => row.source === "Built-in").length;
  const uc1Count = rows.filter((row) => row.source === "UAE UC1").length;
  const customCount = rows.filter((row) => row.source === "Custom").length;
  const enabledTotalChecks = rows.filter((row) => row.enabled).length;
  const enabledUc1Count = rows.filter((row) => row.source === "UAE UC1" && row.enabled).length;
  const enabledCustomCount = rows.filter((row) => row.source === "Custom" && row.enabled).length;
  const runtimeCodelistDomains = countRuntimeCodelistDomains(UAE_UC1_CHECK_PACK);
  const governedCodedDomains = PINT_AE_CODELIST_GOVERNANCE_COUNTS.governedCodedDomains;
  const codelistCoveragePct =
    governedCodedDomains > 0
      ? Math.round((runtimeCodelistDomains / governedCodedDomains) * 100)
      : 0;
  const derivedOrPolicyDomains =
    governedCodedDomains - PINT_AE_CODELIST_GOVERNANCE_COUNTS.packagedPintCodelists;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8">
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
            <BookCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Check & Validation Repository</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog of active validation checks, authoritative DR coverage mappings, and optional metadata references.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Note: technical profile fields (for example IBT-023 / IBT-024) may be resolved by approved system defaults
            when enabled; this does not reduce their compliance mandatory status.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 mb-4">
          <p className="text-xs font-medium text-foreground">How to read these KPIs</p>
          <p className="text-xs text-muted-foreground mt-1">
            These cards show runtime control maturity and governance coverage. They help you prioritize implementation
            and remediation, but they are not a standalone legal compliance attestation.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Coverage formula: runtime-enforced coded domains / total governed coded domains.
          </p>
        </div>

        <Card className="border shadow-sm mb-4">
          <CardContent className="p-4 md:p-5">
            <h2 className="text-sm font-semibold text-foreground">Runtime Validation Footprint</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Operational controls currently executed when users run checks.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Active Runtime Checks"
                value={enabledTotalChecks}
                helper={`${rows.length} total checks in repository`}
                definition="Total controls currently active in production validation runs."
                formula="Count of enabled checks"
              />
              <SummaryCard
                label="UAE UC1 Active"
                value={`${enabledUc1Count}/${uc1Count}`}
                helper="Enabled over available UAE UC1 checks"
                definition="How much of the standard UAE UC1 pack is turned on right now."
                formula="Enabled UAE UC1 / Total UAE UC1"
              />
              <SummaryCard
                label="Built-in Core Checks"
                value={builtInCount}
                helper="Always-on baseline checks"
                definition="Platform baseline checks that protect core data quality and integrity."
              />
              <SummaryCard
                label="Custom Active"
                value={`${enabledCustomCount}/${customCount}`}
                helper="Enabled over configured custom checks"
                definition="Customer-specific controls currently active versus what has been configured."
                formula="Enabled Custom / Total Custom"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm mb-4">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Codelist Coverage Status</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Governance tracks all coded domains; runtime enforces the currently safe subset.
                </p>
              </div>
              <div className="md:text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Runtime Coverage</p>
                <p className="text-2xl font-semibold text-foreground">{codelistCoveragePct}%</p>
                <p className="text-xs text-muted-foreground">
                  {runtimeCodelistDomains}/{governedCodedDomains} governed domains
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${codelistCoveragePct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <SummaryCard
                label="Implemented Codelist Domains"
                value={runtimeCodelistDomains}
                helper={`Across ${governedCodedDomains} governed domains`}
                definition="Unique governed codelist domains already implemented and running in production execution."
                formula="Implemented runtime codelist domains"
              />
              <SummaryCard
                label="Unconditional Enforcement"
                value={PINT_AE_CODELIST_GOVERNANCE_COUNTS.enforceableNow}
                helper="Always evaluated during runtime"
                definition="Governed domains validated in every relevant runtime scenario."
              />
              <SummaryCard
                label="Conditional Enforcement"
                value={PINT_AE_CODELIST_GOVERNANCE_COUNTS.conditional}
                helper="Scenario or policy gated"
                definition="Domains validated only when business scenario or policy conditions apply."
              />
              <SummaryCard
                label="Deferred Domains"
                value={PINT_AE_CODELIST_GOVERNANCE_COUNTS.deferredOrNonRuntime}
                helper="Governed but not runtime-enforced yet"
                definition="Governed domains intentionally tracked but not yet enforced in runtime."
              />
            </div>
          </CardContent>
        </Card>

        <details className="rounded-lg border bg-muted/20 p-3 mb-6">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            Governance Scope Details
          </summary>
          <p className="text-xs text-muted-foreground mt-2">
            Shows what is sourced from packaged PINT resources versus additional governed policy domains.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            <SummaryCard
              label="Governed Coded Domains"
              value={governedCodedDomains}
              helper="Total domains tracked in governance artifact"
              definition="Full coded-domain universe tracked by governance, whether enforced now or deferred."
            />
            <SummaryCard
              label="Packaged PINT .gc Lists"
              value={PINT_AE_CODELIST_GOVERNANCE_COUNTS.packagedPintCodelists}
              helper="Directly from PINT packaged resources"
              definition="Official codelists supplied directly by packaged PINT-AE .gc resources."
            />
            <SummaryCard
              label="Derived / Policy Domains"
              value={derivedOrPolicyDomains}
              helper="Governed domains outside packaged .gc lists"
              definition="Additional governed domains sourced from enterprise policy or derived standards."
            />
          </div>
        </details>

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

        <Card className="border shadow-sm mb-6">
          <CardContent className="p-4 md:p-5">
            <h2 className="text-sm font-semibold text-foreground">Validation Classes</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              These labels explain how a rule fails. Authoritative DR coverage comes from explicit validation mappings; reference terms stay informational only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Codelist</p>
                <p className="text-xs text-muted-foreground mt-1">
                  The value must exist in an approved list, such as ISO4217, GoodsType, or UAE exemption codes.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Dependency</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Another field becomes required because a VAT treatment or business condition applies.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Semantic</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Values exist but contradict the intended UAE VAT logic, such as a standard category with zero VAT.
                </p>
              </div>
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
                  placeholder="Search by ID, name, DR mapping, or reference term..."
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
                <FilterButton
                  active={sourceFilter === "Custom"}
                  onClick={() => setSourceFilter("Custom")}
                  label="Custom"
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
    <Card className="border h-full" data-testid={`check-card-${row.id}`}>
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
          <Badge variant="secondary" className="text-[11px]">Class: {getRuleTypeLabel(row.ruleType)}</Badge>
          {row.executionLayer && (
            <Badge variant="secondary" className="text-[11px]">Layer: {getExecutionLayerLabel(row.executionLayer)}</Badge>
          )}
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

        {row.executionLayer && row.source === "UAE UC1" && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Why This Rule Exists</p>
            <p className="text-xs text-foreground mt-1">
              {executionLayerGuidance[row.executionLayer] ?? "This rule executes within the mapped UAE validation layer."}
            </p>
          </div>
        )}

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

        {row.authoritativeMappings.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Authoritative DR Coverage
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {row.authoritativeMappings.map((reference) => (
                <Badge key={`${row.id}-coverage-${reference}`} variant="outline" className="text-[10px]">
                  {reference}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {row.references.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Reference Terms
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Metadata only. These terms do not determine runtime DR coverage.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {row.references.map((reference) => (
                <Badge key={`${row.id}-${reference}`} variant="outline" className="text-[10px]">
                  {reference}
                </Badge>
              ))}
            </div>
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

function SummaryCard({
  label,
  value,
  helper,
  definition,
  formula,
}: {
  label: string;
  value: number | string;
  helper?: string;
  definition?: string;
  formula?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {definition && (
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} definition`}
                  className="text-muted-foreground/80 hover:text-foreground transition-colors"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72 text-xs">
                <p>{definition}</p>
                {formula && (
                  <p className="mt-1 text-muted-foreground">
                    Formula: {formula}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
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
