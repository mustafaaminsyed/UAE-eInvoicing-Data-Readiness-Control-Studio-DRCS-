import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Target, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatasetType, FieldMapping, normalizeFieldMappings } from '@/types/fieldMapping';
import { analyzeCoverage, getCoverageStats, analyzeRegistryCoverage, getRegistryCoverageStats } from '@/lib/mapping/coverageAnalyzer';
import { getDRRuleTraceability } from '@/lib/registry/specRegistry';
import { getDatasetConditionalFieldIds } from '@/lib/mapping/datasetFieldCatalog';

interface MappingCoveragePanelProps {
  mappings: FieldMapping[];
  datasetType?: DatasetType;
  totalSourceColumns?: number;
  onFieldClick?: (fieldId: string) => void;
}

export function MappingCoveragePanel({
  mappings,
  datasetType = 'combined',
  totalSourceColumns,
  onFieldClick,
}: MappingCoveragePanelProps) {
  const confirmedMappings = useMemo(
    () => normalizeFieldMappings(mappings.filter((mapping) => mapping.isConfirmed)),
    [mappings]
  );
  const coverage = useMemo(
    () => analyzeCoverage(confirmedMappings, datasetType),
    [confirmedMappings, datasetType]
  );
  const stats = useMemo(() => getCoverageStats(coverage), [coverage]);

  // Registry-based coverage (authoritative 50-field spec)
  const regCoverage = useMemo(
    () => analyzeRegistryCoverage(confirmedMappings, datasetType),
    [confirmedMappings, datasetType]
  );
  const regStats = useMemo(() => getRegistryCoverageStats(regCoverage), [regCoverage]);

  const mappedConditionalIds = new Set(confirmedMappings.map(m => m.targetField.id));
  const conditionalFieldIds = getDatasetConditionalFieldIds(datasetType);
  const conditionalMapped = Array.from(conditionalFieldIds).filter((id) => mappedConditionalIds.has(id)).length;
  const conditionalPct = conditionalFieldIds.size > 0 ? Math.round((conditionalMapped / conditionalFieldIds.size) * 100) : 100;
  const sourceColumnsMapped = confirmedMappings.length;
  const sourceColumnsTotal = totalSourceColumns ?? confirmedMappings.length;
  const sourceColumnsPct = sourceColumnsTotal > 0 ? Math.round((sourceColumnsMapped / sourceColumnsTotal) * 100) : 100;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Uploaded File Fit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Mapped uploaded columns</span>
              <span className="text-xs font-bold">{sourceColumnsMapped}/{sourceColumnsTotal}</span>
            </div>
            <Progress value={sourceColumnsPct} className="h-2" />
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            This measures how completely the uploaded file mapped. It is separate from dataset and registry coverage,
            which reflect the broader fields and DRs the platform supports.
          </p>
        </CardContent>
      </Card>

      {/* Coverage Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Supported Dataset Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mandatory */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Mandatory</span>
              <span className="text-xs font-bold">{stats.mandatoryMapped}/{stats.mandatoryTotal}</span>
            </div>
            <Progress value={coverage.mandatoryCoverage} className={`h-2 ${coverage.mandatoryCoverage === 100 ? '' : '[&>div]:bg-amber-500'}`} />
          </div>

          {/* Conditional */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Conditional</span>
              <span className="text-xs font-bold">{conditionalMapped}/{conditionalFieldIds.size}</span>
            </div>
            <Progress value={conditionalPct} className="h-2 [&>div]:bg-blue-500" />
          </div>

          {/* Overall */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Overall</span>
              <span className="text-xs font-bold">{stats.overallMapped}/{stats.overallTotal}</span>
            </div>
            <Progress value={coverage.totalCoverage} className="h-2" />
          </div>

          {/* Blocking gaps */}
          <div className="pt-2 border-t">
            {coverage.unmappedMandatory.length > 0 ? (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium">{coverage.unmappedMandatory.length} blocking gap(s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium">All mandatory fields mapped</span>
              </div>
            )}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            This shows how much of the selected dataset model is covered, including optional supported fields that may
            not appear in your uploaded file.
          </p>
        </CardContent>
      </Card>

      {/* Registry Coverage (authoritative 50-field spec) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Registry Coverage
            <Badge variant="outline" className="text-[10px] ml-auto">{regStats.registryVersion}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Mandatory DRs</span>
              <span className="text-xs font-bold">{regStats.mandatoryMapped}/{regStats.mandatoryTotal}</span>
            </div>
            <Progress value={regCoverage.mandatoryCoveragePct} className={`h-2 ${regCoverage.mandatoryCoveragePct === 100 ? '' : '[&>div]:bg-amber-500'}`} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Overall ({regStats.overallTotal} DRs)</span>
              <span className="text-xs font-bold">{regStats.overallMapped}/{regStats.overallTotal}</span>
            </div>
            <Progress value={regCoverage.overallCoveragePct} className="h-2" />
          </div>
          <div className="pt-2 border-t">
            {regCoverage.isReadyForActivation ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium">Ready for activation</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium">{regCoverage.unmappedMandatory.length} mandatory DR(s) unmapped</span>
              </div>
            )}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            Registry coverage is the DR-level view. It can remain below 100% even when the uploaded file mapped
            cleanly, because some DRs are optional, derived, or system-owned.
          </p>
        </CardContent>
      </Card>

      {/* Unmapped Mandatory DRs */}
      {regCoverage.unmappedMandatory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Unmapped Mandatory DRs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[280px]">
              <div className="divide-y">
                {regCoverage.unmappedMandatory.map((field) => {
                  const trace = getDRRuleTraceability(field.dr_id);
                  return (
                    <button
                      key={field.dr_id}
                      onClick={() => onFieldClick?.(field.dr_id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono shrink-0">{field.dr_id}</Badge>
                        <span className="text-sm font-medium truncate">{field.business_term}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 pl-0.5">
                        {field.error_message_text || field.validation_logic || 'Required for the current use case'}
                      </p>
                      {trace && trace.linkedCheckIds.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 pl-0.5">
                          <span className="text-[10px] text-muted-foreground">Rules:</span>
                          {trace.linkedCheckIds.slice(0, 3).map(chkId => (
                            <Badge key={chkId} variant="secondary" className="text-[10px] px-1 py-0">{chkId}</Badge>
                          ))}
                          {trace.linkedCheckIds.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{trace.linkedCheckIds.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
