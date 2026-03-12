import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  ComplianceRadarAxisKey,
  ComplianceRadarResult,
} from '@/lib/analytics/complianceRadar';

interface ComplianceRadarProps {
  result: ComplianceRadarResult;
  title?: string;
  onDimensionClick?: (axis: ComplianceRadarAxisKey) => void;
}

interface ChartDatum {
  key: ComplianceRadarAxisKey;
  subject: string;
  score: number;
  explanation: string;
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const datum = payload[0].payload;

  return (
    <div className="rounded-lg border border-border/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-semibold text-foreground">{datum.subject}</p>
      <p className="mt-1 text-lg font-bold text-primary">{datum.score.toFixed(1)}%</p>
      <p className="mt-1 max-w-56 text-xs text-muted-foreground">{datum.explanation}</p>
    </div>
  );
}

export default function ComplianceRadar({
  result,
  title = 'Compliance Maturity Profile',
  onDimensionClick,
}: ComplianceRadarProps) {
  const chartData: ChartDatum[] = result.dimensions.map((dimension) => ({
    key: dimension.key,
    subject: dimension.label,
    score: dimension.score,
    explanation: dimension.explanation,
  }));

  const byLabel = new Map(chartData.map((datum) => [datum.subject, datum]));

  if (result.isFallback) {
    return (
      <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6 animate-slide-up">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No runtime signals are available yet. Run checks to generate a compliance maturity profile.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6 animate-slide-up">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Visual readiness snapshot across six control dimensions (0-100 scale).
          </p>
        </div>
        <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall Radar Score</p>
          <p className="text-2xl font-bold text-primary">{result.overallScore.toFixed(1)}%</p>
        </div>
      </div>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="68%">
            <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.35} />
            <PolarAngleAxis
              dataKey="subject"
              tick={(props: any) => {
                const datum = byLabel.get(props.payload?.value);
                const clickable = Boolean(datum && onDimensionClick);
                return (
                  <text
                    x={props.x}
                    y={props.y}
                    dy={4}
                    textAnchor="middle"
                    className={cn(
                      'fill-muted-foreground text-[11px]',
                      clickable && 'cursor-pointer hover:fill-foreground'
                    )}
                    onClick={() => {
                      if (datum && onDimensionClick) onDimensionClick(datum.key);
                    }}
                  >
                    {props.payload?.value}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={6}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
            />
            <Tooltip content={<RadarTooltip />} />
            <Radar
              dataKey="score"
              name="Readiness"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Higher values indicate stronger control maturity. Click a dimension label for drill-down routing (placeholder).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {chartData.map((dimension) => (
          <button
            key={dimension.key}
            type="button"
            onClick={() => onDimensionClick?.(dimension.key)}
            className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            {dimension.subject}: {dimension.score.toFixed(0)}%
          </button>
        ))}
      </div>
    </div>
  );
}
