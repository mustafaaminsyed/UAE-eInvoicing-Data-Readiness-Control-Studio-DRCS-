import { Badge } from '@/components/ui/badge';
import { DatasetType } from '@/types/datasets';

type LastRunContextBannerProps = {
  lastChecksRunAt: string | null;
  datasetType: DatasetType;
  exceptionsCount: number;
  showWhenEmpty?: boolean;
};

function formatRunTime(iso: string | null): string {
  if (!iso) return 'n/a';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function inferScenarioHint(exceptionsCount: number): string {
  if (exceptionsCount === 0) return 'Likely positive/canonical sample';
  return 'Likely negative or non-conformant sample';
}

export function LastRunContextBanner({
  lastChecksRunAt,
  datasetType,
  exceptionsCount,
  showWhenEmpty = false,
}: LastRunContextBannerProps) {
  if (!lastChecksRunAt && !showWhenEmpty) return null;

  return (
    <div className="mb-6 rounded-xl border border-white/70 bg-muted/30 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">Last run context:</span>
        <Badge variant="outline">{datasetType === 'AR' ? 'Outbound (AR)' : 'Inbound (AP)'}</Badge>
        <span className="text-muted-foreground">{formatRunTime(lastChecksRunAt)}</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">{inferScenarioHint(exceptionsCount)}</span>
      </div>
    </div>
  );
}

