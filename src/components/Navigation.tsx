import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { Switch } from '@/components/ui/switch';
import daribaLogo from '@/assets/brand/dariba-drcs-light-lockup.png';

function NavigationContent() {
  const { activeDatasetType, isDataLoaded, isChecksRun } = useCompliance();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeLabel = useMemo(() => {
    if (!mounted) return 'Theme preference';
    return isDark ? 'Dark mode enabled' : 'Light mode enabled';
  }, [isDark, mounted]);

  const workspaceState = isChecksRun ? 'Assessment complete' : isDataLoaded ? 'Data loaded' : 'Awaiting data';

  return (
    <header className="app-topbar relative z-40 w-full border-b border-white/15 bg-[#062d27] text-white shadow-sm sm:sticky sm:top-0">
      <div className="mx-auto flex h-14 w-full max-w-[1920px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Dariba DRCS home">
            <img src={daribaLogo} alt="" className="h-8 w-[108px] object-contain object-left sm:w-[118px]" />
          </Link>
          <span className="hidden h-7 w-px bg-white/20 sm:block" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white sm:text-sm">UAE e-Invoicing</p>
            <p className="hidden truncate text-[10px] uppercase tracking-[0.12em] text-emerald-50/60 sm:block">Data Readiness Control Studio</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" aria-label="Operational workspace status">
          <span className="hidden rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-emerald-50/80 sm:inline-flex">
            {activeDatasetType === 'AR' ? 'AR / Outbound' : 'AP / Inbound'}
          </span>
          <span className="hidden rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-emerald-50/70 md:inline-flex">
            {workspaceState}
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2 py-1">
            <Sun className={cn('h-3.5 w-3.5', !isDark ? 'text-amber-300' : 'text-white/45')} aria-hidden="true" />
            <Switch
              checked={mounted ? isDark : false}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              aria-label={themeLabel}
            />
            <Moon className={cn('h-3.5 w-3.5', isDark ? 'text-sky-300' : 'text-white/45')} aria-hidden="true" />
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
