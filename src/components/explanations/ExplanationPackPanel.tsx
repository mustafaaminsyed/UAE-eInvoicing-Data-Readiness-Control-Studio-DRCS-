import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSearch, Lightbulb, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Exception } from '@/types/compliance';
import { ValidationExplanation } from '@/types/validationExplain';

interface ExplanationPackPanelProps {
  explanation: ValidationExplanation | null;
  exception: Exception | null;
  isLoading?: boolean;
  errorMessage?: string | null;
}

function asPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ExplanationPackPanel({
  explanation,
  exception,
  isLoading = false,
  errorMessage,
}: ExplanationPackPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Generating explanation pack...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Select an exception to generate an explanation.
      </div>
    );
  }

  const pack = explanation.explanationPack || (explanation.sourceContext?.explanation_pack as ValidationExplanation['explanationPack']);

  if (!pack) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Validation Explanation</h3>
        </div>
        <p className="text-sm text-foreground">{explanation.explanation}</p>
        {explanation.recommendedFix && (
          <div className="rounded-md border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-3 text-sm text-[hsl(var(--success))]">
            Recommended fix: {explanation.recommendedFix}
          </div>
        )}
      </div>
    );
  }

  const mappingFallbackLink = exception?.field
    ? `/mapping?dataset=${encodeURIComponent(exception.datasetType || 'AR')}&field=${encodeURIComponent(exception.field)}`
    : '/mapping';

  const invoiceFallbackLink = exception?.invoiceId ? `/invoice/${encodeURIComponent(exception.invoiceId)}` : null;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            Explanation Pack
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Engine: {pack.engine.source} / {pack.engine.version}
            {pack.engine.promptVersion ? ` / ${pack.engine.promptVersion}` : ''}
          </p>
        </div>
        <Badge variant="outline">Confidence {asPercent(pack.confidence)}</Badge>
      </div>

      <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm">{pack.summary}</div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Why It Failed</p>
        <ul className="space-y-1">
          {pack.whyItFailed.map((item, idx) => (
            <li key={`${item}-${idx}`} className="text-sm text-foreground flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[hsl(var(--success))]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Likely Root Causes
        </p>
        <div className="space-y-2">
          {pack.likelyRootCauses.map((cause, idx) => (
            <div key={`${cause.cause}-${idx}`} className="rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  {cause.cause}
                </p>
                <Badge variant="secondary">{asPercent(cause.probability)}</Badge>
              </div>
              {cause.evidence.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {cause.evidence.map((evidenceItem, evidenceIdx) => (
                    <li
                      key={`${evidenceItem}-${evidenceIdx}`}
                      className="text-xs text-muted-foreground flex items-start gap-2"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 text-muted-foreground" />
                      <span>{evidenceItem}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
        Impact: {pack.impact}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fix Checklist</p>
        <div className="space-y-2">
          {pack.fixChecklist.map((fix, idx) => (
            <div key={`${fix.step}-${idx}`} className="rounded-md border border-border/70 p-3">
              <p className="text-sm font-medium flex items-start gap-2">
                <Wrench className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>{fix.step}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Owner: {fix.ownerHint}</p>
              {fix.linkToUI && (
                <Button asChild variant="outline" size="sm" className="mt-2 h-7 text-xs">
                  <Link to={fix.linkToUI}>Open Related UI</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
          <Link to={mappingFallbackLink}>Open Mapping Studio</Link>
        </Button>
        {invoiceFallbackLink && (
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to={invoiceFallbackLink}>Open Invoice Detail</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

