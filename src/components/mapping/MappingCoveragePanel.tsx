import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Target, BookOpen, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { DatasetType, FieldMapping, normalizeFieldMappings } from '@/types/fieldMapping';
import { analyzeCoverage, getCoverageStats, analyzeRegistryCoverage, getRegistryCoverageStats } from '@/lib/mapping/coverageAnalyzer';
import { getDRRuleTraceability } from '@/lib/registry/specRegistry';
import { getDREntry } from '@/lib/registry/drRegistry';
import { getDatasetConditionalFieldIds } from '@/lib/mapping/datasetFieldCatalog';

interface MappingCoveragePanelProps {
  mappings: FieldMapping[];
  datasetType?: DatasetType;
  totalSourceColumns?: number;
  onFieldClick?: (fieldId: string) => void;
  currentFocusedField?: string | null;
  activeDrFilter?: DrFilterId;
  drSearch?: string;
  onDrFilterChange?: (filter: DrFilterId) => void;
  onDrSearchChange?: (value: string) => void;
}

type DrFilterId = 'all' | 'headers' | 'lines' | 'buyers' | 'uae';

export function MappingCoveragePanel({
  mappings,
  datasetType = 'combined',
  totalSourceColumns,
  onFieldClick,
  currentFocusedField,
  activeDrFilter: controlledDrFilter,
  drSearch: controlledDrSearch,
  onDrFilterChange,
  onDrSearchChange,
}: MappingCoveragePanelProps) {
  const [internalDrFilter, setInternalDrFilter] = useState<DrFilterId>('all');
  const [internalDrSearch, setInternalDrSearch] = useState('');
  const activeDrFilter = controlledDrFilter ?? internalDrFilter;
  const drSearch = controlledDrSearch ?? internalDrSearch;

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

  const unmappedMandatoryItems = useMemo(
    () =>
      regCoverage.unmappedMandatory.map((field) => ({
        field,
        trace: getDRRuleTraceability(field.dr_id),
        registryEntry: getDREntry(field.dr_id),
      })),
    [regCoverage.unmappedMandatory]
  );

  const drFilterCounts = useMemo(() => {
    const counts = {
      all: unmappedMandatoryItems.length,
      headers: 0,
      lines: 0,
      buyers: 0,
      uae: 0,
    };

    unmappedMandatoryItems.forEach(({ field, registryEntry }) => {
      if (registryEntry?.dataset_file === 'headers') counts.headers += 1;
      if (registryEntry?.dataset_file === 'lines') counts.lines += 1;
      if (registryEntry?.dataset_file === 'buyers') counts.buyers += 1;
      if (
        field.dr_id.startsWith('BTUAE-') ||
        field.dr_id.startsWith('BTAE-') ||
        field.business_term.toLowerCase().includes('uae')
      ) {
        counts.uae += 1;
      }
    });

    return counts;
  }, [unmappedMandatoryItems]);

  const filteredUnmappedMandatoryItems = useMemo(() => {
    const query = drSearch.trim().toLowerCase();

    return unmappedMandatoryItems.filter(({ field, registryEntry }) => {
      const matchesFilter =
        activeDrFilter === 'all' ||
        (activeDrFilter === 'headers' && registryEntry?.dataset_file === 'headers') ||
        (activeDrFilter === 'lines' && registryEntry?.dataset_file === 'lines') ||
        (activeDrFilter === 'buyers' && registryEntry?.dataset_file === 'buyers') ||
        (activeDrFilter === 'uae' &&
          (field.dr_id.startsWith('BTUAE-') ||
            field.dr_id.startsWith('BTAE-') ||
            field.business_term.toLowerCase().includes('uae')));

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        field.dr_id,
        field.business_term,
        field.error_message_text,
        field.validation_logic,
        registryEntry?.dataset_file,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [activeDrFilter, drSearch, unmappedMandatoryItems]);

  const filterOptions: Array<{ id: DrFilterId; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'headers', label: 'Headers' },
    { id: 'lines', label: 'Lines' },
    { id: 'buyers', label: 'Buyers' },
    { id: 'uae', label: 'UAE-specific' },
  ];

  const handleFilterChange = (filter: DrFilterId) => {
    setInternalDrFilter(filter);
    onDrFilterChange?.(filter);
  };

  const handleSearchChange = (value: string) => {
    setInternalDrSearch(value);
    onDrSearchChange?.(value);
  };

  const focusedIndex = useMemo(() => {
    if (!currentFocusedField) return -1;
    const normalizedFocusedField = currentFocusedField.toLowerCase();
    return filteredUnmappedMandatoryItems.findIndex(
      ({ field }) => field.dr_id.toLowerCase() === normalizedFocusedField
    );
  }, [currentFocusedField, filteredUnmappedMandatoryItems]);

  const nextFocusedItem =
    focusedIndex >= 0 && focusedIndex < filteredUnmappedMandatoryItems.length - 1
      ? filteredUnmappedMandatoryItems[focusedIndex + 1]
      : filteredUnmappedMandatoryItems[0];

  return (
    <div className="min-w-0 space-y-4">
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
          <CardContent className="space-y-3 p-3">
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{regCoverage.unmappedMandatory.length} mandatory DRs need mapping</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-amber-700/80">Scroll for more</span>
              </div>
              <p className="mt-1 leading-5 text-amber-900/80">
                Review each DR, inspect the linked rules, and map the missing source fields before activation.
              </p>
            </div>
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={drSearch}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search DR ID, business term, or rule context"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => {
                  const isActive = activeDrFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleFilterChange(option.id)}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      ].join(' ')}
                    >
                      <span>{option.label}</span>
                      <span className={isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                        {drFilterCounts[option.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {filteredUnmappedMandatoryItems.length} of {regCoverage.unmappedMandatory.length} unmapped mandatory DRs.
                </p>
                <div className="flex flex-wrap gap-2">
                  {filteredUnmappedMandatoryItems.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onFieldClick?.(filteredUnmappedMandatoryItems[0].field.dr_id)}
                        className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        Focus first unresolved
                      </button>
                      <button
                        type="button"
                        onClick={() => nextFocusedItem && onFieldClick?.(nextFocusedItem.field.dr_id)}
                        className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        {focusedIndex >= 0 && focusedIndex < filteredUnmappedMandatoryItems.length - 1
                          ? 'Focus next unresolved'
                          : 'Restart unresolved review'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <ScrollArea className="h-[26rem]" type="always">
              <div className="divide-y overflow-hidden rounded-xl border bg-background pr-3">
                {filteredUnmappedMandatoryItems.length > 0 ? (
                  filteredUnmappedMandatoryItems.map(({ field, trace, registryEntry }) => (
                    <button
                      key={field.dr_id}
                      onClick={() => onFieldClick?.(field.dr_id)}
                      className={[
                        'w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/50',
                        currentFocusedField?.toLowerCase() === field.dr_id.toLowerCase() ? 'bg-primary/5' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono shrink-0">{field.dr_id}</Badge>
                        <span className="text-sm font-medium leading-5 break-words">{field.business_term}</span>
                        {registryEntry?.dataset_file && (
                          <Badge variant="secondary" className="ml-auto text-[10px] uppercase">
                            {registryEntry.dataset_file}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 break-words pl-0.5 text-xs text-muted-foreground">
                        {field.error_message_text || field.validation_logic || 'Required for the current use case'}
                      </p>
                      {trace && trace.linkedCheckIds.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1 pl-0.5">
                          <span className="text-[10px] text-muted-foreground">Rules:</span>
                          {trace.linkedCheckIds.slice(0, 3).map(chkId => (
                            <Badge
                              key={chkId}
                              variant="secondary"
                              className="max-w-full whitespace-normal break-all text-[10px] px-1 py-0"
                            >
                              {chkId}
                            </Badge>
                          ))}
                          {trace.linkedCheckIds.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{trace.linkedCheckIds.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium">No DRs match the current filter</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clear the search or switch filters to see the full mandatory DR backlog.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
