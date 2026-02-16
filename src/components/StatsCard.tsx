import { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  helpText?: string;
  onClick?: () => void;
  isActive?: boolean;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantStyles = {
  default: 'bg-card',
  success: 'bg-success-bg border-success/20',
  warning: 'bg-severity-medium-bg border-severity-medium/20',
  danger: 'bg-severity-critical-bg border-severity-critical/20',
};

const iconStyles = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-severity-medium/10 text-severity-medium',
  danger: 'bg-severity-critical/10 text-severity-critical',
};

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  helpText,
  onClick,
  isActive = false,
  icon, 
  variant = 'default',
  className 
}: StatsCardProps) {
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
      className={cn(
        'rounded-xl border p-6 shadow-sm transition-all duration-200 hover:shadow-md',
        interactive && 'cursor-pointer',
        interactive && isActive && 'ring-2 ring-primary/50 border-primary/40 shadow-md',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <span>{title}</span>
            {helpText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${title}`}
                    className="inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors"
                  >
                    <CircleHelp className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
                  {helpText}
                </TooltipContent>
              </Tooltip>
            )}
          </p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={cn('p-3 rounded-lg', iconStyles[variant])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
