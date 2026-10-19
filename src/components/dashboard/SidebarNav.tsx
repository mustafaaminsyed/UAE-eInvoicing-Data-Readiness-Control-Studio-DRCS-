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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  getVisibleOperationalNavigation,
  isNavigationRestricted,
  NAVIGATION_GROUP_ORDER,
} from '@/components/dashboard/operationalNavigation';
import { useCompliance } from '@/context/ComplianceContext';
import { FEATURE_FLAGS } from '@/config/features';
import { cn } from '@/lib/utils';
import daribaLockup from '@/assets/brand/dariba-drcs-light-lockup.png';

export function SidebarNav() {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { isDataLoaded, isChecksRun } = useCompliance();
  const sections = getVisibleOperationalNavigation(FEATURE_FLAGS.casesMenu);

  const groups = NAVIGATION_GROUP_ORDER.map((label) => ({
    label,
    items: sections.filter((section) => section.group === label),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <SidebarHeader className={cn('px-3 pb-2 pt-3', isMobile && 'min-h-16 justify-center bg-[#062d27] pr-16')}>
        <div className="flex items-center gap-3 px-1 text-sidebar-foreground">
          <img src={daribaLockup} alt="Dariba DRCS" className="h-9 w-28 shrink-0 object-contain object-left" />
          <div className={cn('min-w-0 group-data-[collapsible=icon]:hidden', isMobile && 'hidden')}>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/65">Control Studio</p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">Operational workspace</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-1.5">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="p-0 pb-1">
            <SidebarGroupLabel className="h-6 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((section) => {
                  const Icon = section.icon;
                  const isActive =
                    location.pathname === section.path ||
                    location.pathname.startsWith(`${section.path}/`) ||
                    (section.path === '/data-twin' && location.pathname.startsWith('/invoice/'));
                  const restricted = isNavigationRestricted(section.path, isDataLoaded, isChecksRun);

                  return (
                    <SidebarMenuItem key={section.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={section.label}
                        className={cn(
                          'h-[30px] rounded-lg px-3 text-[13px] text-sidebar-foreground/78',
                          'data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground',
                          restricted && 'cursor-not-allowed opacity-45'
                        )}
                      >
                        <Link
                          to={section.path}
                          aria-current={isActive ? 'page' : undefined}
                          aria-disabled={restricted || undefined}
                          onClick={(event) => {
                            if (restricted) {
                              event.preventDefault();
                              return;
                            }
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1 truncate">{section.label}</span>
                          {section.placeholder ? (
                            <span className="rounded-full border border-sidebar-border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55">
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
        ))}
      </SidebarContent>

      <SidebarFooter className="hidden border-t border-sidebar-border/70 px-3 py-2 group-data-[collapsible=icon]:hidden lg:flex">
        <p className="truncate text-[10px] font-medium text-sidebar-foreground/50">UAE / PINT-AE readiness workspace</p>
      </SidebarFooter>
    </>
  );
}
