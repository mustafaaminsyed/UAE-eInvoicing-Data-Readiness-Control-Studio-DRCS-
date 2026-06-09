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
        <div className="workspace-shell mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
          <header className="surface-glass rounded-[28px] border border-border/70 px-4 py-3.5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.24)] md:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Controls Studio</span>
                  {section ? (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      <span>{section.eyebrow}</span>
                    </>
                  ) : null}
                </div>

                <div className="flex items-start gap-3">
                  <SidebarTrigger className="mt-0.5 h-8 w-8 rounded-lg border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted" />
                  <div className="space-y-1.5">
                    <h1 className="font-display text-[1.9rem] font-semibold tracking-tight text-foreground">
                      {section?.label ?? 'Controls Studio'}
                    </h1>
                    <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                      {section?.description ??
                        'Shared workspace framing for the Controls Studio routes and future workflow views.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold',
                    section?.placeholder
                      ? 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
                      : 'border-primary/15 bg-primary/10 text-primary'
                  )}
                >
                  {section?.status ?? 'Shared route'}
                </span>
              </div>
            </div>
          </header>

          <section className="min-w-0 flex-1">
            <Outlet />
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
