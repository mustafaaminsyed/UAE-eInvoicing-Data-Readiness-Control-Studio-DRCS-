import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  READINESS_BANDS,
  getComplianceRadarDimensionDefinition,
  type ReadinessBand,
} from '@/lib/analytics/complianceRadar';
import { getReadinessBandLabel } from '@/lib/analytics/entityRiskMatrix';
import type {
  EntityRiskMatrixCell,
  EntityRiskMatrixFilters,
  EntityRiskMatrixFocus,
  EntityRiskMatrixResult,
  EntityRiskMatrixRow,
} from '@/types/entityRiskMatrix';

interface EntityRiskMatrixHeatmapProps {
  result: EntityRiskMatrixResult;
  rows: EntityRiskMatrixRow[];
  filters: EntityRiskMatrixFilters;
  onFiltersChange: (filters: EntityRiskMatrixFilters) => void;
  onCellClick: (focus: EntityRiskMatrixFocus) => void;
}

function getBandClasses(band: ReadinessBand): { cell: string; badge: string; dot: string } {
  if (band === 'controlled') {
    return {
      cell: 'bg-success/15 text-success border-success/30 hover:bg-success/20',
      badge: 'border-success/40 bg-success-bg/60 text-success',
      dot: 'bg-success',
    };
  }
  if (band === 'watch') {
    return {
      cell: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30 hover:bg-severity-medium/20',
      badge: 'border-severity-medium/40 bg-severity-medium-bg/60 text-severity-medium',
      dot: 'bg-severity-medium',
    };
  }
  if (band === 'exposed') {
    return {
      cell: 'bg-severity-high/15 text-severity-high border-severity-high/30 hover:bg-severity-high/20',
      badge: 'border-severity-high/40 bg-severity-high-bg/60 text-severity-high',
      dot: 'bg-severity-high',
    };
  }
  return {
    cell: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30 hover:bg-severity-critical/20',
    badge: 'border-severity-critical/40 bg-severity-critical-bg/60 text-severity-critical',
    dot: 'bg-severity-critical',
  };
}

function MatrixTooltip({ row, cell }: { row: EntityRiskMatrixRow; cell: EntityRiskMatrixCell }) {
  const bandLabel = getReadinessBandLabel(cell.band);
  return (
    <div className="max-w-64 rounded-lg border border-border/70 bg-background/95 px-3 py-2 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">{row.entityName}</p>
          <p className="text-[11px] text-muted-foreground">{row.entityId}</p>
        </div>
        <Badge variant="outline" className={cn('capitalize', getBandClasses(cell.band).badge)}>
          {bandLabel}
        </Badge>
      </div>
      <p className="mt-2 text-xs font-medium text-foreground">
        {resultDimensionLabel(row, cell)}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">
        {cell.score.toFixed(0)}
        {cell.isApproximation ? <span className="ml-1 text-xs text-muted-foreground">~</span> : null}
      </p>
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <p>Invoices: {cell.invoiceCount.toLocaleString('en-US')}</p>
        <p>
          Exceptions: {cell.exceptionCount} | Critical: {cell.criticalCount}
        </p>
        <p>{cell.drillDownMode === 'precise' ? 'Direct signal mapping' : 'Context-guided drill-down'}</p>
        {cell.isApproximation ? <p>Estimated from related seller-level signals.</p> : null}
        {cell.sampleSizeWarning ? <p>Low invoice volume. Treat with caution.</p> : null}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{cell.explanation}</p>
    </div>
  );
}

function resultDimensionLabel(_: EntityRiskMatrixRow, cell: EntityRiskMatrixCell): string {
  return getComplianceRadarDimensionDefinition(cell.dimension).label;
}

export default function EntityRiskMatrixHeatmap({
  result,
  rows,
  filters,
  onFiltersChange,
  onCellClick,
}: EntityRiskMatrixHeatmapProps) {
  return (
    <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-5 animate-slide-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Entity Risk Matrix</h3>
          <p className="text-sm text-muted-foreground">
            Seller-level control heatmap across the six readiness dimensions.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {rows.length} visible of {result.rows.length} sellers
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                search: event.target.value,
              })
            }
            className="h-9 pl-9"
            placeholder="Search seller or TRN"
          />
        </div>

        <Select
          value={filters.sortBy}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              sortBy: value as EntityRiskMatrixFilters['sortBy'],
            })
          }
        >
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lowest_score">Lowest score</SelectItem>
            <SelectItem value="average_score">Average score</SelectItem>
            <SelectItem value="exception_count">Exception count</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(filters.rowLimit)}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              rowLimit: Number(value),
            })
          }
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="25">Top 25</SelectItem>
            <SelectItem value="50">Top 50</SelectItem>
          </SelectContent>
        </Select>

        <label className="ml-auto flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
          <Switch
            checked={filters.elevatedRiskOnly}
            onCheckedChange={(checked) =>
              onFiltersChange({
                ...filters,
                elevatedRiskOnly: checked,
              })
            }
          />
          Critical/Exposed only
        </label>
      </div>

      <div className="mt-4">
        <ScrollArea className="w-full rounded-xl border border-border/60">
          <div className="min-w-[980px]">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-[240px] border-b border-r bg-background/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                    Seller / Legal Entity
                  </th>
                  {result.dimensions.map((dimension) => (
                    <th
                      key={dimension.key}
                      className="sticky top-0 z-10 min-w-[120px] border-b bg-background/95 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur"
                    >
                      <span className="block leading-tight">{dimension.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={result.dimensions.length + 1}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No sellers match the current heatmap filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.entityId} className="group">
                      <td className="sticky left-0 z-10 border-b border-r bg-background/95 px-4 py-3 align-middle backdrop-blur">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{row.entityName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{row.entityId}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {row.invoiceCount.toLocaleString('en-US')} invoices | {row.totalExceptions} exceptions
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('shrink-0', getBandClasses(row.overallBand).badge)}
                          >
                            {getReadinessBandLabel(row.overallBand)}
                          </Badge>
                        </div>
                      </td>
                      {row.cells.map((cell) => {
                        const classes = getBandClasses(cell.band);
                        return (
                          <td key={cell.dimension} className="border-b px-2 py-2 text-center">
                            <TooltipProvider delayDuration={80}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onCellClick({
                                        entityId: row.entityId,
                                        entityName: row.entityName,
                                        dimension: cell.dimension,
                                        drillDownMode: cell.drillDownMode,
                                      })
                                    }
                                    className={cn(
                                      'mx-auto flex min-h-[56px] w-full max-w-[108px] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors',
                                      classes.cell,
                                      cell.isApproximation && 'border-dashed'
                                    )}
                                  >
                                    <span className="text-base font-semibold leading-none">
                                      {cell.score.toFixed(0)}
                                      {cell.isApproximation ? (
                                        <span className="ml-0.5 align-top text-[10px] text-muted-foreground">~</span>
                                      ) : null}
                                    </span>
                                    <span className="mt-1 text-[10px] uppercase tracking-wide opacity-80">
                                      {getReadinessBandLabel(cell.band)}
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="border-none bg-transparent p-0 shadow-none">
                                  <MatrixTooltip row={row} cell={cell} />
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          {READINESS_BANDS.map((band) => (
            <div key={band.key} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-full', getBandClasses(band.key).dot)} />
              <span>
                {band.label} {band.key === 'critical' ? '<60' : band.key === 'exposed' ? '60-74' : band.key === 'watch' ? '75-89' : '90+'}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>~ estimated seller signal</span>
          <span>Low-volume sellers are stabilized conservatively</span>
        </div>
      </div>
    </div>
  );
}
