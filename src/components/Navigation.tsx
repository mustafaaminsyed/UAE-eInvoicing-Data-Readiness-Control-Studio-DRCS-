import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Play, LayoutDashboard, AlertTriangle, Wand2, BarChart3, Briefcase, XCircle, Home, Shield, FileDown, BookCheck, FileClock, Search, Moon, Sun, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { Switch } from '@/components/ui/switch';
import daribaLogo from '@/assets/dariba-logo.png';
import { FEATURE_FLAGS } from '@/config/features';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/upload-audit', label: 'Upload Audit', icon: FileClock },
  { path: '/ap-explorer', label: 'AP Explorer', icon: Search },
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
  const { resolvedTheme, setTheme } = useTheme();
  const navRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const getItemState = (path: string) => {
    if (path === '/run' && !isDataLoaded) return 'disabled';
    if ((path === '/dashboard' || path === '/exceptions') && !isChecksRun) return 'disabled';
    return 'enabled';
  };

  const location = useLocation();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [location.pathname]);

  const themeLabel = useMemo(() => {
    if (!mounted) return 'Theme preference';
    return isDark ? 'Dark mode enabled' : 'Light mode enabled';
  }, [isDark, mounted]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-xl">
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

        <div className="relative flex-1 min-w-0">
          <nav
            ref={navRef}
            className="flex flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden scroll-smooth touch-pan-x rounded-xl surface-glass px-2 py-1 pr-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Primary navigation"
          >
            {effectiveNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const state = getItemState(item.path);

              return (
                <Link
                  key={item.path}
                  to={state === 'disabled' ? '#' : item.path}
                  data-active={isActive ? 'true' : 'false'}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                      : state === 'disabled'
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                  onClick={(e) => state === 'disabled' && e.preventDefault()}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-background/85 to-transparent rounded-l-xl" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-background/95 via-background/75 to-transparent rounded-r-xl" />
          <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-card/70 p-0.5">
            <ChevronRight className="h-3 w-3 text-muted-foreground/80" aria-hidden="true" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
            Compliance Command Center
          </span>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-2 py-1">
            <Sun className={cn('h-3.5 w-3.5', !isDark ? 'text-amber-500' : 'text-muted-foreground')} aria-hidden="true" />
            <Switch
              checked={mounted ? isDark : false}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              aria-label={themeLabel}
            />
            <Moon className={cn('h-3.5 w-3.5', isDark ? 'text-sky-400' : 'text-muted-foreground')} aria-hidden="true" />
          </div>
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
