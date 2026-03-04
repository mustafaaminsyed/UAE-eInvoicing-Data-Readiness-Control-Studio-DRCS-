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
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { FEATURE_FLAGS } from '@/config/features';

interface SidebarItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Ingestion', path: '/upload', icon: Upload },
  { label: 'Schema Mapping', path: '/mapping', icon: Wand2 },
  { label: 'Validation', path: '/run', icon: PlayCircle },
  { label: 'Exceptions', path: '/exceptions', icon: AlertTriangle },
  { label: 'Cases', path: '/cases', icon: Briefcase },
  { label: 'Evidence', path: '/evidence-pack', icon: FileDown },
  { label: 'Check Registry', path: '/check-registry', icon: BookCheck },
  { label: 'Settings', path: '/settings', icon: Settings },
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

  return (
    <aside className="rounded-xl border border-border/70 bg-card shadow-lg p-3">
      <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Control Workspace
      </p>
      <nav className="space-y-1">
        {effectiveItems.map((item) => {
          const Icon = item.icon;
          const state = getItemState(item.path);
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={state === 'disabled' ? '#' : item.path}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : state === 'disabled'
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground'
              )}
              onClick={(e) => state === 'disabled' && e.preventDefault()}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
