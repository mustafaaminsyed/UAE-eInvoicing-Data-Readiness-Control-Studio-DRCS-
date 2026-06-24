import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ReadinessMethodologyDimension {
  label: string;
  weight: number;
  score: number;
}

export interface ReadinessMethodologyTooltipProps {
  /**
   * Controls which readiness methodology explanation is rendered.
   */
  type: 'go-live' | 'compliance';
  /**
   * Optional weighted dimensions shown in the tooltip body.
   */
  dimensions?: ReadinessMethodologyDimension[];
  /**
   * Trigger element for the tooltip, typically the readiness figure itself.
   */
  children: ReactNode;
}

function normalizeWeight(weight: number) {
  return weight > 1 ? weight / 100 : weight;
}

function formatWeight(weight: number) {
  const normalized = normalizeWeight(weight) * 100;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
}

function formatScore(score: number) {
  return `${score.toFixed(score % 1 === 0 ? 0 : 1)}%`;
}

function formatContribution(weight: number, score: number) {
  const contribution = normalizeWeight(weight) * score;
  return `${contribution.toFixed(contribution % 1 === 0 ? 0 : 1)}%`;
}

export function ReadinessMethodologyTooltip({
  type,
  dimensions = [],
  children,
}: ReadinessMethodologyTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[360px] p-0">
        <div className="space-y-3 p-4">
          {type === 'go-live' ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Go-Live Readiness methodology</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Weighted readiness dimensions are combined into a single score before critical blocker pressure is applied.
                </p>
              </div>
              <div className="overflow-hidden rounded-md border border-border/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Label</th>
                      <th className="px-3 py-2 font-medium">Weight</th>
                      <th className="px-3 py-2 font-medium">Score</th>
                      <th className="px-3 py-2 font-medium">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dimension) => (
                      <tr key={dimension.label} className="border-t border-border/70">
                        <td className="px-3 py-2 text-foreground">{dimension.label}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatWeight(dimension.weight)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatScore(dimension.score)}</td>
                        <td className="px-3 py-2 text-foreground">{formatContribution(dimension.weight, dimension.score)}</td>
                      </tr>
                    ))}
                    {dimensions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-muted-foreground">
                          No dimensions provided.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Go-Live Readiness applies a 20% penalty for active critical blockers
              </p>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Compliance Readiness methodology</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Weighted data quality and rule readiness — excludes the critical blocker penalty
                </p>
              </div>
              <div className="space-y-2">
                {dimensions.length > 0 ? (
                  dimensions.map((dimension) => (
                    <div
                      key={dimension.label}
                      className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-foreground">{dimension.label}</span>
                      <span className="text-muted-foreground">
                        {formatWeight(dimension.weight)} · {formatScore(dimension.score)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No dimensions provided.</p>
                )}
              </div>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
