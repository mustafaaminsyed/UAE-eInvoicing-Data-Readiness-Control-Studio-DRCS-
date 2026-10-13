import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BarChart3, Bell, Check, ChevronDown, CircleAlert, Database, ExternalLink, FileCheck2, FileSearch, FileText, Folder, Globe2, Home, Link2, Menu, Play, Route, Search, ShieldCheck, Users, X } from "lucide-react";
import daribaLogo from "@/assets/brand/dariba-drcs-light-lockup.png";
import heroBackdrop from "@/assets/landing/drcs-dubai-hero-background.png";
import mofEmblem from "@/assets/regulatory/uae-ministry-of-finance-emblem.png";
import ftaLogo from "@/assets/regulatory/uae-federal-tax-authority-logo.png";
import peppolLogo from "@/assets/regulatory/peppol-logo-transparent.png";

type ClientEnvironment = "DEV" | "PROD";
const ENVIRONMENT_STORAGE_KEY = "drcs.preview_environment_v1";

const navItems = [
  { label: "Product", href: "#product" }, { label: "Capabilities", href: "#capabilities" },
  { label: "Regulatory coverage", href: "#regulatory" }, { label: "Workflow", href: "#workflow" },
];

const PINT_PLAYBOOK_URL = "https://claude.ai/artifact/NDJhTZAmgYoDaLU46UYZUU";

const capabilities: Array<{ icon: ComponentType<{ className?: string }>; title: string; description: string }> = [
  { icon: Database, title: "Validate source data", description: "Assess completeness, quality and structure at scale." },
  { icon: Link2, title: "Align to UAE standards", description: "Map to PINT-AE and canonical invoice structures." },
  { icon: ShieldCheck, title: "Run compliance checks", description: "Identify gaps with clear exceptions and severity." },
  { icon: FileSearch, title: "Control and remediate", description: "Manage cases, evidence and end-to-end traceability." },
];

const workflow = [
  { icon: Database, title: "Ingest data", description: "Bring in AR/AP invoice datasets from your ERP and other sources.", path: "/upload" },
  { icon: Route, title: "Map to schema", description: "Align to the UAE canonical invoice structure and field mappings.", path: "/mapping" },
  { icon: FileCheck2, title: "Execute checks", description: "Run validation packs and surface non-conformant records.", path: "/run" },
  { icon: BarChart3, title: "Control and resolve", description: "Manage exceptions, remediation actions and audit-ready evidence.", path: "/exceptions" },
];

const previewDomains: Array<[string, number]> = [
  ["Mandatory fields", 88], ["Seller identity", 96], ["Buyer identity", 72], ["Invoice references", 79],
  ["Tax information", 94], ["Payment information", 56], ["Line-level data", 86], ["Code lists", 89],
];

const previewFindings = [
  ["Critical", "Buyer Endpoint ID missing", "1,428", "Investigate"],
  ["Critical", "Invoice number duplicated", "892", "Resolve"],
  ["High", "Buyer TRN format invalid", "654", "Review"],
  ["High", "Credit note reference absent", "412", "Review"],
  ["Medium", "UOM mapping unresolved", "308", "Map"],
];

