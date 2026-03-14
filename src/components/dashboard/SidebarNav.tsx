import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Wand2,
  PlayCircle,
  AlertTriangle,
  Briefcase,
  FileDown,
  BookCheck,
  Gauge,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { FEATURE_FLAGS } from '@/config/features';

interface SidebarItem {
  label: string;
  path: string;
  icon: LucideIcon;
  phase: 'overview' | 'input' | 'processing' | 'output' | 'reference';
  inFlow?: boolean;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, phase: 'overview' },
  { label: 'Ingestion', path: '/upload', icon: Upload, phase: 'input', inFlow: true },
  { label: 'Schema Mapping', path: '/mapping', icon: Wand2, phase: 'input', inFlow: true },
  { label: 'Validation', path: '/run', icon: PlayCircle, phase: 'processing', inFlow: true },
  { label: 'Exceptions', path: '/exceptions', icon: AlertTriangle, phase: 'processing', inFlow: true },
  { label: 'Cases', path: '/cases', icon: Briefcase, phase: 'processing' },
  { label: 'Evidence', path: '/evidence-pack', icon: FileDown, phase: 'output', inFlow: true },
  { label: 'Check Registry', path: '/check-registry', icon: BookCheck, phase: 'reference' },
  { label: 'Traceability', path: '/traceability', icon: Shield, phase: 'reference' },
  { label: 'Control Dashboard', path: '/settings', icon: Gauge, phase: 'output' },
];

export function SidebarNav() {
  const location = useLocation();
  const { isDataLoaded, isChecksRun } = useCompliance();

  const getItemState = (path: string) => {
    if (path === '/run' && !isDataLoaded) return 'disabled';
    if ((path === '/dashboard' || path === '/exceptions') && !isChecksRun) return 'disabled';
    return 'enabled';
  };

  const effectiveItems = FEATURE_FLAGS.casesMenu
    ? SIDEBAR_ITEMS
    : SIDEBAR_ITEMS.filter((item) => item.path !== '/cases');

  const flowItems = effectiveItems.filter((item) => item.inFlow);
  const activeFlowIndex = flowItems.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path)
  );
  const grouped = {
    overview: effectiveItems.filter((item) => item.phase === 'overview'),
    input: effectiveItems.filter((item) => item.phase === 'input'),
    processing: effectiveItems.filter((item) => item.phase === 'processing'),
    output: effectiveItems.filter((item) => item.phase === 'output'),
    reference: effectiveItems.filter((item) => item.phase === 'reference'),
  };

  const renderItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const state = getItemState(item.path);
    const isActive =
      location.pathname === item.path ||
      (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
    const flowIndex = flowItems.findIndex((flowItem) => flowItem.path === item.path);
    const isFlowStep = item.inFlow && flowIndex >= 0;
    const isComplete = isFlowStep && activeFlowIndex >= flowIndex;
    const isFirstFlowStep = isFlowStep && flowIndex === 0;
    const isLastFlowStep = isFlowStep && flowIndex === flowItems.length - 1;
    const connectorActive = isFlowStep && activeFlowIndex >= flowIndex - 1;

    return (
      <Link
        key={item.path}
        to={state === 'disabled' ? '#' : item.path}
        className={cn(
          'group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : state === 'disabled'
            ? 'text-muted-foreground/50 cursor-not-allowed'
            : 'text-foreground/80 hover:bg-muted hover:text-foreground'
        )}
        onClick={(e) => state === 'disabled' && e.preventDefault()}
      >
        <span
          className={cn(
            'relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
            isActive
              ? 'border-primary-foreground/40 bg-primary-foreground/15'
              : isComplete
              ? 'border-primary/40 bg-primary/10'
              : 'border-border/70 bg-background/70'
          )}
          aria-hidden="true"
        >
          {isFlowStep && !isFirstFlowStep && (
            <span
              className={cn(
                'pointer-events-none absolute left-1/2 top-[-10px] h-[10px] w-px -translate-x-1/2',
                connectorActive ? 'bg-primary/45' : 'bg-border/70'
              )}
            />
          )}
          {isFlowStep && !isLastFlowStep && (
            <span
              className={cn(
                'pointer-events-none absolute left-1/2 bottom-[-10px] h-[10px] w-px -translate-x-1/2',
                connectorActive ? 'bg-primary/45' : 'bg-border/70'
              )}
            />
          )}
          <Icon className={cn('h-3.5 w-3.5', isActive && 'scale-105')} />
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="relative isolate overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-3 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" aria-hidden="true" />
      <p className="relative z-10 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Control Workspace
      </p>
      <nav className="relative z-10 space-y-3">
        <div className="space-y-1">
          {grouped.overview.map(renderItem)}
        </div>

        <div className="relative space-y-3">
          <div className="space-y-1">
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Input</p>
            <div className="relative">
              {grouped.input.map(renderItem)}
            </div>
          </div>

          <div className="space-y-1">
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Processing</p>
            <div className="relative">
              {grouped.processing.map(renderItem)}
            </div>
          </div>

          <div className="space-y-1">
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Output</p>
            <div className="relative">
              {grouped.output.map(renderItem)}
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t border-border/60 pt-2">
          {grouped.reference.map(renderItem)}
        </div>
      </nav>
    </aside>
  );
}
