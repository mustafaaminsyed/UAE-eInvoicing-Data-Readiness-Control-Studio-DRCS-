import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  FileCode2,
  FileDown,
  LayoutDashboard,
  Moon,
  Play,
  Search,
  ShieldCheck,
  Sun,
  Upload,
  Wand2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useCompliance } from "@/context/ComplianceContext";
import { fetchActiveTemplates } from "@/lib/api/mappingApi";
import { fetchCases } from "@/lib/api/casesApi";
import { analyzeCoverage } from "@/lib/mapping/coverageAnalyzer";
import { cn } from "@/lib/utils";
import daribaLogo from "@/assets/daribatech-logo-transparent.png";
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

const trustPills = [
  "UAE MoF baseline aligned",
  "PINT-AE traceability",
  "Control-grade evidence",
];

const activeRegionScope = {
  label: "UAE",
  country: "United Arab Emirates",
  detail: "Current regulatory scope",
};

const heroMessages = [
  "Validate source data before transmission and expose blocking gaps early.",
  "Trace every canonical field from source mapping to control, exception, and evidence.",
  "Improve readiness, conformance coverage, and operational risk visibility in one place.",
];

const capabilityCards = [
  {
    title: "Data Ingestion & Readiness",
    description:
      "Profile source data quality, mandatory coverage, and structural readiness before transmission.",
    icon: Database,
  },
  {
    title: "Schema Mapping & Alignment",
    description:
      "Map ERP fields into canonical UAE invoice structures with controlled templates and confidence visibility.",
    icon: Wand2,
  },
  {
    title: "Validation & Exception Controls",
    description:
      "Execute check packs, classify failed records, and move findings into operational review faster.",
    icon: CheckCircle2,
  },
  {
    title: "Evidence & Traceability",
    description:
      "Connect requirements, validations, controls, and evidence outputs into one explainable compliance view.",
    icon: ShieldCheck,
  },
];

