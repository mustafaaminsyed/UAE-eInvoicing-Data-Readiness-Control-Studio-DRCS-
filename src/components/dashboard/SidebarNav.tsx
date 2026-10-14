import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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
import daribaLockup from '@/assets/brand/dariba-drcs-light-lockup.png';

export function SidebarNav() {
  const location = useLocation();

  const groups = [
    {
      label: 'Control Centre',
      items: WORKFLOW_SECTIONS.filter((section) => section.label === 'Dashboard'),
    },
    {
      label: 'Data',
      items: WORKFLOW_SECTIONS.filter((section) => ['Submissions', 'Data Twin'].includes(section.label)),
    },
    {
      label: 'Controls',
      items: WORKFLOW_SECTIONS.filter((section) => ['Validation', 'Exceptions', 'Evidence'].includes(section.label)),
    },
    {
      label: 'Analytics',
      items: WORKFLOW_SECTIONS.filter((section) => section.label === 'Analytics'),
    },
    {
      label: 'Administration',
      items: WORKFLOW_SECTIONS.filter((section) => section.label === 'Settings'),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      <SidebarHeader className="px-3 pb-3 pt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 text-sidebar-foreground">
          <img src={daribaLockup} alt="Dariba DRCS" className="h-11 w-auto max-w-full object-contain object-left" />
          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.17em] text-emerald-100/48">
            UAE e-Invoicing Data Readiness
          </p>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2.5">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((section) => {
                  const Icon = section.icon;
                  const isActive =
                    location.pathname === section.path ||
                    location.pathname.startsWith(`${section.path}/`) ||
                    (section.path === '/data-twin' && location.pathname.startsWith('/invoice/'));

                  return (
                    <Fragment key={section.path}>
                      <SidebarMenuItem>
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
                      {section.shortcuts?.map((shortcut) => {
                        const shortcutIsActive = location.pathname === shortcut.path;
                        return (
                          <SidebarMenuItem key={shortcut.path}>
                            <SidebarMenuButton
                              asChild
                              size="sm"
                              isActive={shortcutIsActive}
                              tooltip={shortcut.label}
                              className={cn(
                                'ml-2 h-8 rounded-lg pl-4 text-xs text-sidebar-foreground/65',
                                'data-[active=true]:bg-sidebar-primary/20 data-[active=true]:text-emerald-100'
                              )}
                            >
                              <Link to={shortcut.path} aria-current={shortcutIsActive ? 'page' : undefined}>
                                <ChevronRight className="h-3 w-3" />
                                <span>{shortcut.label}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-2.5 pb-3 pt-1.5">
        <div className="rounded-[18px] border border-sidebar-border/80 bg-background/55 p-2.5 text-[11px] leading-5 text-sidebar-foreground/60">
          <span className="font-semibold text-emerald-300">DRCS workspace</span><br />
          Deterministic readiness, validation and evidence.
        </div>
      </SidebarFooter>
    </>
  );
}
