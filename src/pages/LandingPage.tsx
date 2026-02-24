import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  FileDown,
  FileClock,
  FileText,
  LayoutDashboard,
  Orbit,
  Play,
  Search,
  ShieldCheck,
  Upload,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatsCard } from "@/components/StatsCard";
import { useCompliance } from "@/context/ComplianceContext";
import { fetchActiveTemplates } from "@/lib/api/mappingApi";
import { fetchCases } from "@/lib/api/casesApi";
import { analyzeCoverage } from "@/lib/mapping/coverageAnalyzer";
import { cn } from "@/lib/utils";
import daribaLogo from "@/assets/dariba-logo.png";
import type { MappingTemplate } from "@/types/fieldMapping";
import type { Case } from "@/types/cases";

const quickActions = [
  { label: "Upload Audit", icon: FileClock, path: "/upload-audit" },
  { label: "AP Explorer", icon: Search, path: "/ap-explorer" },
  { label: "Exceptions", icon: AlertTriangle, path: "/exceptions" },
  { label: "Check Registry", icon: FileText, path: "/check-registry" },
  { label: "Cases", icon: Briefcase, path: "/cases" },
  { label: "Controls", icon: BarChart3, path: "/controls" },
  { label: "Builder", icon: Wand2, path: "/check-builder" },
  { label: "Evidence", icon: FileDown, path: "/evidence" },
];

const workflow = [
  { key: "upload", label: "Collect", detail: "Ingest invoice datasets" },
  { key: "map", label: "Align", detail: "Map ERP fields to PINT-AE" },
  { key: "run", label: "Validate", detail: "Execute compliance checks" },
  { key: "govern", label: "Control", detail: "Manage cases and SLA" },
];

