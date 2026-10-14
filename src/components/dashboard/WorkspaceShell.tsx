import { ChevronRight } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarNav } from '@/components/dashboard/SidebarNav';
import { getWorkflowSection } from '@/components/dashboard/workflowSections';
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import './workspace-shell.css';

export function WorkspaceShell() {
  const location = useLocation();
  const section = getWorkflowSection(location.pathname);

  return (
    <SidebarProvider defaultOpen className="workspace-control-shell relative z-10 min-h-svh">
      <Sidebar
        side="left"
        variant="inset"
        collapsible="icon"
        className="top-0 h-svh border-r border-white/10 bg-[#08231e] p-0"
      >
        <SidebarNav />
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent shadow-none">
        <div className="workspace-shell mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-3 px-3 py-3 md:px-5 md:py-4">
          <header className="workspace-shell-page-header rounded-xl px-3.5 py-2.5 md:px-4">
            {section ? (
              <div className="workspace-shell-header flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <SidebarTrigger className="h-8 w-8 shrink-0 rounded-lg border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground" />
                  <div className="min-w-0">
                    <div className="workspace-shell-context flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>DRCS Control Centre</span>
                      <ChevronRight className="h-3 w-3" />
                      <span>{section.eyebrow}</span>
                    </div>
                    <h1 className="mt-0.5 truncate font-display text-lg font-semibold tracking-tight text-foreground">
                      {section.label}
                    </h1>
                  </div>
                </div>

                <div className="workspace-shell-badges flex items-center gap-2">
                  <span className="workspace-shell-badge workspace-shell-badge--muted">AR</span>
                  <span className="workspace-shell-badge workspace-shell-badge--muted">Portfolio view</span>
                  <span className={cn(
                    'workspace-shell-badge',
                    section.placeholder
                      ? 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
                      : 'border-primary/15 bg-primary/10 text-primary'
                  )}>
                    {section.status === 'Live' ? 'Assessment pending' : section.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="workspace-shell-header flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SidebarTrigger className="h-9 w-9 rounded-xl border border-border/70 bg-background/90 text-muted-foreground hover:bg-muted" />
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] font-medium text-muted-foreground">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Controls Studio</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>Shared workspace route</span>
                  </div>
                </div>
                <span className="workspace-shell-badge workspace-shell-badge--muted">Shared route</span>
              </div>
            )}
          </header>

          <section className="min-w-0 flex-1 overflow-x-clip">
            <Outlet />
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
