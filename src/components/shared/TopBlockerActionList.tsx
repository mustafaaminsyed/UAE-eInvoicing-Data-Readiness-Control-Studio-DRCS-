import { ArrowRight } from 'lucide-react';
import { SeverityBadge } from '@/components/SeverityBadge';
import type { Severity } from '@/types/compliance';

export interface TopBlockerActionItem {
  rank: number;
  label: string;
  severity: 'critical' | 'high' | 'medium';
  count: number;
  ruleId: string;
}

export interface TopBlockerActionListProps {
  /**
   * Ranked blocking checks to display as navigable remediation actions.
   */
  blockers: TopBlockerActionItem[];
  /**
   * Total number of critical outcomes in the current scope, used to calculate
   * the share covered by the listed blockers.
   */
  totalCriticalOutcomes: number;
  /**
   * Called when a user selects a blocker remediation action.
   */
  onBlockerClick: (ruleId: string) => void;
}

const severityMap: Record<TopBlockerActionItem['severity'], Severity> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
};

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)));
}

export function TopBlockerActionList({
  blockers,
  totalCriticalOutcomes,
  onBlockerClick,
}: TopBlockerActionListProps) {
  const resolvedOutcomes = blockers.reduce((sum, blocker) => sum + blocker.count, 0);
  const percentage =
    totalCriticalOutcomes > 0 ? Math.round((resolvedOutcomes / totalCriticalOutcomes) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {blockers.map((blocker) => (
          <div
            key={blocker.ruleId}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/75 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-border/70 bg-background text-xs font-semibold text-muted-foreground">
                {blocker.rank}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{blocker.label}</p>
                  <SeverityBadge severity={severityMap[blocker.severity]} />
                  <span className="text-sm text-muted-foreground">· {formatCount(blocker.count)} invoices</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onBlockerClick(blocker.ruleId)}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              <span>Fix this</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        Fixing these {formatCount(blockers.length)} checks would resolve approx. {formatCount(resolvedOutcomes)}{' '}
        blocking outcomes — {percentage}% of total critical exceptions.
      </p>
    </div>
  );
}
