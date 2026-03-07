import { Outlet } from 'react-router-dom';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export function WorkspaceShell() {
  return (
    <div className="relative z-10 px-4 md:px-6 py-4 md:py-6">
      <div
        className="pointer-events-none absolute hidden xl:block top-0 bottom-0 left-0 w-[332px] rounded-r-2xl"
        style={{
          background:
            'linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background) / 0.96) 72%, hsl(var(--background) / 0.72) 100%)',
        }}
        aria-hidden="true"
      />
      <div className="relative grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)] gap-6">
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

