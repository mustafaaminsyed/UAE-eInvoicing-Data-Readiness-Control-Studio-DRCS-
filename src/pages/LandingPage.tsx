import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Moon,
  ShieldCheck,
  Sun,
  Wand2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCompliance } from "@/context/ComplianceContext";
import { fetchActiveTemplates } from "@/lib/api/mappingApi";
import { fetchCases } from "@/lib/api/casesApi";
import { analyzeCoverage } from "@/lib/mapping/coverageAnalyzer";
import { cn } from "@/lib/utils";
import daribaLogo from "@/assets/Clean_DaribaTech_logo_transparent.png";
import dcsLandingDashboardMockup from "@/assets/DCS Landing Page Image - Mock-up of Dashboard.png";
import dcsLandingDashboardLight from "@/assets/dcs-landing-dashboard-transparent-light.png";
import type { MappingTemplate } from "@/types/fieldMapping";
import type { Case } from "@/types/cases";

type ClientEnvironment = "DEV" | "PROD";

const ENVIRONMENT_STORAGE_KEY = "drcs.preview_environment_v1";

const heroNavLinks = [
  { label: "Upload Audit", path: "/upload-audit" },
  { label: "Mapping", path: "/mapping" },
  { label: "Traceability", path: "/traceability" },
  { label: "Check Registry", path: "/check-registry" },
];

const activeRegionScope = {
  label: "UAE",
  country: "United Arab Emirates",
  detail: "Current regulatory scope",
};

const heroRegulatoryMeta = [
  { label: "Standard", value: "PINT-AE v1.0" },
  { label: "Scope", value: "United Arab Emirates" },
  { label: "Evidence", value: "Traceability retained" },
];