const regulatoryBodies = [
  { name: "MoF", sub: "Ministry of Finance", logo: mofEmblem, alt: "UAE Ministry of Finance emblem" },
  { name: "FTA", sub: "Federal Tax Authority", logo: ftaLogo, alt: "UAE Federal Tax Authority logo" },
  { name: "Peppol", sub: "Peppol interoperability framework", logo: peppolLogo, alt: "Peppol logo" },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const resourcesMenuRef = useRef<HTMLDivElement>(null);
  const resourcesButtonRef = useRef<HTMLButtonElement>(null);
  const resourcesLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const closeResourcesOnOutsideClick = (event: PointerEvent) => {
      if (!resourcesMenuRef.current?.contains(event.target as Node)) setResourcesOpen(false);
    };
    document.addEventListener("pointerdown", closeResourcesOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeResourcesOnOutsideClick);
  }, []);

  const closeDesktopResources = () => {
    setResourcesOpen(false);
    resourcesButtonRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-[#f7faf9] text-[#071527]">
      <section id="product" className="relative overflow-hidden bg-[#062d27] text-white">
        <img src={heroBackdrop} alt="" className="absolute inset-0 h-full w-full object-cover object-center" aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,36,31,0.32)_0%,rgba(3,36,31,0.08)_52%,rgba(3,36,31,0.02)_100%)]" />

        <div className="relative mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-12">
          <header className="flex h-24 items-center justify-between gap-8">
            <Link to="/" className="flex min-w-0 items-center gap-4" aria-label="DRCS home">
              <img src={daribaLogo} alt="Dariba DRCS" className="h-14 w-[154px] object-contain object-left" />
              <span className="hidden h-10 w-px bg-white/20 sm:block" />
              <span className="hidden text-[11px] font-semibold uppercase leading-5 tracking-[0.13em] text-emerald-50/85 sm:block">UAE e-invoicing<br />Data Readiness Control Studio</span>
            </Link>
            <nav className="hidden items-center gap-8 xl:flex" aria-label="Main navigation">
              {navItems.map((item) => <a key={item.label} href={item.href} className="text-sm font-semibold text-white/88 transition hover:text-emerald-300">{item.label}</a>)}
              <div ref={resourcesMenuRef} className="relative" onKeyDown={(event) => {
                if (event.key === "Escape" && resourcesOpen) {
                  event.preventDefault();
                  closeDesktopResources();
                }
              }}>
                <button
                  ref={resourcesButtonRef}
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/88 transition hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56eda4] focus-visible:ring-offset-4 focus-visible:ring-offset-[#062d27]"
                  aria-haspopup="menu"
                  aria-expanded={resourcesOpen}
                  aria-controls="desktop-resources-menu"
                  onClick={() => setResourcesOpen((value) => !value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setResourcesOpen(true);
                      window.requestAnimationFrame(() => resourcesLinkRef.current?.focus());
                    }
                  }}
                >
                  Resources <ChevronDown className={`h-3.5 w-3.5 transition-transform ${resourcesOpen ? "rotate-180" : ""}`} />
                </button>
                {resourcesOpen && <div id="desktop-resources-menu" role="menu" className="absolute right-0 top-full z-30 mt-4 w-[390px] rounded-2xl border border-emerald-200/20 bg-[#06231f]/[0.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl">
                  <a ref={resourcesLinkRef} role="menuitem" href={PINT_PLAYBOOK_URL} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border border-transparent p-4 transition hover:border-emerald-300/20 hover:bg-emerald-300/10 focus-visible:border-[#56eda4] focus-visible:bg-emerald-300/10 focus-visible:outline-none">
                    <span className="flex items-start justify-between gap-4"><span className="font-display text-base font-bold text-white">PINT Data Requirements Playbook</span><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#56eda4]" aria-hidden="true" /></span>
                    <span className="mt-2 block text-sm leading-6 text-emerald-50/75">Interactive UAE PINT-AE and Oman PINT-OM field requirements, validation rules and regulatory relationships.</span>
                    <span className="mt-3 block border-t border-white/10 pt-3 text-xs leading-5 text-emerald-100/60">External reference resource; separate from the DRCS production validation engine.</span>
                  </a>
                </div>}
              </div>
            </nav>
            <div className="hidden items-center gap-3 xl:flex">
              <button type="button" className="flex h-11 items-center gap-2 px-2 text-sm font-medium text-white/90" aria-label="Language: English"><Globe2 className="h-4 w-4" /> EN <ChevronDown className="h-3.5 w-3.5" /></button>
              <Link to="/dashboard" className="inline-flex h-11 items-center rounded-xl border border-white/35 px-5 text-sm font-semibold transition hover:bg-white/10">Sign in</Link>
              <Link to="/upload" className="inline-flex h-11 items-center gap-3 rounded-xl bg-[#56eda4] px-5 text-sm font-bold text-[#04261f] shadow-[0_10px_30px_rgba(70,235,158,0.25)] transition hover:bg-[#73f1b5]">Get started <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-lg border border-white/20 p-2 xl:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </header>

          {menuOpen && <nav className="mb-5 grid gap-2 rounded-2xl border border-white/15 bg-[#06231f]/95 p-4 xl:hidden" aria-label="Mobile navigation">
            {navItems.map((item) => <a key={item.label} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold">{item.label}</a>)}
            <button type="button" className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56eda4]" aria-expanded={mobileResourcesOpen} aria-controls="mobile-resources-menu" onClick={() => setMobileResourcesOpen((value) => !value)}>
              Resources <ChevronDown className={`h-4 w-4 transition-transform ${mobileResourcesOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileResourcesOpen && <div id="mobile-resources-menu" className="rounded-xl border border-emerald-200/15 bg-emerald-300/[0.07] p-2">
              <a href={PINT_PLAYBOOK_URL} target="_blank" rel="noopener noreferrer" className="block rounded-lg p-3 transition hover:bg-emerald-300/10 focus-visible:bg-emerald-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56eda4]">
                <span className="flex items-start justify-between gap-3"><span className="font-display text-sm font-bold">PINT Data Requirements Playbook</span><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#56eda4]" aria-hidden="true" /></span>
                <span className="mt-2 block text-xs leading-5 text-emerald-50/75">Interactive UAE PINT-AE and Oman PINT-OM field requirements, validation rules and regulatory relationships.</span>
                <span className="mt-2 block border-t border-white/10 pt-2 text-[11px] leading-4 text-emerald-100/60">External reference resource; separate from the DRCS production validation engine.</span>
              </a>
            </div>}
            <Link to="/upload" className="mt-2 rounded-lg bg-[#56eda4] px-3 py-3 text-center text-sm font-bold text-[#04261f]">Get started</Link>
          </nav>}

          <div className="grid items-center gap-10 pb-0 pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:pt-14">
            <div className="max-w-[650px] pb-14 lg:pb-20" data-testid="hero-copy">
              <div className="inline-flex rounded-full border border-emerald-300/15 bg-emerald-400/20 px-4 py-2 text-xs font-semibold text-emerald-200">Built for UAE e-invoicing</div>
              <h1 className="mt-6 font-display text-[clamp(3rem,3.75vw,4rem)] font-bold leading-[1.04] tracking-[-0.045em]">From source data<br />to <span className="text-[#55eba2]">regulatory readiness</span></h1>
              <p className="mt-6 max-w-[610px] text-lg leading-8 text-emerald-50/80 lg:text-xl">DRCS helps enterprises validate, align, and control their invoice data so it is ready for UAE e-invoicing (PINT-AE) — with audit-ready traceability and continuous governance.</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/upload" className="inline-flex h-14 min-w-48 items-center justify-center gap-3 rounded-xl bg-[#56eda4] px-7 text-base font-bold text-[#04261f] transition hover:bg-[#73f1b5]">Get started <ArrowRight className="h-4 w-4" /></Link>
                <a href="#workflow" className="inline-flex h-14 min-w-48 items-center justify-center gap-3 rounded-xl border border-white/55 px-7 text-base font-semibold transition hover:bg-white/10"><Play className="h-5 w-5" /> See how it works</a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-emerald-50/85">
                {["UAE PINT-AE aligned", "Enterprise grade", "Audit-ready evidence", "Works with your ERP"].map((item) => <span key={item} className="inline-flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#56eda4] text-[#063128]"><Check className="h-3.5 w-3.5" /></span>{item}</span>)}
              </div>
            </div>

            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-8 sm:px-8 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
          {capabilities.map(({ icon: Icon, title, description }, index) => <div key={title} className={`flex gap-4 lg:px-6 ${index ? "lg:border-l lg:border-slate-200" : ""}`}><span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#dcfaeb] text-[#092b36]"><Icon className="h-7 w-7" /></span><div className="pt-1"><h2 className="font-display text-base font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-[#53729a]">{description}</p></div></div>)}
        </div>
      </section>

      <section id="workflow" className="scroll-mt-6 bg-[#f8fbfb] py-10 lg:scroll-mt-8 lg:py-14">
        <div className="mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-12">
          <div className="grid overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(11,42,52,0.05)] lg:grid-cols-[2.25fr_1fr]">
            <div className="p-7 lg:p-10">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">A controlled path to e-invoicing readiness</h2><p className="mt-2 max-w-3xl text-base leading-7 text-[#53729a]">DRCS combines data diagnostics, canonical alignment, check orchestration and control intelligence into one integrated workflow.</p></div><a href="#workflow" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-[#163b68] transition hover:border-emerald-400 hover:bg-emerald-50">Explore the workflow <ArrowRight className="h-4 w-4" /></a></div>
              <div className="mt-9 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
                {workflow.map(({ icon: Icon, title, description, path }, index) => <Link key={title} to={path} className="group relative block"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#56eda4] text-sm font-bold text-[#063128]">{index + 1}</span><span className="grid h-16 w-16 place-items-center rounded-full bg-[#dcfaeb] transition group-hover:bg-[#c8f7df]"><Icon className="h-7 w-7" /></span></div>{index < workflow.length - 1 && <span className="pointer-events-none absolute -right-5 top-6 hidden items-center text-slate-300 xl:flex" aria-hidden="true"><span className="h-px w-7 bg-slate-200" /><ArrowRight className="-ml-1 h-4 w-4" /></span>}<h3 className="mt-4 font-display text-base font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#53729a]">{description}</p></Link>)}
              </div>
            </div>
            <RegulatoryPanel />
          </div>
        </div>
      </section>
    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="min-w-0 self-center pb-10 lg:pb-16" data-testid="hero-dashboard-preview">
      <div className="mb-3 inline-flex rounded-full border border-amber-200/25 bg-[#071d22]/85 px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.13em] text-amber-100 shadow-lg backdrop-blur-sm sm:text-[9px]">Illustrative sample metrics</div>
      <div className="relative mx-auto aspect-[1.64/1] w-full max-w-[760px] overflow-hidden rounded-[22px] border border-slate-400/65 bg-[#061824] shadow-[0_30px_70px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] [transform:perspective(1400px)_rotateY(-1.25deg)_rotateX(0.5deg)]">
        <div className="flex h-full text-white">
          <aside className="flex w-[22%] shrink-0 flex-col border-r border-white/10 bg-[#04131d] p-[2.4%]">
            <div className="font-display text-[clamp(8px,1.05vw,15px)] font-bold leading-tight">DARIBA <span className="block text-[#55eba2]">DRCS</span></div>
            <div className="mt-[15%] flex items-center gap-2 rounded-md bg-emerald-500/20 p-[8%] text-[clamp(6px,0.72vw,10px)] font-semibold text-emerald-200"><Home className="h-[1.2em] w-[1.2em]" /> Control Centre</div>
            <PreviewNavGroup label="Data" items={[[Database, "Data Sources"], [Route, "Mapping"], [FileText, "Validation"]]} />
            <PreviewNavGroup label="Controls" items={[[AlertTriangle, "Exceptions"], [Folder, "Cases"], [Users, "Reconciliation"]]} />
            <PreviewNavGroup label="Governance" items={[[FileCheck2, "Requirements"], [FileText, "Evidence"], [Route, "Traceability"]]} />
          </aside>

          <div className="min-w-0 flex-1 p-[2.4%]">
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/5 bg-white/[0.045] px-[2.5%] py-[1.7%] text-[clamp(5px,0.65vw,9px)] text-white/40"><Search className="h-[1.2em] w-[1.2em]" /> Search invoices, fields, rules, or cases...</div>
              <span className="hidden items-center gap-1 text-[clamp(5px,0.65vw,9px)] text-white/65 sm:flex">🇦🇪 UAE / PINT-AE</span>
              <Bell className="h-[clamp(9px,1.1vw,15px)] w-[clamp(9px,1.1vw,15px)] text-white/55" />
            </div>
            <div className="mt-[2.5%] flex items-end justify-between gap-3">
              <div><h2 className="font-display text-[clamp(9px,1.5vw,21px)] font-bold leading-none">UAE e-Invoicing Readiness</h2><p className="mt-1 text-[clamp(5px,0.68vw,9px)] text-white/58">UAE Enterprise &nbsp; • &nbsp; Production &nbsp; • &nbsp; 128,450 invoices analysed</p></div>
              <span className="rounded-md bg-[#55eba2] px-[2.8%] py-[1.4%] text-[clamp(5px,0.68vw,9px)] font-bold text-[#052820]">Run checks</span>
            </div>

            <div className="mt-[2.5%] grid grid-cols-4 gap-[1.5%]">
              <PreviewMetric label="Readiness score" value="78%" detail="↑ +8%" tone="emerald" />
              <PreviewMetric label="Mandatory coverage" value="91%" detail="312 of 342 fields" tone="emerald" />
              <PreviewMetric label="Critical gaps" value="12" detail="↑ +3" tone="red" />
              <PreviewMetric label="Open cases" value="37" detail="↑ +11" tone="amber" />
            </div>

            <div className="mt-[2%] grid min-h-0 grid-cols-[1.05fr_0.95fr] gap-[1.7%]">
              <section className="rounded-lg border border-white/10 bg-white/[0.025] p-[3.5%]">
                <h3 className="text-[clamp(7px,0.82vw,12px)] font-bold text-white/95">Readiness by control domain</h3>
                <div className="mt-[4%] space-y-[2.4%]">{previewDomains.map(([label, value]) => <div key={label} className="grid grid-cols-[38%_1fr_10%] items-center gap-[2%] text-[clamp(5px,0.6vw,9px)]"><span className="truncate font-medium text-white/82">{label}</span><span className="h-[clamp(3px,0.45vw,6px)] overflow-hidden rounded-full bg-white/12 shadow-inner"><span className={`block h-full rounded-full shadow-[0_0_8px_rgba(77,232,157,0.2)] ${value < 75 ? "bg-amber-300" : "bg-[#4de89d]"}`} style={{ width: `${value}%` }} /></span><span className="text-right font-bold text-white/90">{value}%</span></div>)}</div>
              </section>
              <section className="rounded-lg border border-white/10 bg-white/[0.025] p-[3.5%]">
                <h3 className="text-[clamp(7px,0.82vw,12px)] font-bold text-white/95">Top issues requiring attention</h3>
                <div className="mt-[4%] space-y-[2.2%]">{previewFindings.map(([severity, issue, affected, action]) => <div key={issue} className="grid grid-cols-[22%_1fr_16%_22%] items-center gap-[2%] border-b border-white/[0.08] pb-[2%] text-[clamp(5px,0.56vw,8.5px)]"><span className={`rounded px-1 py-[0.2em] text-center font-semibold ${severity === "Critical" ? "bg-red-500/30 text-red-200" : "bg-amber-400/25 text-amber-100"}`}>{severity}</span><span className="truncate font-medium text-white/88">{issue}</span><span className="text-right text-white/72">{affected}</span><span className="truncate text-right font-semibold text-sky-300">{action}</span></div>)}</div>
              </section>
            </div>
          </div>
        </div>
        <span className="sr-only">Readiness dashboard</span>
      </div>
    </div>
  );
}

function PreviewNavGroup({ label, items }: { label: string; items: Array<[typeof Database, string]> }) {
  return <div className="mt-[12%]"><p className="text-[clamp(4px,0.52vw,7px)] font-semibold uppercase tracking-[0.15em] text-sky-200/55">{label}</p><div className="mt-[5%] space-y-[2%]">{items.map(([Icon, item]) => <div key={item} className="flex items-center gap-2 py-[2.5%] text-[clamp(5px,0.62vw,9px)] text-white/68"><Icon className="h-[1.1em] w-[1.1em] shrink-0" />{item}</div>)}</div></div>;
}

function PreviewMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "emerald" | "red" | "amber" }) {
  const tones = { emerald: "text-[#55eba2]", red: "text-red-300", amber: "text-amber-200" };
  const surfaces = { emerald: "bg-emerald-400/[0.055]", red: "bg-red-500/[0.12]", amber: "bg-amber-400/[0.10]" };
  return <div className={`min-w-0 rounded-lg border border-white/10 p-[9%] shadow-[0_8px_18px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.045)] ${surfaces[tone]}`}><p className="truncate text-[clamp(5px,0.62vw,9px)] font-semibold text-white/82">{label}</p><p className="mt-[5%] font-display text-[clamp(11px,1.45vw,21px)] font-bold leading-none text-white">{value}</p><p className={`mt-[7%] truncate text-[clamp(5px,0.57vw,8px)] font-semibold ${tones[tone]}`}>{detail}</p></div>;
}

/* Legacy coded preview retained temporarily in this uncommitted design iteration.
function LegacyDashboardPreview({ readiness, invoiceCount, caseCount, illustrative, environment, onEnvironmentChange }: { readiness: number; invoiceCount: number; caseCount: number; illustrative: boolean; environment: ClientEnvironment; onEnvironmentChange: (value: ClientEnvironment) => void }) {
  return <div className="relative min-h-[565px] self-end lg:translate-x-5"><div className="absolute inset-x-0 bottom-0 top-4 rotate-[2.5deg] overflow-hidden rounded-t-[28px] border border-emerald-200/35 bg-[#061a25] shadow-[0_36px_80px_rgba(0,0,0,0.42)]"><div className="flex h-full">
    <aside className="hidden w-[142px] shrink-0 border-r border-white/8 bg-[#05141d] p-4 sm:block"><p className="font-display text-base font-bold text-white">DARIBA <span className="block text-xs text-[#55eba2]">DRCS</span></p><p className="mt-8 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">Data</p>{["Control centre", "Data sources", "Mapping", "Validation"].map((item, index) => <div key={item} className={`mt-2 rounded-lg px-2 py-2 text-[10px] ${index === 0 ? "bg-emerald-400/15 text-emerald-300" : "text-white/56"}`}>{item}</div>)}<p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">Controls</p>{["Exceptions", "Cases", "Evidence", "Traceability"].map((item) => <div key={item} className="mt-1 px-2 py-2 text-[10px] text-white/56">{item}</div>)}</aside>
    <div className="min-w-0 flex-1 p-4 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.15em] text-emerald-300/70">UAE e-invoicing</p><h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">Readiness dashboard</h2><p className="mt-1 text-[10px] text-white/45">{invoiceCount.toLocaleString("en-AE")} invoices analysed</p></div><EnvironmentToggle value={environment} onChange={onEnvironmentChange} /></div>
      {illustrative && <div className="mt-3 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200">Illustrative sample metrics</div>}
      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4"><Metric label="Ready" value={`${readiness}%`} tone="emerald" /><Metric label="Mandatory coverage" value="91%" tone="emerald" /><Metric label="Critical gaps" value="12" tone="red" /><Metric label="Open cases" value={String(caseCount)} tone="amber" /></div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]"><div className="rounded-xl border border-white/8 bg-white/[0.035] p-4"><div className="flex justify-between text-[10px]"><span className="font-semibold">Readiness by control domain</span><span className="text-emerald-300">View all →</span></div><div className="mt-4 space-y-3">{readinessDomains.map(([label, value]) => <div key={label} className="grid grid-cols-[105px_1fr_28px] items-center gap-2 text-[9px]"><span className="truncate text-white/65">{label}</span><span className="h-1.5 overflow-hidden rounded-full bg-white/8"><span className={`block h-full rounded-full ${value < 70 ? "bg-amber-300" : "bg-[#4de89d]"}`} style={{ width: `${value}%` }} /></span><span className="text-right font-semibold">{value}%</span></div>)}</div></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4"><div className="flex justify-between text-[10px]"><span className="font-semibold">Top issues</span><span className="text-emerald-300">View all →</span></div><div className="mt-3 space-y-2">{[["Critical", "Buyer endpoint ID missing"], ["Critical", "Invoice number duplicated"], ["High", "Buyer TRN format invalid"], ["High", "Credit note reference absent"]].map(([severity, issue]) => <div key={issue} className="flex items-center gap-2 border-b border-white/5 pb-2 text-[8.5px]"><span className={`rounded px-1.5 py-1 font-semibold ${severity === "Critical" ? "bg-red-500/20 text-red-300" : "bg-amber-400/20 text-amber-200"}`}>{severity}</span><span className="truncate text-white/62">{issue}</span></div>)}</div></div></div>
    </div>
  </div></div></div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "red" | "amber" }) {
  const tones = { emerald: "text-[#55eba2]", red: "text-red-300", amber: "text-amber-200" };
  return <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3"><p className="text-[9px] text-white/45">{label}</p><p className={`mt-2 font-display text-2xl font-bold ${tones[tone]}`}>{value}</p></div>;
}

*/
function EnvironmentToggle({ value, onChange }: { value: ClientEnvironment; onChange: (value: ClientEnvironment) => void }) {
  return <div className="flex rounded-lg border border-white/10 bg-white/5 p-1" aria-label="Preview environment">{(["DEV", "PROD"] as const).map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={`rounded-md px-2 py-1 text-[9px] font-bold ${value === option ? "bg-[#55eba2] text-[#052820]" : "text-white/48"}`}>{option}</button>)}</div>;
}

function RegulatoryPanel() {
  return <aside id="regulatory" className="border-t border-emerald-100 bg-[linear-gradient(145deg,#e9fbf3,#dff8ec)] p-7 lg:border-l lg:border-t-0 lg:p-9"><h2 className="font-display text-xl font-bold">Regulatory alignment</h2><p className="mt-2 text-sm leading-6 text-[#53729a]">Designed for UAE e-invoicing readiness and alignment to published standards.</p><div className="mt-7 grid grid-cols-3 gap-3">{regulatoryBodies.map((item) => <div key={item.name} className="flex min-h-32 flex-col items-center rounded-xl border border-emerald-900/10 bg-white/60 p-3 text-center"><div className="flex h-16 w-full items-center justify-center"><img src={item.logo} alt={item.alt} className="max-h-14 w-full object-contain" /></div><p className="mt-2 min-h-8 text-[9px] leading-4 text-[#53729a]">{item.sub}</p></div>)}</div><div className="mt-6 flex flex-wrap gap-2">{["PINT-AE", "UAE e-invoicing", "MoF publications", "Peppol specifications"].map((item) => <span key={item} className="rounded-full bg-emerald-700/5 px-3 py-1.5 text-[10px] font-medium text-[#397160]">{item}</span>)}</div><div className="mt-6 flex gap-2 border-t border-emerald-900/15 pt-5 text-[11px] font-medium leading-5 text-[#345d74]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#397160]" /><p>References indicate standards alignment only. DRCS is not endorsed by, affiliated with, or acting on behalf of the UAE Ministry of Finance, Federal Tax Authority, or OpenPeppol.</p></div></aside>;
}

const PHASE_ONE_GO_LIVE = new Date("2027-01-01T00:00:00+04:00").getTime();

function getMandateCountdown() {
  const remaining = Math.max(0, PHASE_ONE_GO_LIVE - Date.now());
  return {
    expired: remaining === 0,
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
    seconds: Math.floor((remaining / 1_000) % 60),
  };
}

function MandateCountdown() {
  const [remaining, setRemaining] = useState(getMandateCountdown);

  useEffect(() => {
    const interval = window.setInterval(() => setRemaining(getMandateCountdown()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <a
      href="https://mof.gov.ae/en/news/ministry-of-finance-announces-targeted-amendments-to-einvoicing-system-decisions/"
      target="_blank"
      rel="noreferrer"
      aria-label="UAE eInvoicing Phase 1 mandatory implementation countdown. View the official Ministry of Finance announcement."
      className="relative z-20 mt-2 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200/20 bg-[#041f1c]/88 px-4 py-3 shadow-xl backdrop-blur-md transition hover:border-emerald-300/45 sm:ml-auto sm:w-fit lg:absolute lg:right-12 lg:top-[96px] lg:mt-0"
    >
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">UAE eInvoicing · Phase 1</p>
        <p className="mt-1 text-[11px] font-medium text-white/76">≥ AED 50m revenue · 1 Jan 2027</p>
      </div>
      {remaining.expired ? (
        <span className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-300">Now live</span>
      ) : (
        <div className="flex gap-2 font-display tabular-nums" aria-label={`${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds remaining`}>
          <CountdownUnit value={remaining.days} label="days" />
          <CountdownUnit value={remaining.hours} label="hrs" />
          <CountdownUnit value={remaining.minutes} label="min" />
          <CountdownUnit value={remaining.seconds} label="sec" />
        </div>
      )}
    </a>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="min-w-8 text-center">
      <span className="block text-base font-bold leading-none text-white">{String(value).padStart(2, "0")}</span>
      <span className="mt-1 block text-[7px] font-semibold uppercase tracking-[0.13em] text-emerald-200/55">{label}</span>
    </span>
  );
}
