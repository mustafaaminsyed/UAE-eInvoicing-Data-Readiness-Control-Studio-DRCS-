import { ChevronRight } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarNav } from '@/components/dashboard/SidebarNav';
import { getWorkflowSection } from '@/components/dashboard/workflowSections';
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function WorkspaceShell() {
  const location = useLocation();
  const section = getWorkflowSection(location.pathname);

  return (
    <SidebarProvider defaultOpen className="relative z-10">
      <Sidebar
        side="left"
        variant="inset"
        collapsible="icon"
        className="top-16 h-[calc(100svh-4rem)] border-r-0 bg-transparent p-2.5"
      >
        <SidebarNav />
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-transparent shadow-none">
        <div className="workspace-shell mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-5 px-4 py-4 md:px-6 md:py-5">
          <header className="surface-glass rounded-[var(--surface-radius-lg)] border border-border/70 px-4 py-3 md:px-5 md:py-3.5">
            {section ? (
              <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Controls Studio</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{section.eyebrow}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <SidebarTrigger className="mt-0.5 h-9 w-9 rounded-xl border border-border/70 bg-background/90 text-muted-foreground hover:bg-muted" />
                    <div className="min-w-0">
                      <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-foreground">
                        {section.label}
                      </h1>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </div>

                <span
                  className={cn(
                    'w-fit rounded-full border px-3.5 py-1.5 text-[12px] font-semibold shadow-sm',
                    section.placeholder
                      ? 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
                      : 'border-primary/15 bg-primary/10 text-primary'
                  )}
                >
                  {section.status}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SidebarTrigger className="h-9 w-9 rounded-xl border border-border/70 bg-background/90 text-muted-foreground hover:bg-muted" />
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] font-medium text-muted-foreground">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Controls Studio</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>Shared workspace route</span>
                  </div>
                </div>
                <span className="rounded-full border border-border/70 bg-background/75 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground">
                  Shared route
                </span>
              </div>
            )}
          </header>

          <section className="min-w-0 flex-1">
            <Outlet />
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
