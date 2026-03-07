import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  BookCheck,
  FileCode2,
  LayoutDashboard,
  Moon,
  Play,
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
import { useCompliance } from "@/context/ComplianceContext";
import { fetchActiveTemplates } from "@/lib/api/mappingApi";
import { fetchCases } from "@/lib/api/casesApi";
import { analyzeCoverage } from "@/lib/mapping/coverageAnalyzer";
import { cn } from "@/lib/utils";
import daribaLogo from "@/assets/dariba-logo.png";
import type { MappingTemplate } from "@/types/fieldMapping";
import type { Case } from "@/types/cases";

const heroBullets = [
  "Pinpoint mandatory-field readiness before technical conformance execution",
  "Align ERP source structures to UAE and PINT-AE canonical invoice fields",
  "Run compliance checks with explainable exceptions and severity context",
  "Operate remediation through controls, evidence, and case-level governance",
  "Present audit-ready traceability across data, rules, outcomes, and actions",
];

const capabilityCards = [
  {
    title: "Data Ingestion & Readiness",
    description:
      "Ingest AR/AP invoice datasets, validate structural integrity, and profile readiness at source-field level.",
    icon: Database,
  },
  {
    title: "Schema Mapping & Alignment",
    description:
      "Map customer fields into canonical invoice structures with controlled templates and confidence visibility.",
    icon: Wand2,
  },
  {
    title: "Validation & Exception Controls",
    description:
      "Execute check packs, classify exceptions by severity, and route findings into operational control workflows.",
    icon: CheckCircle2,
  },
  {
    title: "Evidence, Traceability & Reconciliation",
    description:
      "Produce explainable evidence trails from requirement baseline through rule outcomes and remediation actions.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  {
    title: "Ingest",
    detail: "Bring in buyers, headers, and lines from source systems.",
  },
  {
    title: "Align",
    detail: "Map fields to canonical UAE/PINT-AE structures.",
  },
  {
    title: "Validate",
    detail: "Run compliance checks and capture rule-level outcomes.",
  },
  {
    title: "Control",
    detail: "Prioritize exceptions, track remediation, and evidence closure.",
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
    title: "Control & Resolve",
    description: "Manage exceptions, evidence outputs, and control operations.",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
];

export default function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isDataLoaded, isChecksRun, headers } = useCompliance();
  const [activeTemplates, setActiveTemplates] = useState<MappingTemplate[]>([]);
  const [cases, setCases] = useState<Case[]>([]);

  useEffect(() => {
    fetchActiveTemplates().then(setActiveTemplates);
    fetchCases().then(setCases);
  }, []);

  const isDark = resolvedTheme === "dark";
  const hasActiveMapping = activeTemplates.length > 0;
  const activeTemplate = activeTemplates[0];
  const coverage = activeTemplate ? analyzeCoverage(activeTemplate.mappings) : null;
  const mandatoryCoverage = coverage?.mandatoryCoverage ?? 0;
  const blockingGaps = coverage?.unmappedMandatory.length ?? 0;
  const openCases = cases.filter((c) => c.status === "Open" || c.status === "In Progress");
  const criticalCases = openCases.filter((c) => c.severity === "Critical");

  const nextAction = useMemo(() => {
    if (!isDataLoaded) return { label: "Start with data ingestion", path: "/upload" };
    if (!hasActiveMapping) return { label: "Create mapping template", path: "/mapping" };
    if (!isChecksRun) return { label: "Run compliance checks", path: "/run" };
    return { label: "Open control dashboard", path: "/dashboard" };
  }, [hasActiveMapping, isChecksRun, isDataLoaded]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <section className="relative overflow-hidden rounded-3xl surface-glass border border-white/70 px-6 py-8 md:px-10 md:py-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative z-10 grid items-stretch gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  UAE eInvoicing Data Readiness Control Studio
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  aria-label="Toggle dark mode"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>

              <div className="mb-6 flex items-center gap-3">
                <img src={daribaLogo} alt="Dariba Tech" className="h-20 w-auto shrink-0" />
                <div>
                  <p className="font-display text-xl font-semibold text-foreground">Controls Studio</p>
                  <p className="text-sm text-muted-foreground">Enterprise e-invoicing readiness</p>
                </div>
              </div>

              <h1 className="font-display text-3xl font-semibold leading-tight text-foreground md:text-5xl">
                The enterprise control plane for UAE eInvoicing data readiness
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
                DRCS helps teams align mandatory data baselines, technical conformance standards, and operational
                controls so invoice populations are ready before regulatory and platform deadlines.
              </p>

              <ul className="mt-5 space-y-2">
                {heroBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="rounded-xl gap-2 font-semibold">
                  <Link to={nextAction.path}>
                    {nextAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-xl">
                  <Link to="/traceability">Explore Traceability</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-xl gap-2">
                  <Link to="/check-registry">
                    <BookCheck className="h-4 w-4" />
                    Check Registry
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="surface-glass border-white/70">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform signal</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SignalCard label="Invoices" value={String(headers.length)} />
                  <SignalCard label="Open Cases" value={String(openCases.length)} />
                  <SignalCard label="Critical" value={String(criticalCases.length)} />
                  <SignalCard label="Coverage" value={`${Math.round(mandatoryCoverage)}%`} />
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-background/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Readiness posture</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mandatory coverage</span>
                    <span className="font-semibold text-foreground">{Math.round(mandatoryCoverage)}%</span>
                  </div>
                  <Progress value={mandatoryCoverage} className="mt-2 h-2" />
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Blocking gaps</span>
                    <span className={cn("font-semibold", blockingGaps > 0 ? "text-destructive" : "text-primary")}>
                      {blockingGaps}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-background/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operating model</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    MoF baseline determines what must exist, PINT-AE defines technical behavior, and DRCS determines
                    if data can pass controls at scale.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Core platform capabilities</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              DRCS combines readiness diagnostics, canonical alignment, check orchestration, and control intelligence
              into one integrated enterprise workflow.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map((capability) => {
              const Icon = capability.icon;
              return (
                <Card key={capability.title} className="surface-glass border-white/60">
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

        <section className="mt-10 rounded-3xl border border-white/10 bg-card/60 p-6 md:p-8">
          <div className="mb-5 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              The workflow follows a controlled sequence from source-data intake to governance-grade outcome management.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-background/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/90">Step {index + 1}</p>
                <p className="mt-1 font-display text-lg font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Product modules</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Navigate directly into the operational modules that power invoice readiness, conformance checks, and
              controlled remediation.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.title} to={module.path} className="group block">
                  <div className="h-full rounded-2xl border border-white/10 bg-card/70 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30">
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
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="surface-glass border-white/70">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trust, readiness and control intelligence</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-foreground">Operational confidence with regulatory context</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                DRCS provides a single control model connecting mandatory data coverage, mapping confidence, check
                execution quality, and exception governance signals.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <IntelPill icon={ShieldCheck} label="Mandatory baseline coverage" value={`${Math.round(mandatoryCoverage)}%`} />
                <IntelPill icon={AlertTriangle} label="Open operational cases" value={String(openCases.length)} />
                <IntelPill icon={Database} label="Invoice population observed" value={String(headers.length)} />
                <IntelPill icon={CheckCircle2} label="Checks runtime status" value={isChecksRun ? "Executed" : "Pending"} />
              </div>
            </CardContent>
          </Card>

          <Card className="surface-glass border-white/70">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Control outcomes</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-foreground">Current readiness posture</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  Readiness scoring anchored to active mapping and mandatory coverage.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  Exception load surfaced for faster triage and control prioritization.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  Traceability and evidence paths available for governance walkthroughs.
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild className="rounded-xl">
                  <Link to="/dashboard">Open Control Dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/evidence">View Evidence</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                Start your UAE eInvoicing readiness cycle with controlled execution
              </h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                Move from data intake to evidence-ready control outputs using one enterprise workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl">
                <Link to={nextAction.path}>Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-xl">
                <Link to="/run">Open Run Checks</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function IntelPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </div>
      <p className="mt-2 font-display text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
