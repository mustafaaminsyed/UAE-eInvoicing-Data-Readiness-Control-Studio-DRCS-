import { Outlet } from 'react-router-dom';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export function WorkspaceShell() {
  return (
    <div className="relative z-10 px-4 md:px-6 py-4 md:py-6">
      <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)] gap-6">
        <div className="hidden xl:block sticky top-20 self-start">
          <SidebarNav />
        </div>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

