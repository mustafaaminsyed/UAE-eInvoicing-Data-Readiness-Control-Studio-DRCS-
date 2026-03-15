import { Outlet } from 'react-router-dom';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export function WorkspaceShell() {
  return (
    <div className="workspace-shell relative z-10 mx-auto w-full max-w-[1680px] px-4 py-4 md:px-6 md:py-6">
      <div className="grid items-start gap-5 lg:gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <div className="lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pr-1">
            <SidebarNav />
          </div>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

