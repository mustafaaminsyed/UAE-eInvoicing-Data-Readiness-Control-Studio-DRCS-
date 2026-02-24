import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';
import { CONFORMANCE_CONFIG } from '@/config/conformance';
import { cn } from '@/lib/utils';

export default function EvidencePage() {
  const { rows, gaps, specVersion } = useMemo(() => computeTraceabilityMatrix([]), []);
  const mandatoryMapped = rows.filter((r) => r.mandatory && r.inTemplate).length;
  const mandatoryTotal = rows.filter((r) => r.mandatory).length;
  const coveredCount = rows.filter((r) => r.coverageStatus === 'COVERED').length;

  const topGaps = useMemo(() => {
    const gapRows = rows.filter((r) =>
      (r.mandatory && !r.inTemplate) ||
      (r.populationPct !== null && r.populationPct < CONFORMANCE_CONFIG.populationWarningThreshold) ||
      r.ruleIds.length === 0
    );
    return gapRows.slice(0, CONFORMANCE_CONFIG.evidencePackTopGaps);
  }, [rows]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-4xl py-10 md:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <FileDown className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground mb-2">Evidence Pack</h1>
          <p className="text-muted-foreground">
            Generate and export compliance evidence packs for audit and regulatory review.
          </p>
        </div>

        <Card className="surface-glass rounded-2xl border border-white/70 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-primary" />
                Conformance & Traceability
              </CardTitle>
              <Badge variant="outline" className="text-xs">{specVersion}</Badge>
            </div>
            <CardDescription>
              Summary of UAE PINT-AE data requirement coverage and rule mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{gaps.totalDRs}</p>
                <p className="text-xs text-muted-foreground">Total DRs</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{mandatoryMapped}/{mandatoryTotal}</p>
                <p className="text-xs text-muted-foreground">Mandatory Mapped</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className={cn('text-2xl font-bold', coveredCount === gaps.totalDRs ? 'text-[hsl(var(--success))]' : 'text-accent-foreground')}>
                  {coveredCount}
                </p>
                <p className="text-xs text-muted-foreground">Fully Covered</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className={cn('text-2xl font-bold', gaps.mandatoryLowPopulation > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]')}>
                  {gaps.mandatoryLowPopulation}
                </p>
                <p className="text-xs text-muted-foreground">Low Population</p>
              </div>
            </div>

            {topGaps.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Top Gaps</h4>
                <div className="divide-y border rounded-lg">
                  {topGaps.map((gap) => (
                    <div key={gap.dr_id} className="flex items-center justify-between p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-primary">{gap.dr_id}</code>
                        <span className="text-foreground">{gap.business_term}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!gap.inTemplate && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            <XCircle className="w-3 h-3 mr-1" /> Not in template
                          </Badge>
                        )}
                        {gap.ruleIds.length === 0 && (
                          <Badge variant="outline" className="text-xs text-accent-foreground border-accent/30">
                            <AlertTriangle className="w-3 h-3 mr-1" /> No rules
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--success))] bg-[hsl(var(--success))]/5 p-4 rounded-lg border border-[hsl(var(--success))]/20">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">No coverage gaps detected.</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/traceability">View Traceability Matrix</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/evidence-pack">Open Evidence Pack Workspace</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-glass rounded-2xl border border-white/70">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Export Bundle</CardTitle>
            <CardDescription>
              Use the dedicated Evidence Pack workspace to generate a regulator-ready ZIP with DR coverage, rules, controls, exceptions, and population evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Badge variant="secondary">Available via Evidence Pack Workspace</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
