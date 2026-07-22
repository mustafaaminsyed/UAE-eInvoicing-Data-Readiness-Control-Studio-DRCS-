import { ArrowLeft, BarChart3, LayoutDashboard, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type WorkflowView =
  | 'upload'
  | 'mapping'
  | 'run'
  | 'validation'
  | 'dashboard'
  | 'exceptions'
  | 'controls'
  | 'traceability'
  | 'evidence';

interface WorkflowNavItem {
  id: WorkflowView;
  label: string;
  path: string;
  icon?: LucideIcon;
}

interface WorkflowNavigatorProps {
  current: WorkflowView;
  fallbackPath: string;
  items?: WorkflowNavItem[];
  helperText?: string;
  className?: string;
}

const WORKFLOW_ORDER: WorkflowView[] = [
  'upload',
  'mapping',
  'run',
  'validation',
  'dashboard',
  'exceptions',
  'controls',
  'traceability',
  'evidence',
];

const WORKFLOW_LINKS: Record<WorkflowView, WorkflowNavItem> = {
  upload: { id: 'upload', label: 'Upload', path: '/upload' },
  mapping: { id: 'mapping', label: 'Mapping', path: '/mapping' },
  run: { id: 'run', label: 'Run Checks', path: '/run' },
  validation: { id: 'validation', label: 'Validation', path: '/validation' },
  dashboard: { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  exceptions: { id: 'exceptions', label: 'Exceptions', path: '/exceptions', icon: ShieldAlert },
  controls: { id: 'controls', label: 'Controls Studio', path: '/controls', icon: BarChart3 },
  traceability: { id: 'traceability', label: 'Traceability', path: '/traceability' },
  evidence: { id: 'evidence', label: 'Evidence', path: '/evidence' },
};

export function buildWorkflowItems(ids: WorkflowView[]): WorkflowNavItem[] {
  const uniqueIds = Array.from(new Set(ids));
  return WORKFLOW_ORDER.filter((id) => uniqueIds.includes(id)).map((id) => WORKFLOW_LINKS[id]);
}

const DEFAULT_WORKFLOW_LINKS = buildWorkflowItems(['dashboard', 'exceptions', 'controls']);

export function WorkflowNavigator({
  current,
  fallbackPath,
  items,
  helperText = 'Move between readiness, exception, and controls views without losing workflow context.',
  className,
}: WorkflowNavigatorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationItems = items ?? DEFAULT_WORKFLOW_LINKS;

  const handleBack = () => {
    if (typeof window !== 'undefined' && typeof window.history?.state?.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath);
  };

  return (
      <div
        className={cn(
        'flex flex-col gap-2 rounded-[22px] border border-border/65 bg-background/78 px-3 py-2 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-fit gap-1.5 rounded-full px-3 text-[11px] font-medium sm:text-xs"
          onClick={handleBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <span className="max-w-2xl text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
          {helperText}
        </span>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 lg:mx-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === current || location.pathname === item.path;

          return (
            <Button
              key={item.id}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="h-8 shrink-0 gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium sm:px-3 sm:text-xs"
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon ? <Icon className="hidden h-3.5 w-3.5 sm:block" /> : null}
              {item.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
