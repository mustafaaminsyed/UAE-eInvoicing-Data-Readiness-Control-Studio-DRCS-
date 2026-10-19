import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Play, LayoutDashboard, AlertTriangle, Wand2, BarChart3, Briefcase, XCircle, Home, Shield, FileDown, BookCheck, FileClock, Search, Moon, Sun, MoreHorizontal } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { Switch } from '@/components/ui/switch';
import daribaLogo from '@/assets/brand/dariba-drcs-light-lockup.png';
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
    <header className="app-topbar relative z-50 w-full border-b border-white/15 bg-[#062d27]/90 text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:sticky sm:top-0">
      <div className="container mx-auto flex max-w-[1480px] flex-col gap-2 px-5 py-2.5 sm:px-8 xl:flex-row xl:items-center xl:gap-6 xl:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3 xl:contents">
          <Link to="/" className="order-1 flex min-w-0 shrink-0 items-center gap-3 xl:gap-4">
            <img src={daribaLogo} alt="Dariba DRCS" className="block h-10 w-[130px] shrink-0 object-contain object-left md:w-[150px]" />
            <span className="hidden h-9 w-px bg-white/25 sm:block" />
            <div className="hidden min-w-0 md:block">
              <p className="font-display text-sm font-semibold leading-none text-white">UAE e-Invoicing</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-50/70">Data Readiness Control Studio</p>
            </div>
          </Link>

          <div className="order-3 flex shrink-0 items-center gap-2 xl:order-3">
            <span className="hidden rounded-full border border-emerald-100/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-emerald-50/85 2xl:inline-flex">
              Command Center
            </span>
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-2 py-1">
              <Sun className={cn('h-3.5 w-3.5', !isDark ? 'text-amber-300' : 'text-white/50')} aria-hidden="true" />
              <Switch
                checked={mounted ? isDark : false}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                aria-label={themeLabel}
              />
              <Moon className={cn('h-3.5 w-3.5', isDark ? 'text-sky-300' : 'text-white/50')} aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="order-2 min-w-0 xl:flex-1">
          <nav
            ref={navRef}
            className="flex flex-col items-stretch gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between xl:justify-center"
            aria-label="Primary navigation"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 xl:flex-nowrap xl:overflow-x-auto xl:overflow-y-hidden xl:scroll-smooth xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden">
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
                      'flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-medium transition-all sm:px-3 sm:text-[13px]',
                      isActive
                        ? 'bg-[#56eda4] text-[#04261f] shadow-sm shadow-emerald-950/20'
                        : state === 'disabled'
                        ? 'cursor-not-allowed text-white/40'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    )}
                    onClick={(e) => state === 'disabled' && e.preventDefault()}
                  >
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </span>
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
                    'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors sm:w-auto',
                    isOverflowActive
                      ? 'border-emerald-200/30 bg-white/10 text-emerald-100'
                      : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                  )}
                  aria-label="Open more navigation"
                >
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
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
                          'gap-2.5',
                          state === 'disabled' && 'pointer-events-none opacity-45',
                          isActive && 'bg-accent text-accent-foreground'
                        )}
                        onSelect={(event) => {
                          event.preventDefault();
                          if (state === 'disabled') return;
                          navigate(item.path);
                        }}
                      >
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                          <Icon className="h-4 w-4" />
                        </span>
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
