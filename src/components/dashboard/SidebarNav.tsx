import { Link, useLocation } from 'react-router-dom';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { WORKFLOW_SECTIONS } from '@/components/dashboard/workflowSections';
import { cn } from '@/lib/utils';

export function SidebarNav() {
  const location = useLocation();

  return (
    <>
      <SidebarHeader className="px-2.5 pb-2 pt-3">
        <div className="rounded-[22px] border border-sidebar-border/90 bg-sidebar-accent/70 p-3.5 text-sidebar-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55">
            Dariba Tech
          </p>
          <h2 className="mt-1.5 font-display text-[1.05rem] font-semibold">Controls Studio</h2>
          <p className="mt-1.5 text-xs leading-5 text-sidebar-foreground/68">
            Workflow navigation for the UAE eInvoicing compliance workspace.
          </p>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2.5">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKFLOW_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive =
                  location.pathname === section.path ||
                  location.pathname.startsWith(`${section.path}/`);

                return (
                  <SidebarMenuItem key={section.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={section.label}
                      className={cn(
                        'h-10 rounded-xl px-3 text-sidebar-foreground/82',
                        'data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[0_10px_22px_-18px_rgba(31,111,67,0.55)]'
                      )}
                    >
                      <Link to={section.path} aria-current={isActive ? 'page' : undefined}>
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{section.label}</span>
                        {section.placeholder ? (
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]',
                              isActive
                                ? 'border-sidebar-primary-foreground/20 bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground'
                                : 'border-sidebar-border bg-background/80 text-sidebar-foreground/60'
                            )}
                          >
                            Preview
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2.5 pb-3 pt-1.5">
        <div className="rounded-[20px] border border-sidebar-border/80 bg-background/55 p-3 text-[11px] leading-5 text-sidebar-foreground/60">
          Existing screens remain available while each workflow area is introduced in the shared shell.
        </div>
      </SidebarFooter>
    </>
  );
}
