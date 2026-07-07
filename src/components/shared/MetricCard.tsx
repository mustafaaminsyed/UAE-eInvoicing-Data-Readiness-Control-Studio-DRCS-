import { ReactNode } from 'react';
import { CircleHelp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  helpText?: string;
  helpContent?: ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  /**
   * Indicates the metric cannot be meaningfully calculated because the required
   * document population is absent from the current portfolio scope.
   */
  scopeAbsent?: boolean;
  /**
   * Explanatory tooltip shown on the neutral scope-absent info icon.
   */
  scopeAbsentTooltip?: string;
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

const scopeAbsentCardStyles = 'bg-muted/30 border-border/70';
const scopeAbsentIconStyles = 'bg-background/80 text-muted-foreground border border-border/70';

export function MetricCard({
  title,
  value,
  subtitle,
  helpText,
  helpContent,
  onClick,
  isActive = false,
  icon,
  variant = 'default',
  className,
  scopeAbsent = false,
  scopeAbsentTooltip,
}: MetricCardProps) {
  const interactive = Boolean(onClick);
  const resolvedHelpContent = helpContent ?? helpText;
  const displayValue = scopeAbsent ? '—' : value;
  const displaySubtitle = scopeAbsent ? 'Not in scope' : subtitle;
  const resolvedIcon = scopeAbsent ? <Info className="w-5 h-5" /> : icon;

  const iconNode = resolvedIcon ? (
    <div className={cn('rounded-lg p-3', scopeAbsent ? scopeAbsentIconStyles : iconStyles[variant])}>
      {resolvedIcon}
    </div>
  ) : null;

  const iconWithOptionalTooltip =
    scopeAbsent && iconNode ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={scopeAbsentTooltip ? `${title} scope explanation` : `${title} not in scope`}
            className="rounded-lg"
          >
            {iconNode}
          </button>
        </TooltipTrigger>
        {scopeAbsentTooltip ? (
          <TooltipContent className="max-w-[320px] text-xs leading-relaxed">
            {scopeAbsentTooltip}
          </TooltipContent>
        ) : null}
      </Tooltip>
    ) : (
      iconNode
    );

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'rounded-xl border p-6 shadow-sm transition-all duration-200 hover:shadow-md',
        interactive && 'cursor-pointer',
        interactive && isActive && 'ring-2 ring-primary/50 border-primary/40 shadow-md',
        scopeAbsent ? scopeAbsentCardStyles : variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <span>{title}</span>
            {resolvedHelpContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${title}`}
                    className="inline-flex items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[320px] text-xs leading-relaxed">
                  {resolvedHelpContent}
                </TooltipContent>
              </Tooltip>
            )}
          </p>
          <p className="text-3xl font-bold text-foreground">{displayValue}</p>
          {displaySubtitle ? <p className="text-sm text-muted-foreground">{displaySubtitle}</p> : null}
        </div>
        {iconWithOptionalTooltip}
      </div>
    </div>
  );
}