type WorkflowStageDefinition = {
  stage: "01" | "02" | "03" | "04";
  verb: string;
  title: string;
  description: string;
  panelType: "metrics" | "mapping" | "checks" | "evidence";
  outputLabel: string;
  actionLabel: string;
  path: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type WorkflowArtifactRow = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

type WorkflowStage = WorkflowStageDefinition & {
  status: string;
  artifactRows: WorkflowArtifactRow[];
};

type ControlSurfaceDefinition = {
  label: string;
  title: string;
  description: string;
  ctaLabel: string;
  path: string;
  panelType: "mapping" | "traceability" | "registry" | "audit";
};

const workflowStageDefinitions: WorkflowStageDefinition[] = [
  {
    stage: "01",
    verb: "Ingest",
    title: "Profile source data on arrival.",
    description:
      "Connect ERP extracts, assess completeness, and fingerprint the dataset before it enters the governed workspace.",
    panelType: "metrics",
    outputLabel: "Source readiness",
    actionLabel: "Open intake",
    path: "/upload",
    icon: Database,
  },
  {
    stage: "02",
    verb: "Map",
    title: "Bind fields to the PINT-AE model.",
    description:
      "Create reversible, reviewable field mappings so every source column lands in a canonical UAE eInvoice term.",
    panelType: "mapping",
    outputLabel: "Mapping manifest",
    actionLabel: "Open mapping",
    path: "/mapping",
    icon: Wand2,
  },
  {
    stage: "03",
    verb: "Verify",
    title: "Run the check registry, get evidence.",
    description:
      "Execute the active rule pack, classify failures by severity, and surface the records needing remediation first.",
    panelType: "checks",
    outputLabel: "Pass rate Â· Severity",
    actionLabel: "Open validation",
    path: "/run",
    icon: CheckCircle2,
  },
  {
    stage: "04",
    verb: "Remediate",
    title: "Close findings with one audit trail.",
    description:
      "Carry exceptions, ownership, traceability, and evidence outputs through one connected remediation record.",
    panelType: "evidence",
    outputLabel: "Open findings Â· Evidence",
    actionLabel: "Open evidence",
    path: "/evidence-pack",
    icon: ShieldCheck,
  },
];

const controlSurfaceDefinitions: ControlSurfaceDefinition[] = [
  {
    label: "Mapping",
    title: "Bind your data to PINT-AE, reversibly.",
    description:
      "Every source field lands in a versioned mapping manifest. Reviewers see intent, transforms, and downstream impact before anything ships.",
    ctaLabel: "Explore mapping",
    path: "/mapping",
    panelType: "mapping",
  },
  {
    label: "Traceability",
    title: "Every value, tracked from source to submission.",
    description:
      "Click any figure on any invoice and see the exact upstream field, transform, and reviewer. No black boxes, no orphaned numbers.",
    ctaLabel: "See the graph",
    path: "/traceability",
    panelType: "traceability",
  },
  {
    label: "Check Registry",
    title: "A living library of every UAE rule.",
    description:
      "PINT-AE business rules, FTA policy checks, and your own internal controls stay versioned, testable, and execution-ready for every batch.",
    ctaLabel: "Browse the registry",
    path: "/check-registry",
    panelType: "registry",
  },
  {
    label: "Audit",
    title: "Evidence, generated, not assembled.",
    description:
      "Every action, value, and signature is chained into a tamper-evident record so the evidence pack reflects the latest governed state.",
    ctaLabel: "See audit trail",
    path: "/evidence-pack",
    panelType: "audit",
  },
];

const environmentOptions: Array<{
  key: ClientEnvironment;
  label: string;
  caption: string;
}> = [
  {
    key: "DEV",
    label: "Dev",
    caption: "Sandbox client access lane",
  },
  {
    key: "PROD",
    label: "Prod",
    caption: "Production client access lane",
  },
];

export default function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isDataLoaded, isChecksRun, headers } = useCompliance();
  const [activeTemplates, setActiveTemplates] = useState<MappingTemplate[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [clientEnvironment, setClientEnvironment] = useState<ClientEnvironment>(() => {
    try {
      const stored = localStorage.getItem(ENVIRONMENT_STORAGE_KEY);
      return stored === "PROD" ? "PROD" : "DEV";
    } catch {
      return "DEV";
    }
  });

  useEffect(() => {
    fetchActiveTemplates().then(setActiveTemplates);
    fetchCases().then(setCases);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ENVIRONMENT_STORAGE_KEY, clientEnvironment);
    } catch {
      // Ignore local preference persistence issues.
    }
  }, [clientEnvironment]);

  const isDark = resolvedTheme === "dark";
  const heroPreviewStyle = isDark
    ? undefined
    : {
        WebkitMaskImage:
          "radial-gradient(ellipse 88% 84% at 50% 50%, rgba(0,0,0,1) 68%, rgba(0,0,0,0.82) 80%, rgba(0,0,0,0.28) 92%, transparent 100%)",
        maskImage:
          "radial-gradient(ellipse 88% 84% at 50% 50%, rgba(0,0,0,1) 68%, rgba(0,0,0,0.82) 80%, rgba(0,0,0,0.28) 92%, transparent 100%)",
      };
  const hasActiveMapping = activeTemplates.length > 0;
  const activeTemplate = activeTemplates[0];
  const coverage = activeTemplate ? analyzeCoverage(activeTemplate.mappings) : null;
  const mandatoryCoverage = coverage?.mandatoryCoverage ?? 0;
  const blockingGaps = coverage?.unmappedMandatory.length ?? 0;
  const openCases = cases.filter((c) => c.status === "Open" || c.status === "In Progress");
  const criticalCases = openCases.filter((c) => c.severity === "Critical");

  const operatingContext = useMemo(() => {
    const timeZone = "Asia/Dubai";
    return {
      timezoneLabel: "GST / UTC+04:00",
      time: new Intl.DateTimeFormat("en-AE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      }).format(currentTime),
    };
  }, [currentTime]);

  const readinessSignal = mandatoryCoverage >= 95 ? "Strong alignment" : mandatoryCoverage >= 80 ? "Watch list" : "Remediation first";
  const workspaceStatusItems = [
    {
      label: "Data intake",
      value: isDataLoaded ? "Loaded" : "Pending",
      active: isDataLoaded,
    },
    {
      label: "Mapping",
      value: hasActiveMapping ? "Active" : "Pending",
      active: hasActiveMapping,
    },
    {
      label: "Checks",
      value: isChecksRun ? "Executed" : "Pending",
      active: isChecksRun,
    },
  ];
  const workflowStages = useMemo(
    () => [
      {
        ...workflowStageDefinitions[0],
        status: isDataLoaded ? "Profiled" : "Pending",
        artifactRows: [
          { label: "Source", value: isDataLoaded ? "AR invoice extract" : "Awaiting upload" },
          { label: "Rows scanned", value: headers.length.toLocaleString("en-AE") },
          {
            label: "Coverage",
            value: `${Math.round(mandatoryCoverage)}% mandatory`,
            tone: mandatoryCoverage >= 95 ? "success" : mandatoryCoverage >= 80 ? "info" : "warning",
          },
          { label: "Fingerprint", value: isDataLoaded ? "Versioned" : "Pending" },
        ],
      },
      {
        ...workflowStageDefinitions[1],
        status: hasActiveMapping ? "Controlled" : "Pending",
        artifactRows: [
          { label: "invoice_number", value: "IBT-001" },
          { label: "issue_date", value: "IBT-002" },
          { label: "amount_due", value: "IBT-115" },
          {
            label: "Manifest",
            value: hasActiveMapping ? `${activeTemplates.length} active template${activeTemplates.length === 1 ? "" : "s"}` : "Draft pending",
            tone: hasActiveMapping ? "success" : "info",
          },
        ],
      },
      {
        ...workflowStageDefinitions[2],
        status: isChecksRun ? "Executed" : "Pending",
        artifactRows: [
          {
            label: "PINT-AE mandatory",
            value: isChecksRun && blockingGaps === 0 ? "PASS" : isChecksRun ? "REVIEW" : "PENDING",
            tone: isChecksRun && blockingGaps === 0 ? "success" : isChecksRun ? "warning" : "info",
          },
          {
            label: "Critical blockers",
            value: isChecksRun ? String(criticalCases.length) : "Pending",
            tone: criticalCases.length > 0 ? "warning" : "success",
          },
          {
            label: "Open cases",
            value: isChecksRun ? String(openCases.length) : "Pending",
            tone: openCases.length > 0 ? "info" : "success",
          },
          {
            label: "Rule execution",
            value: isChecksRun ? "Executed" : "Awaiting run",
            tone: isChecksRun ? "success" : "neutral",
          },
        ],
      },
      {
        ...workflowStageDefinitions[3],
        status: isChecksRun ? (openCases.length > 0 ? "Open" : "Ready") : "Awaiting run",
        artifactRows: [
          {
            label: "Exceptions",
            value: isChecksRun ? `${openCases.length} open` : "Awaiting run",
            tone: openCases.length > 0 ? "warning" : "success",
          },
          {
            label: "Traceability",
            value: hasActiveMapping ? "Retained" : "Awaiting mapping",
            tone: hasActiveMapping ? "success" : "info",
          },
          {
            label: "Evidence pack",
            value: isChecksRun ? "Ready" : "Pending",
            tone: isChecksRun ? "success" : "neutral",
          },
          {
            label: "Owner state",
            value: openCases.length > 0 ? "Assigned" : "Clear",
            tone: openCases.length > 0 ? "info" : "success",
          },
        ],
      },
    ],
    [
      activeTemplates.length,
      blockingGaps,
      criticalCases.length,
      hasActiveMapping,
      headers.length,
      isChecksRun,
      isDataLoaded,
      mandatoryCoverage,
      openCases.length,
    ]
  );

  const heroPreviewRows = useMemo(() => {
    const amountFormatter = new Intl.NumberFormat("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const baseStatus = !isDataLoaded
      ? "Pending"
      : !hasActiveMapping
        ? "Mapping"
        : !isChecksRun
          ? "Checking"
          : openCases.length > 0
            ? "Review"
            : "Verified";

    return headers.slice(0, 5).map((header, index) => ({
      invoiceNumber: header.invoice_number || header.invoice_id || `INV-${index + 1}`,
      counterparty: header.seller_name || header.seller_trn || "Counterparty pending",
      amount:
        typeof header.total_incl_vat === "number"
          ? `${header.currency || "AED"} ${amountFormatter.format(header.total_incl_vat)}`
          : typeof header.amount_due === "number"
            ? `${header.currency || "AED"} ${amountFormatter.format(header.amount_due)}`
            : header.currency || "AED",
      status:
        isChecksRun && openCases.length > 0 && index === 0
          ? "Priority"
          : baseStatus,
      tone:
        isChecksRun && openCases.length > 0 && index === 0
          ? "warning"
          : isChecksRun
            ? "success"
            : hasActiveMapping
              ? "info"
              : "neutral",
    }));
  }, [hasActiveMapping, headers, isChecksRun, isDataLoaded, openCases.length]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-[1320px] px-4 py-6 sm:px-5 md:px-6 md:py-8 xl:px-8 xl:py-10">
        <div className="sticky top-4 z-40 mb-5">
          <div className="surface-glass rounded-[var(--surface-radius-lg)] px-4 py-3 md:px-5 md:py-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <div className="inline-flex w-[260px] items-center overflow-hidden rounded-[var(--surface-radius-md)] border border-border/70 bg-background/96 px-4 py-2.5 shadow-sm md:w-[300px] md:px-4 md:py-3">
                    <img
                      src={daribaLogo}
                      alt="Daribatech"
                      className="block h-[62px] w-auto max-w-full object-contain md:h-[68px]"
                    />
                  </div>
                  <div className="min-w-0 flex-1 md:min-w-[240px]">
                    <p className="font-display text-xl font-semibold tracking-tight text-foreground">
                      Controls Studio
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
                      UAE eInvoicing Compliance
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
                  <div className="flex min-h-11 items-center gap-3 rounded-full border border-border/70 bg-background/92 px-3.5 py-2 shadow-sm">
                    <UaeFlagMark />
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-foreground">{activeRegionScope.country}</p>
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Current scope
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/92 p-1.5 shadow-sm">
                    <EnvironmentAccessToggle value={clientEnvironment} onChange={setClientEnvironment} />

                    <div className="flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background px-3 shadow-sm">
                      <Sun className={cn("h-3.5 w-3.5", !isDark ? "text-amber-500" : "text-muted-foreground")} />
                      <Switch
                        checked={isDark}
                        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                        aria-label={isDark ? "Dark mode enabled" : "Light mode enabled"}
                      />
                      <Moon className={cn("h-3.5 w-3.5", isDark ? "text-primary" : "text-muted-foreground")} />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="h-11 rounded-full border-primary/18 bg-background/92 px-4 text-sm font-semibold text-primary shadow-sm hover:bg-primary/5 dark:border-primary/25 dark:bg-background/86"
                  >
                    Compliance Command Center
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3">
                <nav className="flex flex-wrap items-center gap-2 lg:justify-center">
                  {heroNavLinks.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-950/[0.04] hover:text-slate-950 dark:text-emerald-50/85 dark:hover:bg-emerald-500/[0.08] dark:hover:text-emerald-50"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>

        <section className="surface-glass relative overflow-hidden rounded-[var(--surface-radius-lg)] px-5 py-6 md:px-6 md:py-7 lg:px-8 lg:py-8 xl:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(102,208,255,0.08),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(73,173,134,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.985),rgba(249,251,252,0.985))] dark:bg-[radial-gradient(circle_at_12%_14%,rgba(47,153,95,0.10),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(29,92,72,0.10),transparent_24%),linear-gradient(180deg,rgba(13,21,19,0.985),rgba(10,16,15,0.995))]" />
	          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] xl:gap-12">
	            <div className="max-w-[43rem] pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/94 px-4 py-2 text-[12px] font-semibold text-primary shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                UAE eInvoicing readiness workspace
              </div>

	              <h1 className="mt-6 max-w-[11.2ch] font-display text-[3.55rem] font-semibold leading-[0.92] tracking-[-0.05em] text-foreground md:text-[4.2rem] lg:text-[4.55rem] xl:text-[4.95rem]">
                Invoice data, engineered for{" "}
                <span className="font-serif text-primary italic tracking-[-0.02em]">e-invoicing compliance.</span>
              </h1>

              <p className="mt-5 max-w-[35rem] text-[1.08rem] leading-8 text-slate-600 dark:text-emerald-50/76">
                One controlled workspace to profile source data, validate PINT-AE readiness, resolve
                exceptions, and produce evidence-grade traceability before the FTA ever asks.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-full px-6 shadow-sm">
                  <Link to="/upload">
                    Start readiness assessment
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-border/80 bg-background/94 px-6 text-foreground shadow-sm hover:bg-slate-950/[0.03] dark:bg-background/82 dark:text-emerald-50"
                >
                  <Link to="/traceability">
                    Explore traceability
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-8 border-t border-border/60 pt-6">
                <dl className="grid gap-4 sm:grid-cols-3">
                  {heroRegulatoryMeta.map((item) => (
                    <div key={item.label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="mt-2 text-xl font-semibold text-foreground">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

		            <div className="mx-auto w-full max-w-[780px]">
		              <div className="relative px-2 pt-4 lg:px-4">
			                <div className="absolute inset-x-[14%] bottom-[10%] h-[18%] rounded-full bg-primary/12 blur-3xl" />
			                <img
			                  src={isDark ? dcsLandingDashboardMockup : dcsLandingDashboardLight}
			                  alt="Controls Studio dashboard mock-up"
			                  style={heroPreviewStyle}
			                  className={cn(
			                    "relative z-10 h-auto w-full object-contain",
			                    isDark
			                      ? "mix-blend-normal opacity-[0.92] drop-shadow-[0_30px_48px_rgba(15,23,42,0.18)]"
			                      : "mix-blend-normal opacity-[0.99] drop-shadow-[0_18px_30px_rgba(148,163,184,0.12)]"
			                  )}
			                />
                <div className="hidden rounded-[28px] border border-emerald-900/70 bg-[linear-gradient(180deg,rgba(8,25,18,0.98),rgba(5,17,12,0.99))] p-5 text-emerald-50 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-900/70 pb-5">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-200/55">
                        Live compliance ledger
                      </p>
                      <p className="mt-2 text-[1.75rem] font-semibold leading-none text-emerald-50">
                        {clientEnvironment} Â· Batch 2026-Q3
                      </p>
                      <p className="mt-2 text-sm text-emerald-100/58">
                        {activeRegionScope.country} Â· {operatingContext.time} {operatingContext.timezoneLabel}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      {isChecksRun ? "LIVE" : "IN PREP"}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <DarkHeroMetric
                      title="Coverage"
                      value={`${Math.round(mandatoryCoverage)}%`}
                      detail={blockingGaps > 0 ? `${blockingGaps} blocking gap(s)` : "No blocking gaps"}
                    />
                    <DarkHeroMetric
                      title="Open cases"
                      value={String(openCases.length)}
                      detail={criticalCases.length > 0 ? `${criticalCases.length} critical` : "Queue controlled"}
                    />
                    <DarkHeroMetric
                      title="Invoices"
                      value={String(headers.length)}
                      detail={isDataLoaded ? "Dataset loaded" : "Awaiting upload"}
                    />
                    <DarkHeroMetric
                      title="Evidence"
                      value={isChecksRun ? "Ready" : "Pending"}
                      detail={hasActiveMapping ? "Mapping active" : "Mapping pending"}
                      valueSize="label"
                    />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {workspaceStatusItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-emerald-900/70 bg-white/[0.02] px-4 py-3.5"
                      >
                        <div className="flex min-h-[88px] flex-col justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span
                              className={cn(
                                "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                                item.active ? "bg-emerald-400" : "bg-emerald-100/30"
                              )}
                            />
                            <span className="text-base font-semibold leading-tight text-emerald-50">{item.label}</span>
                          </div>
                          <span className="inline-flex h-8 w-fit items-center rounded-full border border-emerald-900/70 bg-white/[0.03] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100/55">
                            {item.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[26px] border border-emerald-900/70 bg-black/12 p-4 md:p-5">
                    <div className="grid grid-cols-[1.2fr_1.35fr_0.95fr_auto] gap-3 border-b border-emerald-900/60 px-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/42">
                      <span>Invoice</span>
                      <span>Counterparty</span>
                      <span>Amount</span>
                      <span>Status</span>
                    </div>

                    <div className="mt-1 space-y-1.5">
                      {heroPreviewRows.length > 0 ? (
                        heroPreviewRows.map((row) => (
                          <HeroLedgerRow key={row.invoiceNumber} row={row} />
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-emerald-900/70 bg-white/[0.015] px-5 py-7 text-center text-[15px] leading-7 text-emerald-100/58">
                          Upload invoices to populate the live compliance ledger preview.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mt-12 rounded-[36px] border border-border/80 bg-card px-6 py-8 shadow-[0_22px_46px_-36px_rgba(15,23,42,0.16)] md:px-7 md:py-9 xl:px-8"
          aria-labelledby="landing-workflow-heading"
        >
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,0.72fr)] xl:items-end">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary">
                How it works
              </p>
              <h2
                id="landing-workflow-heading"
                className="mt-5 max-w-[11ch] font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.04em] text-foreground md:text-[3.2rem] xl:text-[3.75rem]"
              >
                Four controlled phases,
                <span className="mt-2 block font-serif text-primary italic tracking-[-0.02em]">
                  one auditable trail.
                </span>
              </h2>
            </div>

            <p className="max-w-[34rem] text-[1.05rem] leading-9 text-slate-600 dark:text-emerald-50/72 xl:justify-self-end">
              Every invoice moves through the same governed pipeline. Nothing progresses without
              evidence, and nothing leaves the workspace without traceable control context.
            </p>
          </div>

          <div className="mt-8 rounded-[28px] border border-border/70 bg-muted/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none">
            <div className="relative">
              <div className="pointer-events-none absolute left-[8%] right-[8%] top-1/2 hidden h-px -translate-y-1/2 bg-[linear-gradient(90deg,rgba(148,163,184,0.0),rgba(148,163,184,0.35),rgba(148,163,184,0.0))] xl:block" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {workflowStages.map((stage) => {
                const accent = getWorkflowStageAccent(stage.stage);
                const statusTone = getWorkflowStatusTone(stage.status);

                return (
                  <div
                    key={`workflow-summary-${stage.stage}`}
                    className="rounded-[22px] border border-border/70 bg-background/88 px-4 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-[11px] font-semibold tracking-[0.16em]", accent.badge)}>
                          {stage.stage}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {stage.verb}
                        </span>
                      </div>
                      <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", statusTone.badge)}>
                        {stage.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{stage.actionLabel}</p>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          <ol className="mt-8 grid gap-5 xl:grid-cols-2">
            {workflowStages.map((stage) => (
              <li key={stage.stage} className="relative">
                <WorkflowStageCard stage={stage} />
              </li>
            ))}
          </ol>
        </section>

        <section
          className="mt-8 rounded-[36px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(255,255,255,0.98))] px-6 py-8 shadow-[0_22px_46px_-36px_rgba(15,23,42,0.14)] md:px-7 md:py-9 xl:px-8 dark:bg-[linear-gradient(180deg,rgba(17,24,22,0.98),rgba(13,18,17,0.98))]"
          aria-labelledby="landing-surfaces-heading"
        >
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,0.8fr)] xl:items-start">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary">
                The product
              </p>
              <h2
                id="landing-surfaces-heading"
                className="mt-5 max-w-[10ch] font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.04em] text-foreground md:text-[3.15rem] xl:text-[3.6rem]"
              >
                Four surfaces,
                <span className="mt-2 block font-serif text-primary italic tracking-[-0.02em]">
                  one control plane.
                </span>
              </h2>
            </div>

            <p className="max-w-[34rem] text-[1.05rem] leading-9 text-slate-600 dark:text-emerald-50/72 xl:justify-self-end">
              Mapping, Traceability, the Check Registry, and Audit each give specialists the
              surface built for their phase, while the whole workspace continues to speak the same
              evidence model.
            </p>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-2">
            {controlSurfaceDefinitions.map((surface) => (
              <SurfaceCapabilityCard key={surface.label} surface={surface} />
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[30px] border border-primary/16 bg-primary/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] md:p-8 dark:bg-primary/[0.08] dark:shadow-none">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="max-w-[18ch] font-display text-[2rem] font-semibold leading-[1.04] text-foreground md:text-[2.45rem]">
                Ready to assess your UAE eInvoicing data?
              </h2>
              <p className="mt-3 max-w-[58ch] text-base leading-8 text-muted-foreground">
                Upload a source extract to establish your PINT-AE readiness baseline, identify
                priority remediation areas, and generate evidence-ready outputs.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button asChild size="lg" className="min-w-[252px] rounded-full px-6">
                <Link to="/upload">Start readiness assessment</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="min-w-[214px] rounded-full border-border/80 bg-card px-6"
              >
                <Link to="/evidence-pack">View sample report</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkflowStageCard({
  stage,
}: {
  stage: WorkflowStage;
}) {
  const Icon = stage.icon;
  const accent = getWorkflowStageAccent(stage.stage);
  const statusTone = getWorkflowStatusTone(stage.status);

  return (
    <Link
      to={stage.path}
      className="group block h-full rounded-[30px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${stage.stage} ${stage.title}: ${stage.actionLabel}`}
    >
      <article className="grid h-full gap-6 rounded-[32px] border border-border/80 bg-card/98 p-6 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/28 group-hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.18)] motion-reduce:transition-none md:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.9fr)]">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="inline-flex items-center gap-3">
              <span className={cn("inline-flex min-w-[56px] items-center justify-center rounded-full border px-3 py-1.5 text-[12px] font-semibold tracking-[0.16em]", accent.badge)}>
                {stage.stage}
              </span>
              <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-[18px] border", accent.iconWrap)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", statusTone.badge)}>
              {stage.status}
            </span>
          </div>

          <p className="sr-only">
            Step {stage.stage} / {stage.verb}
          </p>
          <p className={cn("mt-6 text-[12px] font-semibold uppercase tracking-[0.24em]", accent.eyebrow)}>
            Step {stage.stage} / {stage.verb}
          </p>

          <div className="mt-5 flex flex-1 flex-col">
            <h3 className="max-w-[12ch] font-serif text-[2.05rem] leading-[1.02] tracking-[-0.025em] text-foreground md:text-[2.2rem]">
              {stage.title}
            </h3>
            <p className="mt-4 max-w-[30ch] text-[15px] leading-8 text-muted-foreground">
              {stage.description}
            </p>

            <div className="mt-auto pt-6">
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors", accent.actionPill)}>
                {stage.actionLabel}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </span>
            </div>
          </div>
        </div>

        <div className={cn("rounded-[28px] border p-4 md:p-5", accent.panelShell)}>
          <div className="flex h-full min-h-[320px] flex-col rounded-[22px] border border-border/70 bg-background/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {formatWorkflowOutputLabel(stage.outputLabel)}
              </p>
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", statusTone.badge)}>
                {stage.status}
              </span>
            </div>

            <WorkflowArtifactPanel stage={stage} />

            <div className="mt-auto border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <span>Workflow control</span>
                <span className="text-foreground">{stage.verb}</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function WorkflowArtifactPanel({
  stage,
}: {
  stage: WorkflowStage;
}) {
  if (stage.panelType === "metrics") {
    const coverageValue = stage.artifactRows.find((row) => row.label === "Coverage")?.value ?? "0% mandatory";
    const coverageMatch = coverageValue.match(/(\d+)/);
    const coveragePct = coverageMatch ? Number(coverageMatch[1]) : 0;
    const sourceValue = stage.artifactRows.find((row) => row.label === "Source")?.value ?? "Awaiting upload";
    const rowCount = stage.artifactRows.find((row) => row.label === "Rows scanned")?.value ?? "0";
    const fingerprint = stage.artifactRows.find((row) => row.label === "Fingerprint")?.value ?? "Pending";

    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-[20px] border border-border/70 bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Source
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">{sourceValue}</p>
            </div>
            <span className="rounded-full bg-primary/[0.08] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
              Profiled
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-border/70 bg-card px-4 py-3.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Rows scanned
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{rowCount}</p>
          </div>
          <div className="rounded-[18px] border border-border/70 bg-card px-4 py-3.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Fingerprint
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{fingerprint}</p>
          </div>
        </div>

        <div className="rounded-[18px] border border-border/70 bg-card px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Mandatory coverage
            </p>
            <span className="text-sm font-semibold text-foreground">{coverageValue}</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-muted/80">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                coveragePct >= 95
                  ? "bg-primary"
                  : coveragePct >= 80
                    ? "bg-sky-500"
                    : "bg-amber-500"
              )}
              style={{ width: `${Math.max(8, Math.min(coveragePct, 100))}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (stage.panelType === "mapping") {
    return (
      <div className="mt-4 space-y-2.5">
        {stage.artifactRows.map((row) => (
          <div
            key={`${stage.stage}-${row.label}`}
            className="grid grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-border/70 bg-card px-3 py-3"
          >
            <span className="truncate rounded-xl border border-border/70 bg-background px-2.5 py-1.5 font-mono text-[11.5px] text-foreground">
              {formatMappingToken(row.label)}
            </span>
            <span className="text-center text-primary" aria-hidden="true">&rarr;</span>
            <span className="truncate rounded-xl border border-primary/14 bg-primary/[0.06] px-2.5 py-1.5 font-mono text-[11.5px] text-foreground">
              {formatMappingToken(row.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (stage.panelType === "checks") {
    const primaryRows = stage.artifactRows.slice(0, 2);
    const secondaryRows = stage.artifactRows.slice(2);

    return (
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {primaryRows.map((row) => (
            <div
              key={`${stage.stage}-${row.label}`}
              className="rounded-[20px] border border-border/70 bg-card px-4 py-4"
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {row.label}
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-[1.7rem] font-semibold leading-none tracking-tight text-foreground">
                  {row.value}
                </span>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    row.tone === "success" && "bg-primary/[0.1] text-primary",
                    row.tone === "warning" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                    row.tone === "info" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                    (!row.tone || row.tone === "neutral") && "bg-background text-foreground"
                  )}
                >
                  {row.tone ?? "neutral"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 rounded-[20px] border border-border/70 bg-card p-3.5">
          {secondaryRows.map((row) => (
            <div
              key={`${stage.stage}-${row.label}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/88 px-3 py-2.5"
            >
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {row.label}
              </span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
                  row.tone === "success" && "bg-primary/[0.1] text-primary",
                  row.tone === "warning" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                  row.tone === "info" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                  (!row.tone || row.tone === "neutral") && "bg-card text-foreground"
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stage.panelType === "evidence") {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-[20px] border border-border/70 bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Remediation posture
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">{stage.status}</p>
            </div>
            <span className="rounded-full bg-primary/[0.08] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
              Audit trail
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {stage.artifactRows.map((row) => (
            <div
              key={`${stage.stage}-${row.label}`}
              className="rounded-[18px] border border-border/70 bg-card px-3.5 py-3.5"
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {row.label}
              </p>
              <span
                className={cn(
                  "mt-3 inline-flex min-h-8 max-w-full items-center rounded-full px-3 py-1 text-[11px] font-semibold",
                  row.tone === "success" && "bg-primary/[0.1] text-primary",
                  row.tone === "warning" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                  row.tone === "info" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                  (!row.tone || row.tone === "neutral") && "bg-background text-foreground"
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2.5">
      {stage.artifactRows.map((row) => (
        <div
          key={`${stage.stage}-${row.label}`}
          className="rounded-2xl border border-border/70 bg-card px-3.5 py-3"
        >
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {row.label}
          </span>
          <span
            className={cn(
              "mt-2 inline-flex min-h-8 max-w-full items-center self-start whitespace-normal break-words rounded-full px-3 py-1 text-[11.5px] font-semibold leading-5",
              row.tone === "success" && "bg-primary/[0.1] text-primary",
              row.tone === "warning" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
              row.tone === "info" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
              (!row.tone || row.tone === "neutral") && "bg-background text-foreground"
            )}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatWorkflowOutputLabel(label: string) {
  return label.replaceAll(/[Â]?·/g, " / ");
}

function formatMappingToken(value: string) {
  return value.replaceAll("_", " ");
}

function SurfaceCapabilityCard({
  surface,
}: {
  surface: ControlSurfaceDefinition;
}) {
  return (
    <Link
      to={surface.path}
      className="group block h-full rounded-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${surface.label}: ${surface.ctaLabel}`}
    >
      <article className="grid h-full gap-6 rounded-[32px] border border-border/80 bg-card/98 p-6 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/24 group-hover:shadow-[0_24px_48px_-34px_rgba(15,23,42,0.18)] md:p-7 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.82fr)]">
        <div className="flex flex-col">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary">
            {surface.label}
          </p>
          <h3 className="mt-5 max-w-[11ch] font-serif text-[2rem] leading-[1.02] tracking-[-0.025em] text-foreground md:text-[2.2rem]">
            {surface.title}
          </h3>
          <p className="mt-4 max-w-[32ch] text-[15px] leading-8 text-muted-foreground">
            {surface.description}
          </p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {surface.ctaLabel}
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
          </span>
        </div>

        <SurfaceCapabilityVisual panelType={surface.panelType} />
      </article>
    </Link>
  );
}

function getWorkflowStageAccent(stage: WorkflowStage["stage"]) {
  switch (stage) {
    case "01":
      return {
        badge: "border-emerald-500/18 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
        iconWrap: "border-emerald-500/18 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        eyebrow: "text-emerald-700 dark:text-emerald-300",
        actionPill:
          "border-emerald-500/18 bg-emerald-500/8 text-emerald-700 hover:bg-emerald-500/12 dark:text-emerald-300",
        panelShell: "border-emerald-500/12 bg-[linear-gradient(180deg,rgba(24,196,126,0.06),rgba(255,255,255,0.7))] dark:bg-[linear-gradient(180deg,rgba(24,196,126,0.08),rgba(15,23,20,0.68))]",
      };
    case "02":
      return {
        badge: "border-sky-500/18 bg-sky-500/8 text-sky-700 dark:text-sky-300",
        iconWrap: "border-sky-500/18 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        eyebrow: "text-sky-700 dark:text-sky-300",
        actionPill:
          "border-sky-500/18 bg-sky-500/8 text-sky-700 hover:bg-sky-500/12 dark:text-sky-300",
        panelShell: "border-sky-500/12 bg-[linear-gradient(180deg,rgba(56,189,248,0.06),rgba(255,255,255,0.7))] dark:bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(15,23,20,0.68))]",
      };
    case "03":
      return {
        badge: "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300",
        iconWrap: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        eyebrow: "text-amber-700 dark:text-amber-300",
        actionPill:
          "border-amber-500/20 bg-amber-500/8 text-amber-700 hover:bg-amber-500/12 dark:text-amber-300",
        panelShell: "border-amber-500/14 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(255,255,255,0.7))] dark:bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(15,23,20,0.68))]",
      };
    default:
      return {
        badge: "border-primary/18 bg-primary/8 text-primary",
        iconWrap: "border-primary/18 bg-primary/10 text-primary",
        eyebrow: "text-primary",
        actionPill: "border-primary/18 bg-primary/8 text-primary hover:bg-primary/12",
        panelShell: "border-primary/12 bg-[linear-gradient(180deg,rgba(47,153,95,0.06),rgba(255,255,255,0.7))] dark:bg-[linear-gradient(180deg,rgba(47,153,95,0.08),rgba(15,23,20,0.68))]",
      };
  }
}

function getWorkflowStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("pending") || normalized.includes("awaiting")) {
    return {
      badge: "border border-border/70 bg-background text-muted-foreground",
    };
  }

  if (normalized.includes("open") || normalized.includes("review") || normalized.includes("watch")) {
    return {
      badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }

  return {
    badge: "bg-primary/[0.1] text-primary",
  };
}

function SurfaceCapabilityVisual({
  panelType,
}: {
  panelType: ControlSurfaceDefinition["panelType"];
}) {
  if (panelType === "mapping") {
    return (
      <div className="rounded-[28px] border border-border/75 bg-muted/20 p-5">
        <div className="space-y-3">
          {[
            ["SRC", "inv_no", "PINT", "cbc:ID"],
            ["SRC", "issue_dt", "PINT", "cbc:IssueDate"],
            ["SRC", "vat_id", "PINT", "PINTPartyTaxScheme"],
            ["SRC", "total_gross", "PINT", "PINTPayableAmount"],
          ].map(([sourceTag, sourceValue, targetTag, targetValue]) => (
            <div
              key={`${sourceValue}-${targetValue}`}
              className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1.1fr)] items-center gap-2.5 rounded-2xl border border-border/70 bg-background/94 px-3.5 py-3"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {sourceTag}
                </span>
                <p className="truncate font-mono text-[12px] text-foreground">{sourceValue}</p>
              </div>
              <span className="text-center text-primary" aria-hidden="true">
                &rarr;
              </span>
              <div className="min-w-0 rounded-xl border border-primary/12 bg-primary/[0.05] px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                  {targetTag}
                </span>
                <p className="truncate font-mono text-[12px] text-foreground">{targetValue}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panelType === "traceability") {
    return (
      <div className="rounded-[28px] border border-border/75 bg-muted/20 p-5">
        <div className="grid min-h-[268px] place-items-center rounded-[22px] border border-border/70 bg-background/90 px-5 py-6">
          <div className="flex w-full max-w-[240px] flex-col items-center">
            <div className="grid w-full gap-2.5">
              {["sap.header", "oracle.tax", "pos.retail"].map((item) => (
                <div
                  key={item}
                  className="mx-auto w-full max-w-[132px] rounded-full border border-border/70 bg-background px-3 py-2 text-center text-[10.5px] leading-5 text-muted-foreground shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="relative flex h-[96px] items-center justify-center">
              <div className="absolute left-1/2 top-0 h-[18px] w-px -translate-x-1/2 bg-primary/22" />
              <div className="absolute left-1/2 top-[18px] h-[18px] w-px -translate-x-[22px] rotate-[28deg] bg-primary/22" />
              <div className="absolute left-1/2 top-[18px] h-[18px] w-px -translate-x-1/2 bg-primary/22" />
              <div className="absolute left-1/2 top-[18px] h-[18px] w-px translate-x-[22px] rotate-[-28deg] bg-primary/22" />

              <div className="z-10 flex h-[76px] w-[76px] items-center justify-center rounded-full border border-primary/18 bg-primary/[0.08] px-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary shadow-sm">
                PINT-AE
              </div>

              <div className="absolute bottom-0 left-1/2 h-[18px] w-px -translate-x-1/2 bg-primary/22" />
              <div className="absolute bottom-[18px] left-1/2 h-[18px] w-px -translate-x-[18px] rotate-[24deg] bg-primary/22" />
              <div className="absolute bottom-[18px] left-1/2 h-[18px] w-px translate-x-[18px] rotate-[-24deg] bg-primary/22" />
            </div>

            <div className="grid w-full gap-2.5">
              {["cbc:ID", "Payable Amt"].map((item) => (
                <div
                  key={item}
                  className="mx-auto w-full max-w-[136px] rounded-full border border-primary/15 bg-primary/[0.05] px-3 py-2 text-center text-[10.5px] leading-5 text-primary shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (panelType === "registry") {
    return (
      <div className="rounded-[28px] border border-border/75 bg-muted/20 p-5">
        <div className="space-y-3">
          {[
            ["BR-CO-10", "Sum of line amounts = InvoiceTotal", "High"],
            ["AE-VAT-01", "TRN 15-digit format", "High"],
            ["AE-CUR-03", "FX rate at date of issue", "Med"],
            ["BR-52", "Buyer legal identifier present", "Med"],
            ["INT-04", "Vendor allow-list check", "Low"],
          ].map(([ruleId, description, severity]) => (
            <div
              key={ruleId}
              className="grid grid-cols-[84px_minmax(0,1fr)_56px] items-center gap-3 rounded-2xl border border-border/70 bg-background/94 px-3 py-2.5"
            >
              <span className="font-mono text-[11px] text-primary">{ruleId}</span>
              <span className="truncate text-[12px] text-foreground">{description}</span>
              <span
                className={cn(
                  "inline-flex justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  severity === "High" && "bg-rose-500/12 text-rose-700 dark:text-rose-300",
                  severity === "Med" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                  severity === "Low" && "bg-primary/[0.1] text-primary"
                )}
              >
                {severity}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-border/75 bg-muted/20 p-5">
      <div className="space-y-3 rounded-[22px] border border-border/70 bg-background/94 px-4 py-3.5">
        {[
          ["14:02:11", "a.mansoori approved mapping v4.1"],
          ["14:04:37", "system executed AE-VAT-01 (28,411 rows)"],
          ["14:04:41", "system flagged 14 exceptions"],
          ["14:12:03", "f.alnaqbi resolved AE-CUR-03 · INV-2026-04813"],
          ["14:18:55", "system sealed batch 2026-Q3-B04"],
        ].map(([time, event]) => (
          <div
            key={`${time}-${event}`}
            className="grid grid-cols-[78px_minmax(0,1fr)] gap-3 border-b border-border/55 pb-2.5 last:border-b-0 last:pb-0"
          >
            <span className="font-mono text-[11px] text-muted-foreground">{time}</span>
            <span className="text-[11.5px] leading-6 text-foreground">{event}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DarkHeroMetric({
  title,
  value,
  detail,
  valueSize = "numeric",
}: {
  title: string;
  value: string;
  detail: string;
  valueSize?: "numeric" | "label";
}) {
  return (
    <div className="rounded-[22px] border border-emerald-900/70 bg-white/[0.02] p-4 md:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/42">{title}</p>
      <p
        className={cn(
          "mt-4 font-semibold text-emerald-50",
          valueSize === "label"
            ? "text-[2rem] leading-[1.02] md:text-[2.2rem]"
            : "text-[2.35rem] leading-none md:text-[2.55rem]"
        )}
      >
        {value}
      </p>
      <p className="mt-3 max-w-[15ch] text-[15px] leading-7 text-emerald-300/78">{detail}</p>
    </div>
  );
}

function HeroLedgerRow({
  row,
}: {
  row: {
    invoiceNumber: string;
    counterparty: string;
    amount: string;
    status: string;
    tone: "warning" | "success" | "info" | "neutral";
  };
}) {
  const toneClass =
    row.tone === "warning"
      ? "border-amber-500/20 bg-amber-500/12 text-amber-200"
      : row.tone === "success"
        ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-300"
        : row.tone === "info"
          ? "border-sky-500/20 bg-sky-500/12 text-sky-200"
          : "border-emerald-900/80 bg-white/[0.03] text-emerald-100/70";

  return (
    <div className="grid grid-cols-[1.15fr_1.4fr_0.95fr_auto] items-center gap-3 rounded-2xl px-2 py-3.5">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/85" />
        <span className="truncate text-sm font-semibold text-emerald-50">{row.invoiceNumber}</span>
      </div>
      <span className="truncate pr-2 text-sm text-emerald-50/74">{row.counterparty}</span>
      <span className="truncate text-right text-sm font-medium tabular-nums text-emerald-50/86">{row.amount}</span>
      <span className={cn("inline-flex h-8 items-center justify-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap", toneClass)}>
        {row.status}
      </span>
    </div>
  );
}

function UaeFlagMark() {
  return (
    <div className="flex h-8 w-12 overflow-hidden rounded-md border border-primary/15 shadow-sm dark:border-emerald-700/30">
      <div className="w-3 bg-[#D71920]" />
      <div className="flex flex-1 flex-col">
        <div className="flex-1 bg-[#009A49]" />
        <div className="flex-1 bg-white dark:bg-slate-100" />
        <div className="flex-1 bg-black dark:bg-slate-950" />
      </div>
    </div>
  );
}

function EnvironmentAccessToggle({
  value,
  onChange,
}: {
  value: ClientEnvironment;
  onChange: (next: ClientEnvironment) => void;
}) {
  return (
    <div className="rounded-full">
      <div className="flex items-center gap-1">
        {environmentOptions.map((option) => {
          const isActive = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex h-9 min-w-[74px] items-center justify-center rounded-full px-3 text-center transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_12px_24px_-18px_hsl(var(--primary))]"
                  : "text-slate-500 hover:bg-slate-950/[0.04] hover:text-slate-900 dark:text-emerald-100/55 dark:hover:bg-emerald-500/[0.08] dark:hover:text-emerald-50"
              )}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em]">{option.key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