export default function LandingPage() {
  const { isDataLoaded, isChecksRun, getDashboardStats, headers } = useCompliance();
  const [activeTemplates, setActiveTemplates] = useState<MappingTemplate[]>([]);
  const [cases, setCases] = useState<Case[]>([]);

  const stats = isChecksRun ? getDashboardStats() : null;

  useEffect(() => {
    fetchActiveTemplates().then(setActiveTemplates);
    fetchCases().then(setCases);
  }, []);

  const hasActiveMapping = activeTemplates.length > 0;
  const activeTemplate = activeTemplates[0];
  const coverage = activeTemplate ? analyzeCoverage(activeTemplate.mappings) : null;
  const mandatoryCoverage = coverage?.mandatoryCoverage ?? 0;
  const blockingGaps = coverage?.unmappedMandatory.length ?? 0;
  const openCases = cases.filter((c) => c.status === "Open" || c.status === "In Progress");
  const criticalCases = openCases.filter((c) => c.severity === "Critical");

  const activeStep = !isDataLoaded ? 0 : !hasActiveMapping ? 1 : !isChecksRun ? 2 : 3;

  const nextAction = useMemo(() => {
    if (!isDataLoaded) return { label: "Upload source invoices", path: "/upload" };
    if (!hasActiveMapping) return { label: "Create mapping template", path: "/mapping" };
    if (!isChecksRun) return { label: "Run compliance checks", path: "/run" };
    return { label: "Review dashboard and cases", path: "/dashboard" };
  }, [isDataLoaded, hasActiveMapping, isChecksRun]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <section className="relative overflow-hidden rounded-3xl surface-glass border border-white/70 px-6 py-8 md:px-10 md:py-10">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-60 w-60 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Orbit className="h-3.5 w-3.5" />
                UAE PINT-AE Compliance Engine
              </div>
              <div className="mb-4 flex items-center gap-3">
                <img src={daribaLogo} alt="Dariba Tech" className="h-20 md:h-24 w-auto shrink-0" />
                <div>
                  <p className="font-display text-xl font-semibold text-foreground">Controls Studio</p>
                  <p className="text-sm text-muted-foreground">Enterprise e-invoicing readiness</p>
                </div>
              </div>
              <h1 className="font-display text-3xl font-semibold leading-tight text-foreground md:text-5xl">
                UAE eInvoicing Data Readiness &
                <span className="text-primary"> Compliance Control Centre</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
                Upload customer invoice data, align it to UAE schema requirements, run automated checks, and govern
                issues through cases and controls from one command center.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="rounded-xl gap-2 font-semibold">
                  <Link to={nextAction.path}>
                    {nextAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
                  UAE Spec: PINT-AE 2025-Q2
                </Badge>
                <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
                  Runtime: checks + mapping + cases
                </Badge>
              </div>
            </div>

            <Card className="surface-glass border-white/70">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live readiness</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MetricBox label="Invoices" value={String(headers.length)} />
                  <MetricBox label="Open Cases" value={String(openCases.length)} />
                  <MetricBox label="Critical" value={String(criticalCases.length)} />
                  <MetricBox label="Coverage" value={`${Math.round(mandatoryCoverage)}%`} />
                </div>
                <div className="mt-4 space-y-2">
                  <WorkflowProgress
                    title="Workflow Progress"
                    value={(activeStep / (workflow.length - 1)) * 100}
                    helper={workflow[activeStep].detail}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {workflow.map((step, index) => (
            <div
              key={step.key}
              className={cn(
                "rounded-2xl border p-4 transition-all",
                index <= activeStep ? "surface-glass border-primary/20" : "bg-card/70 border-border"
              )}
            >
              <p className="text-xs text-muted-foreground">Step {index + 1}</p>
              <p className="font-display mt-1 text-lg font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-4">
          <CommandTile
            title="Ingest Data"
            description="Upload buyers, headers, lines and run integrity prechecks."
            icon={Upload}
            path="/upload"
            tone="success"
          />
          <CommandTile
            title="Map to Schema"
            description="Align customer source fields to UAE PINT-AE structure."
            icon={Wand2}
            path="/mapping"
            tone="medium"
          />
          <CommandTile
            title="Execute Checks"
            description="Run rule packs and surface schema and business violations."
            icon={Play}
            path="/run"
            tone="low"
          />
          <CommandTile
            title="Control and Resolve"
            description="Track issues through exceptions, case lifecycle, and governance."
            icon={LayoutDashboard}
            path="/dashboard"
            tone="neutral"
          />
        </section>

        {isChecksRun && stats && (
          <section className="mt-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compliance Pulse</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard title="Total Invoices" value={stats.totalInvoices} icon={<FileText className="h-5 w-5" />} variant="default" />
              <StatsCard
                title="Exceptions"
                value={stats.totalExceptions}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant={stats.totalExceptions > 0 ? "warning" : "success"}
              />
              <StatsCard
                title="Pass Rate"
                value={`${stats.passRate.toFixed(1)}%`}
                icon={<CheckCircle2 className="h-5 w-5" />}
                variant={stats.passRate >= 90 ? "success" : stats.passRate >= 75 ? "warning" : "danger"}
              />
              <StatsCard
                title="Critical"
                value={stats.exceptionsBySeverity?.Critical ?? 0}
                icon={<ShieldCheck className="h-5 w-5" />}
                variant={(stats.exceptionsBySeverity?.Critical ?? 0) > 0 ? "danger" : "success"}
              />
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="surface-glass border-white/70">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mapping Confidence</p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="font-display text-2xl font-semibold text-foreground">{Math.round(mandatoryCoverage)}%</p>
                  <p className="text-sm text-muted-foreground">
                    Mandatory coverage{activeTemplate ? ` using ${activeTemplate.templateName}` : ""}
                  </p>
                </div>
                <Badge variant={blockingGaps > 0 ? "destructive" : "outline"} className="rounded-lg">
                  {blockingGaps} blocking gaps
                </Badge>
              </div>
              <Progress value={mandatoryCoverage} className="mt-4 h-2" />
              <div className="mt-5 flex gap-2">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/mapping">Open Mapping Studio</Link>
                </Button>
                <Button asChild className="rounded-xl">
                  <Link to="/run">Validate Now</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-glass border-white/70">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.path}
                      to={action.path}
                      className="rounded-xl border bg-card/80 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {action.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function WorkflowProgress({ title, value, helper }: { title: string; value: number; helper: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{title}</span>
        <span className="font-semibold text-primary">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-2" />
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/80 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CommandTile({
  title,
  description,
  icon: Icon,
  path,
  tone,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  tone: "success" | "medium" | "low" | "neutral";
}) {
  const toneClasses =
    tone === "success"
      ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success-bg))]/60"
      : tone === "medium"
      ? "border-[hsl(var(--severity-medium))]/35 bg-[hsl(var(--severity-medium-bg))]/60"
      : tone === "low"
      ? "border-[hsl(var(--severity-low))]/30 bg-[hsl(var(--severity-low-bg))]/60"
      : "border-border bg-card/80";

  return (
    <Link to={path} className="group block">
      <div className={cn("h-full rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md", toneClasses)}>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/80">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

