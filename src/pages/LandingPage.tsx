import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
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
import daribaLogo from "@/assets/dariba-logo.png";
import type { MappingTemplate } from "@/types/fieldMapping";
import type { Case } from "@/types/cases";

type ClientEnvironment = "DEV" | "PROD";

const ENVIRONMENT_STORAGE_KEY = "drcs.preview_environment_v1";

const heroNavLinks = [
  { label: "Upload Audit", path: "/upload-audit" },
  { label: "Mapping", path: "/mapping" },
  { label: "Traceability", path: "/traceability" },
  { label: "Run Checks", path: "/run" },
  { label: "Check Registry", path: "/check-registry" },
];

const trustPills = [
  "UAE MoF baseline aligned",
  "PINT-AE traceability",
  "Control-grade evidence",
];

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

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="sticky top-4 z-40 mb-6">
          <div className="mx-auto max-w-6xl rounded-[1.65rem] border border-white/80 bg-white/68 px-4 py-4 shadow-[0_20px_45px_-36px_rgba(9,28,42,0.5)] backdrop-blur-xl dark:border-emerald-900/25 dark:bg-[#0f1917]/84 dark:shadow-[0_24px_52px_-36px_rgba(0,0,0,0.78)] md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/80 bg-white/85 p-2 shadow-sm dark:border-emerald-900/20 dark:bg-white/[0.04]">
                  <img src={daribaLogo} alt="Dariba Tech" className="h-9 w-auto" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">Controls Studio</p>
                  <p className="text-sm text-muted-foreground">UAE eInvoicing Compliance</p>
                </div>
              </div>

              <nav className="flex flex-1 flex-wrap items-center justify-center gap-2 lg:gap-3">
                {heroNavLinks.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="rounded-full border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/15 hover:bg-white/75 hover:text-foreground dark:hover:border-emerald-800/30 dark:hover:bg-emerald-500/[0.08] dark:hover:text-emerald-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary dark:border-emerald-700/30 dark:bg-emerald-500/[0.08] dark:text-emerald-300">
                  Compliance Command Center
                </span>
                <EnvironmentAccessToggle value={clientEnvironment} onChange={setClientEnvironment} />
                <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-2 py-1 shadow-sm dark:border-emerald-900/25 dark:bg-white/[0.04]">
                  <Sun className={cn("h-3.5 w-3.5", !isDark ? "text-amber-500" : "text-muted-foreground")} />
                  <Switch
                    checked={isDark}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    aria-label={isDark ? "Dark mode enabled" : "Light mode enabled"}
                  />
                  <Moon className={cn("h-3.5 w-3.5", isDark ? "text-emerald-300" : "text-muted-foreground")} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,252,0.95))] px-5 py-5 shadow-[0_38px_90px_-46px_rgba(14,35,52,0.35)] dark:border-emerald-900/30 dark:bg-[linear-gradient(180deg,rgba(14,22,20,0.96),rgba(9,15,14,0.99))] dark:shadow-[0_42px_100px_-52px_rgba(0,0,0,0.8)] md:px-8 md:py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_20%,rgba(102,208,255,0.25),transparent_24%),radial-gradient(circle_at_92%_18%,rgba(93,196,255,0.22),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(54,163,111,0.12),transparent_32%)] dark:bg-[radial-gradient(circle_at_10%_18%,rgba(47,153,95,0.18),transparent_26%),radial-gradient(circle_at_88%_12%,rgba(29,92,72,0.14),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(36,130,76,0.1),transparent_34%)]" />
          <div
            className="absolute inset-3 rounded-[1.7rem] border border-white/70 bg-white/18 backdrop-blur-[1px] dark:border-emerald-900/20 dark:bg-white/[0.02]"
            aria-hidden="true"
          />
          <div className="absolute left-[22%] top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-sky-200/70 to-transparent dark:hidden lg:block" />
          <div className="absolute left-[72%] top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-sky-200/60 to-transparent dark:hidden lg:block" />

          <div className="relative z-10">
            <div className="mx-auto mt-8 max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/78 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm dark:border-emerald-700/25 dark:bg-emerald-500/[0.06] dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Trusted for UAE readiness, traceability, and control evidence
              </div>

              <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-semibold leading-[0.95] tracking-[-0.05em] text-foreground md:text-6xl xl:text-[4.9rem]">
                Turn invoice data into compliance intelligence.
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Validate data before transmission, trace every field from source to control to exception,
                and improve UAE e-Invoicing readiness, conformance coverage, and operational risk visibility in one premium workspace.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="rounded-full px-7 shadow-[0_22px_40px_-26px_hsl(var(--primary))]">
                  <Link to={nextAction.path}>
                    {nextAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/90 bg-white/78 px-7 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.35)] dark:border-emerald-900/20 dark:bg-white/[0.04] dark:text-emerald-50 dark:hover:bg-emerald-500/[0.08]"
                >
                  <Link to="/traceability">
                    Explore traceability
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                {trustPills.map((pill) => (
                  <Badge
                    key={pill}
                    variant="outline"
                    className="rounded-full border-white/75 bg-white/58 px-3 py-1 text-[11px] font-medium text-muted-foreground dark:border-emerald-900/20 dark:bg-white/[0.04] dark:text-emerald-100/80"
                  >
                    {pill}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-6xl rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(246,250,253,0.96))] p-3 shadow-[0_34px_70px_-42px_rgba(11,36,59,0.42)] backdrop-blur dark:border-emerald-900/25 dark:bg-[linear-gradient(180deg,rgba(15,24,21,0.88),rgba(10,16,15,0.98))] dark:shadow-[0_42px_82px_-42px_rgba(0,0,0,0.84)]">
              <div className="rounded-[1.65rem] border border-white/85 bg-white/92 p-4 shadow-inner dark:border-emerald-900/20 dark:bg-[#101917]/88 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-slate-300/80" />
                      <span className="h-3 w-3 rounded-full bg-slate-300/80" />
                      <span className="h-3 w-3 rounded-full bg-slate-300/80" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/90">
                        Executive preview
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        UAE readiness and control intelligence
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-[11px] font-semibold text-primary dark:border-emerald-700/30 dark:bg-emerald-500/[0.08] dark:text-emerald-300"
                    >
                      {clientEnvironment} access
                    </Badge>
                    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground dark:border-emerald-900/20 dark:bg-white/[0.04] dark:text-emerald-50/75">
                      <Search className="h-3.5 w-3.5" />
                      Search readiness, controls, or exceptions
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <PreviewMetricCard
                      title="Mandatory coverage"
                      value={`${Math.round(mandatoryCoverage)}%`}
                      detail={blockingGaps > 0 ? `${blockingGaps} blocking gap(s)` : "No blocking gaps"}
                      icon={Wand2}
                    />
                    <PreviewMetricCard
                      title="Open control cases"
                      value={String(openCases.length)}
                      detail={
                        criticalCases.length > 0 ? `${criticalCases.length} critical case(s)` : "No critical escalations"
                      }
                      icon={AlertTriangle}
                    />
                    <PreviewMetricCard
                      title="Observed invoices"
                      value={String(headers.length)}
                      detail={isChecksRun ? "Latest validation executed" : "Ready for next run"}
                      icon={Database}
                    />
                    <PreviewMetricCard
                      title="Regional clock"
                      value={operatingContext.time}
                      detail={`${operatingContext.date} / ${operatingContext.timezoneLabel}`}
                      icon={Clock3}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[1.35rem] border border-border/60 bg-slate-950/[0.03] p-5 dark:border-emerald-900/20 dark:bg-white/[0.025]">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Source to control flow
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            One operating model from ingestion to evidence
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-white/85 bg-white/75 px-3 py-1 text-[11px] dark:border-emerald-900/20 dark:bg-white/[0.04] dark:text-emerald-50/85"
                        >
                          {hasActiveMapping ? "Mapping active" : "Mapping pending"}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {heroMessages.map((message, index) => (
                          <div
                            key={message}
                            className="flex items-start gap-3 rounded-2xl border border-white/75 bg-white/76 p-4 shadow-[0_16px_34px_-34px_rgba(15,23,42,0.6)] dark:border-emerald-900/20 dark:bg-white/[0.04]"
                          >
                            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-sm font-semibold text-primary">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{message}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {index === 0 &&
                                  "Detect missing mandatory fields, structural issues, and source-data blockers before transmission."}
                                {index === 1 &&
                                  "Maintain authoritative links between validation, coverage, control ownership, and evidence outputs."}
                                {index === 2 &&
                                  "Provide one view of readiness, exception posture, and conformance risk for executive review."}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/6 p-4 dark:border-emerald-700/25 dark:bg-emerald-500/[0.08]">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Readiness signal</span>
                          <span className="font-semibold text-foreground">{Math.round(mandatoryCoverage)}%</span>
                        </div>
                        <Progress value={mandatoryCoverage} className="mt-2 h-2.5" />
                        <p className="mt-3 text-xs text-muted-foreground">
                          {isChecksRun
                            ? "The latest validation run has completed and evidence outputs are available."
                            : "Run the latest check pack to generate traceability and evidence outputs."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.35rem] border border-border/60 bg-slate-950/[0.03] p-5 dark:border-emerald-900/20 dark:bg-white/[0.025]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Next recommended action
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{nextAction.label}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Move directly into the next operational step for this workspace.
                        </p>
                        <Button asChild className="mt-4 w-full rounded-2xl">
                          <Link to={nextAction.path}>
                            Continue workflow
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-2xl border border-white/75 bg-white/82 p-4 dark:border-emerald-900/20 dark:bg-white/[0.04]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Operating context
                          </p>
                          <p className="mt-2 font-display text-xl font-semibold text-foreground">
                            {activeEnvironmentConfig.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{activeEnvironmentConfig.caption}</p>
                        </div>

                        <div className="rounded-2xl border border-white/75 bg-white/82 p-4 dark:border-emerald-900/20 dark:bg-white/[0.04]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Evidence posture
                          </p>
                          <p className="mt-2 font-display text-xl font-semibold text-foreground">
                            {isChecksRun ? "Ready" : "Pending"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {isChecksRun ? "Traceability and Evidence Pack available" : "Awaiting validation run"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/75 bg-white/82 p-4 dark:border-emerald-900/20 dark:bg-white/[0.04]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Local clock
                            </p>
                            <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                              {operatingContext.time}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {operatingContext.date} / {operatingContext.timezoneLabel}
                            </p>
                          </div>
                          <ShieldCheck className="h-5 w-5 text-primary" />
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

function PreviewMetricCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/78 bg-white/82 p-4 shadow-[0_18px_34px_-36px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_34px_-36px_rgba(0,0,0,0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/15 bg-primary/6 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
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
    <div className="rounded-full border border-white/80 bg-white/80 p-1.5 shadow-sm dark:border-white/10 dark:bg-white/6">
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
                "min-w-[70px] rounded-full px-3 py-1.5 text-center transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_12px_24px_-18px_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-muted/65 hover:text-foreground"
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
