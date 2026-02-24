import { Severity } from '@/types/compliance';
import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const severityStyles: Record<Severity, string> = {
  Critical: 'bg-severity-critical-bg text-severity-critical border border-severity-critical/30',
  High: 'bg-severity-high-bg text-severity-high border border-severity-high/30',
  Medium: 'bg-severity-medium-bg text-severity-medium border border-severity-medium/30',
  Low: 'bg-severity-low-bg text-severity-low border border-severity-low/30',
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        severityStyles[severity],
        className
      )}
    >
      {severity}
    </span>
  );
}
