import { Link, useLocation } from 'react-router-dom';
import { Upload, Play, LayoutDashboard, AlertTriangle, Wand2, BarChart3, Briefcase, XCircle, Home, Shield, FileDown, BookCheck, FileClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import daribaLogo from '@/assets/dariba-logo.png';
import { FEATURE_FLAGS } from '@/config/features';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/upload-audit', label: 'Upload Audit', icon: FileClock },
  { path: '/mapping', label: 'Mapping', icon: Wand2 },
  { path: '/traceability', label: 'Traceability', icon: Shield },
  { path: '/run', label: 'Run Checks', icon: Play },
  { path: '/check-registry', label: 'Check Registry', icon: BookCheck },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { path: '/cases', label: 'Cases', icon: Briefcase },
  { path: '/rejections', label: 'Rejections', icon: XCircle },
  { path: '/controls', label: 'Controls', icon: BarChart3 },
  { path: '/evidence-pack', label: 'Evidence Pack', icon: FileDown },
  { path: '/check-builder', label: 'Builder', icon: BarChart3 },
];

const effectiveNavItems = FEATURE_FLAGS.casesMenu
  ? navItems
  : navItems.filter((item) => item.path !== '/cases');

function NavigationContent() {
  const { isDataLoaded, isChecksRun } = useCompliance();

  const getItemState = (path: string) => {
    if (path === '/run' && !isDataLoaded) return 'disabled';
    if ((path === '/dashboard' || path === '/exceptions') && !isChecksRun) return 'disabled';
    return 'enabled';
  };

  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/60 bg-background/75 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Link to="/" className="flex items-center gap-3 mr-2">
          <div className="surface-glass rounded-xl p-1.5">
            <img src={daribaLogo} alt="Dariba Tech" className="h-7 w-auto" />
          </div>
          <div className="hidden lg:block">
            <p className="font-display text-sm font-semibold text-foreground leading-none">Controls Studio</p>
            <p className="text-[11px] text-muted-foreground mt-1">UAE eInvoicing Compliance</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto rounded-xl surface-glass px-2 py-1">
          {effectiveNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const state = getItemState(item.path);

            return (
              <Link
                key={item.path}
                to={state === 'disabled' ? '#' : item.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                    : state === 'disabled'
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/70'
                )}
                onClick={(e) => state === 'disabled' && e.preventDefault()}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden xl:flex items-center gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
            Compliance Command Center
          </span>
        </div>
      </div>
    </header>
  );
}

export function Navigation() {
  const location = useLocation();
  
  // Don't show navigation on landing page - return early before using other hooks
  if (location.pathname === '/') return null;

  return <NavigationContent />;
}