const modules = [
  {
    title: "Ingest Data",
    description: "Upload invoice datasets and establish readiness context.",
    path: "/upload",
    icon: Upload,
  },
  {
    title: "Map to Schema",
    description: "Create and activate mapping templates for canonical alignment.",
    path: "/mapping",
    icon: FileCode2,
  },
  {
    title: "Execute Checks",
    description: "Run validation packs and surface non-conformant records.",
    path: "/run",
    icon: Play,
  },
  {
    title: "Control Workspace",
    description: "Review exceptions, evidence, and operational control posture.",
    path: "/dashboard",
    icon: LayoutDashboard,
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
  const hasActiveMapping = activeTemplates.length > 0;
  const activeTemplate = activeTemplates[0];
  const coverage = activeTemplate ? analyzeCoverage(activeTemplate.mappings) : null;
  const mandatoryCoverage = coverage?.mandatoryCoverage ?? 0;
  const blockingGaps = coverage?.unmappedMandatory.length ?? 0;
  const openCases = cases.filter((c) => c.status === "Open" || c.status === "In Progress");
  const criticalCases = openCases.filter((c) => c.severity === "Critical");
  const activeEnvironmentConfig =
    environmentOptions.find((option) => option.key === clientEnvironment) ?? environmentOptions[0];

  const operatingContext = useMemo(() => {
    const timeZone = "Asia/Dubai";
    return {
      region: "United Arab Emirates",
      timezoneLabel: "GST / UTC+04:00",
      time: new Intl.DateTimeFormat("en-AE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      }).format(currentTime),
      date: new Intl.DateTimeFormat("en-AE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone,
      }).format(currentTime),
    };
  }, [currentTime]);

  const nextAction = useMemo(() => {
    if (!isDataLoaded) return { label: "Start with data ingestion", path: "/upload" };
    if (!hasActiveMapping) return { label: "Create mapping template", path: "/mapping" };
    if (!isChecksRun) return { label: "Run compliance checks", path: "/run" };
    return { label: "Open control dashboard", path: "/dashboard" };
  }, [hasActiveMapping, isChecksRun, isDataLoaded]);

  const readinessSignal = mandatoryCoverage >= 95 ? "Strong alignment" : mandatoryCoverage >= 80 ? "Watch list" : "Remediation first";
  const evidenceSignal = isChecksRun ? "Evidence ready" : "Awaiting validation run";
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

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-[1320px] px-4 py-6 sm:px-5 md:px-6 md:py-8 xl:px-8 xl:py-10">
        <div className="sticky top-4 z-40 mb-5">
          <div className="surface-glass rounded-[var(--surface-radius-lg)] px-4 py-3 md:px-5 md:py-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <div className="inline-flex w-fit items-center rounded-[var(--surface-radius-md)] border border-border/70 bg-background/96 px-3 py-2 shadow-sm">
                    <img
                      src={daribaLogo}
                      alt="Daribatech"
                      className="h-10 w-auto max-w-[170px] object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl font-semibold tracking-tight text-foreground">
                      Controls Studio
                    </p>
                    <p className="truncate text-sm font-medium text-muted-foreground">
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(102,208,255,0.10),transparent_24%),radial-gradient(circle_at_88%_15%,rgba(73,173,134,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))] dark:bg-[radial-gradient(circle_at_10%_14%,rgba(47,153,95,0.12),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(29,92,72,0.12),transparent_24%),linear-gradient(180deg,rgba(13,21,19,0.98),rgba(10,16,15,0.99))]" />
          <div className="relative z-10 grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-10">
            <div className="max-w-[34rem] pt-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/94 px-4 py-2 text-[12px] font-semibold text-primary shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                UAE eInvoicing readiness workspace
              </div>

              <h1 className="mt-5 max-w-[10.4ch] font-display text-[3.5rem] font-semibold leading-[0.94] tracking-[-0.045em] text-foreground md:text-[4.1rem] lg:text-[4.35rem] xl:text-[4.7rem]">
                Turn invoice data into compliance intelligence.
              </h1>

              <p className="mt-4 max-w-[32rem] text-[1.05rem] leading-8 text-slate-600 dark:text-emerald-50/76">
                Profile source data, validate PINT-AE readiness, resolve blocking exceptions, and generate evidence-grade traceability in one controlled UAE compliance workspace.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-full px-6 shadow-sm">
                  <Link to={nextAction.path}>
                    {nextAction.label}
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

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {trustPills.map((pill) => (
                  <Badge
                    key={pill}
                    variant="outline"
                    className="rounded-full border-border/75 bg-background/90 px-3 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-emerald-100/82"
                  >
                    {pill}
                  </Badge>
                ))}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <HeroSummaryCard
                  title="Workspace signal"
                  value={readinessSignal}
                  detail={`${Math.round(mandatoryCoverage)}% mandatory coverage${blockingGaps > 0 ? ` | ${blockingGaps} blocking gap(s)` : " | no blocking gaps"}`}
                />
                <HeroSummaryCard
                  title="Operating context"
                  value={operatingContext.time}
                  detail={`${activeEnvironmentConfig.label} access | ${operatingContext.timezoneLabel}`}
                />
              </div>

              <div className="mt-5 space-y-3">
                {heroMessages.map((message, index) => (
                  <div
                    key={message}
                    className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/92 p-4 shadow-[var(--surface-shadow)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{message}</p>
                        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                          {index === 0 &&
                            "Detect mandatory gaps, structural defects, and source-data issues before transmission or onboarding."}
                          {index === 1 &&
                            "Maintain one regulator-friendly chain from source mapping to rule outcome, exception, and evidence."}
                          {index === 2 &&
                            "Give operational teams and executives a common view of readiness, remediation, and audit posture."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[780px] lg:min-h-[600px] lg:pt-4">
              <div className="absolute right-[6%] top-[12%] hidden h-[66%] w-[72%] rounded-[36px] bg-[radial-gradient(circle_at_top_left,rgba(58,179,139,0.16),transparent_48%),linear-gradient(180deg,rgba(12,98,82,0.08),rgba(255,255,255,0.02))] blur-xl lg:block" />

              <div className="hidden lg:absolute lg:left-0 lg:top-5 lg:z-20 lg:block lg:w-[250px]">
                <div className="rounded-[var(--surface-radius-md)] border border-border/75 bg-background/95 p-4 shadow-[var(--surface-shadow-strong)]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Workspace status
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {workspaceStatusItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              item.active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                            )}
                          />
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative z-10 mx-auto w-full max-w-[720px] lg:ml-auto lg:translate-x-2 lg:translate-y-8 lg:rotate-[1.8deg]">
                <div className="rounded-[var(--surface-radius-lg)] border border-border/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,252,0.99))] p-3 shadow-[var(--surface-shadow-strong)] dark:bg-[linear-gradient(180deg,rgba(15,24,22,0.96),rgba(11,18,16,0.99))]">
                  <div className="rounded-[var(--surface-radius-lg)] border border-border/70 bg-background/96 p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-slate-300/90" />
                          <span className="h-3 w-3 rounded-full bg-slate-300/90" />
                          <span className="h-3 w-3 rounded-full bg-slate-300/90" />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
                            Compliance workspace preview
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            Readiness, exceptions, and evidence in one surface
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full border-primary/15 bg-primary/6 px-3 py-1.5 text-[12px] font-semibold text-primary dark:border-emerald-700/30 dark:bg-emerald-500/[0.08] dark:text-emerald-300"
                        >
                          {clientEnvironment} access
                        </Badge>
                        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground dark:bg-white/[0.03]">
                          <Search className="h-3.5 w-3.5" />
                          Search readiness, controls, or exceptions
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <HeroMetricTile title="Mandatory coverage" value={`${Math.round(mandatoryCoverage)}%`} icon={Wand2} tone="primary" />
                      <HeroMetricTile title="Open control cases" value={String(openCases.length)} icon={AlertTriangle} tone="warning" />
                      <HeroMetricTile title="Observed invoices" value={String(headers.length)} icon={Database} tone="neutral" />
                      <HeroMetricTile title="Evidence posture" value={isChecksRun ? "Ready" : "Pending"} icon={FileDown} tone="success" />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                      <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-slate-950/[0.02] p-4 dark:bg-white/[0.025]">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Workflow progression
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              Source-to-evidence operating model
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="rounded-full border-border/70 bg-background px-3 py-1 text-[12px] font-semibold text-muted-foreground dark:bg-white/[0.03] dark:text-emerald-50/82"
                          >
                            {hasActiveMapping ? "Mapping active" : "Mapping pending"}
                          </Badge>
                        </div>

                        <div className="space-y-2.5">
                          <HeroWorkflowStep icon={Upload} label="Upload" detail="Source datasets profiled and qualified." active={isDataLoaded} />
                          <HeroWorkflowStep icon={FileCode2} label="Mapping" detail={hasActiveMapping ? "Canonical mapping profile available." : "Activate a mapping profile for governed alignment."} active={hasActiveMapping} />
                          <HeroWorkflowStep icon={Play} label="Validation" detail={isChecksRun ? "Latest check pack executed for current scope." : "Run the latest compliance pack to populate findings."} active={isChecksRun} />
                          <HeroWorkflowStep icon={LayoutDashboard} label="Control review" detail="Move from failed rules into exceptions, cases, and operational response." active />
                        </div>

                        <div className="mt-4 rounded-[var(--surface-radius-md)] border border-primary/15 bg-primary/6 p-4 dark:border-emerald-700/25 dark:bg-emerald-500/[0.08]">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-muted-foreground">Readiness signal</span>
                            <span className="font-semibold text-foreground">{Math.round(mandatoryCoverage)}%</span>
                          </div>
                          <Progress value={mandatoryCoverage} className="mt-2 h-2.5" />
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {blockingGaps > 0
                              ? `${blockingGaps} mandatory gap(s) still need remediation before clean submission readiness.`
                              : "No mandatory gaps are currently blocking the active readiness view."}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-slate-950/[0.02] p-4 dark:bg-white/[0.025]">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Operational focus
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              Queue, traceability, and evidence posture
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-[12px] font-semibold text-primary dark:border-emerald-700/30 dark:bg-emerald-500/[0.08] dark:text-emerald-300"
                          >
                            {readinessSignal}
                          </Badge>
                        </div>

                        <div className="space-y-2.5">
                          <HeroQueueItem
                            title={criticalCases.length > 0 ? "Critical remediation cases open" : "No critical escalations"}
                            detail={criticalCases.length > 0 ? `${criticalCases.length} critical case(s) need attention` : "Exception escalation queue is currently controlled"}
                            icon={AlertTriangle}
                            tone={criticalCases.length > 0 ? "warning" : "success"}
                          />
                          <HeroQueueItem
                            title="Traceability links retained"
                            detail="Source, mapping, rule, exception, and evidence references remain connected."
                            icon={ShieldCheck}
                            tone="primary"
                          />
                          <HeroQueueItem
                            title={isChecksRun ? "Evidence Pack generation unlocked" : "Evidence output waiting for run"}
                            detail={isChecksRun ? "Current run context is ready for defensible evidence export." : "Execute checks to populate export-grade readiness context."}
                            icon={FileDown}
                            tone={isChecksRun ? "success" : "neutral"}
                          />
                        </div>

                        <div className="mt-4 rounded-[var(--surface-radius-md)] border border-border/70 bg-background/96 p-4 dark:bg-white/[0.04]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Workspace environment
                              </p>
                              <p className="mt-1 text-base font-semibold text-foreground">{activeEnvironmentConfig.label}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Regional clock
                              </p>
                              <p className="mt-1 text-base font-semibold text-foreground">{operatingContext.time}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Core platform capabilities
            </h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              DRCS combines readiness diagnostics, canonical alignment, validation control, and evidence-grade traceability in one operating model.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map((capability) => {
              const Icon = capability.icon;
              return (
                <Card key={capability.title} className="surface-glass border-white/70 dark:border-white/10 dark:bg-white/[0.04]">
                  <CardContent className="p-5">
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-display text-lg font-semibold text-foreground">{capability.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{capability.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.title} to={module.path} className="group block">
                <div className="h-full rounded-3xl border border-white/70 bg-card/76 p-5 shadow-[0_24px_48px_-40px_rgba(15,23,42,0.4)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_28px_54px_-38px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">{module.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Open module <ArrowRight className="h-4 w-4" />
                  </p>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 dark:border-primary/20 dark:bg-primary/8 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                Start your UAE eInvoicing readiness cycle with controlled execution
              </h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                Move from data intake to validation, traceability, and evidence outputs using one enterprise workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link to={nextAction.path}>Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                <Link to="/run">Open Run Checks</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroSummaryCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/94 p-4 shadow-[var(--surface-shadow)] dark:bg-white/[0.04]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-2 font-display text-[1.7rem] font-semibold text-foreground">{value}</p>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function HeroMetricTile({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  tone: "primary" | "warning" | "neutral" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/15 bg-primary/6 text-primary"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border/70 bg-background/78 text-muted-foreground";

  return (
    <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/94 p-3.5 shadow-[var(--surface-shadow)] dark:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function HeroWorkflowStep({
  icon: Icon,
  label,
  detail,
  active = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--surface-radius-md)] border border-border/70 bg-background/94 p-3.5 shadow-[var(--surface-shadow)] dark:bg-white/[0.04]">
      <div
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
          active
            ? "border-primary/15 bg-primary/8 text-primary"
            : "border-border/70 bg-background/78 text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]",
              active
                ? "border-primary/15 bg-primary/8 text-primary"
                : "border-border/70 bg-background/70 text-muted-foreground"
            )}
          >
            {active ? "Active" : "Pending"}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function HeroQueueItem({
  icon: Icon,
  title,
  detail,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  tone: "primary" | "warning" | "neutral" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/15 bg-primary/8 text-primary"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border/70 bg-background/78 text-muted-foreground";

  return (
    <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/94 p-4 shadow-[var(--surface-shadow)] dark:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
            toneClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
      </div>
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
