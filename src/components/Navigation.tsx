import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Play, LayoutDashboard, AlertTriangle, Wand2, BarChart3, Briefcase, XCircle, Home, Shield, FileDown, BookCheck, FileClock, Search, Moon, Sun, MoreHorizontal } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { Switch } from '@/components/ui/switch';
import daribaLogo from '@/assets/daribatech-logo-transparent.png';
import { FEATURE_FLAGS } from '@/config/features';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/', label: 'Home', icon: Home, tier: 'primary' },
  { path: '/upload', label: 'Upload', icon: Upload, tier: 'primary' },
  { path: '/upload-audit', label: 'Upload Audit', icon: FileClock, tier: 'secondary' },
  { path: '/ap-explorer', label: 'AP Explorer', icon: Search, tier: 'secondary' },
  { path: '/mapping', label: 'Mapping', icon: Wand2, tier: 'primary' },
  { path: '/traceability', label: 'Traceability', icon: Shield, tier: 'primary' },
  { path: '/run', label: 'Run Checks', icon: Play, tier: 'primary' },
  { path: '/check-registry', label: 'Check Registry', icon: BookCheck, tier: 'secondary' },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, tier: 'primary' },
  { path: '/exceptions', label: 'Exceptions', icon: AlertTriangle, tier: 'primary' },
  { path: '/cases', label: 'Cases', icon: Briefcase, tier: 'secondary' },
  { path: '/rejections', label: 'Rejections', icon: XCircle, tier: 'secondary' },
  { path: '/controls', label: 'Controls', icon: BarChart3, tier: 'secondary' },
  { path: '/evidence-pack', label: 'Evidence', icon: FileDown, tier: 'primary' },
  { path: '/check-builder', label: 'Builder', icon: BarChart3, tier: 'secondary' },
];

const effectiveNavItems = FEATURE_FLAGS.casesMenu
  ? navItems
  : navItems.filter((item) => item.path !== '/cases');

function NavigationContent() {
  const { isDataLoaded, isChecksRun } = useCompliance();
  const { resolvedTheme, setTheme } = useTheme();
  const navRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  const getItemState = (path: string) => {
    if (path === '/run' && !isDataLoaded) return 'disabled';
    if ((path === '/dashboard' || path === '/exceptions') && !isChecksRun) return 'disabled';
    return 'enabled';
  };

  const location = useLocation();
  const isDark = resolvedTheme === 'dark';
  const primaryNavItems = useMemo(() => effectiveNavItems.filter((item) => item.tier === 'primary'), []);
  const secondaryNavItems = useMemo(() => effectiveNavItems.filter((item) => item.tier === 'secondary'), []);
  const isOverflowActive = secondaryNavItems.some((item) => location.pathname === item.path);

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
    <header className="app-topbar sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-xl">
      <div className="container flex flex-col gap-2 py-2 md:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 md:flex-nowrap md:gap-3">
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <div className="surface-glass rounded-xl px-2.5 py-1.5 md:px-3 md:py-2">
              <img src={daribaLogo} alt="Daribatech" className="h-7 w-auto max-w-[136px] object-contain md:h-9 md:max-w-[164px]" />
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="font-display text-sm font-semibold leading-none text-foreground">Controls Studio</p>
              <p className="mt-1 hidden text-[11px] text-muted-foreground lg:block">UAE eInvoicing Compliance</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
            <span className="hidden rounded-full border border-primary/15 bg-primary/6 px-2.5 py-1 text-[11px] font-medium text-primary 2xl:inline-flex">
              Command Center
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

        <div className="min-w-0">
          <nav
            ref={navRef}
            className="flex flex-col items-stretch gap-2 rounded-2xl surface-glass px-3 py-2 sm:flex-row sm:items-start sm:justify-between xl:items-center"
            aria-label="Primary navigation"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-1 xl:flex-nowrap xl:overflow-x-auto xl:overflow-y-hidden xl:scroll-smooth xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const state = getItemState(item.path);

                return (
                  <Link
                    key={item.path}
                    to={state === 'disabled' ? '#' : item.path}
                    data-active={isActive ? 'true' : 'false'}
                    className={cn(
                      'flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-all sm:px-3 sm:py-2 sm:text-sm',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                        : state === 'disabled'
                        ? 'cursor-not-allowed text-muted-foreground/45'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    onClick={(e) => state === 'disabled' && e.preventDefault()}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors sm:w-auto',
                    isOverflowActive
                      ? 'border-primary/20 bg-primary/8 text-primary'
                      : 'border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                  aria-label="Open more navigation"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {secondaryNavItems.map((item, index) => {
                  const Icon = item.icon;
                  const state = getItemState(item.path);
                  const isActive = location.pathname === item.path;

                  return (
                    <div key={item.path}>
                      {index === 4 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        className={cn(
                          'gap-2',
                          state === 'disabled' && 'pointer-events-none opacity-45',
                          isActive && 'bg-accent text-accent-foreground'
                        )}
                        onSelect={(event) => {
                          event.preventDefault();
                          if (state === 'disabled') return;
                          navigate(item.path);
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
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
