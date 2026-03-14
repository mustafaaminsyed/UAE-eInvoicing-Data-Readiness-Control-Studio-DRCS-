import { Outlet } from 'react-router-dom';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export function WorkspaceShell() {
  return (
    <div className="workspace-shell relative z-10 mx-auto w-full max-w-[1680px] px-4 py-4 md:px-6 md:py-6">
      <div className="lg:hidden space-y-5">
        <section className="min-w-0">
          <SidebarNav />
        </section>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>

      <div className="hidden lg:grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <div className="sticky top-[5.25rem] max-h-[calc(100vh-6.5rem)] overflow-y-auto pr-1">
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

