// =============================================================================
// Conformance Engine — Computes traceability matrix and gap analysis
// Combines DR registry, rule traceability, controls registry, and population data
// =============================================================================

import { getDRRegistry, DRRegistryEntry, isDRIngestible } from '@/lib/registry/drRegistry';
import { getRulesForDR, getRuleTraceability } from '@/lib/rules/ruleTraceability';
import { getControlsForDR } from '@/lib/registry/controlsRegistry';
import { DatasetPopulation, getColumnPopulationPct } from '@/lib/coverage/populationCoverage';
import { CONFORMANCE_CONFIG } from '@/config/conformance';

// Part G: Coverage Classification
export type CoverageStatus = 'NOT_IN_TEMPLATE' | 'NO_RULE' | 'NO_CONTROL' | 'COVERED';

export function computeCoverageStatus(
  inTemplate: boolean,
  ruleCount: number,
  controlCount: number,
): CoverageStatus {
  if (!inTemplate) return 'NOT_IN_TEMPLATE';
  if (ruleCount === 0) return 'NO_RULE';
  if (controlCount === 0) return 'NO_CONTROL';
  return 'COVERED';
}

export interface TraceabilityRow {
  dr_id: string;
  business_term: string;
  mandatory: boolean;
  vatLawStatus: string;
  isNewPintField: boolean;
  dataset_file: string | null;
  internal_columns: string[];
  inTemplate: boolean;
  ingestible: boolean;
  populationPct: number | null;
  ruleIds: string[];
  ruleNames: string[];
  controlIds: string[];
  controlNames: string[];
  coverageStatus: CoverageStatus;
  lastRunPassRate: number | null;
  category: string;
  dataResponsibility: string;
  exceptionCount: number;
}

export interface GapsSummary {
  mandatoryNotInTemplate: number;
  mandatoryNotIngestible: number;
  mandatoryUnmapped: number;
  mandatoryLowPopulation: number;
  drsWithNoRules: number;
  drsWithNoControls: number;
  drsCovered: number;
  totalDRs: number;
  mandatoryDRs: number;
  populationThreshold: number;
}

export interface ConformanceResult {
  rows: TraceabilityRow[];
  gaps: GapsSummary;
  specVersion: string;
}

export function computeTraceabilityMatrix(
  populations: DatasetPopulation[],
  exceptionCountsByDR?: Map<string, { pass: number; fail: number }>
): ConformanceResult {
  const registry = getDRRegistry();

  let mandatoryNotInTemplate = 0;
  let mandatoryNotIngestible = 0;
  let mandatoryUnmapped = 0;
  let mandatoryLowPopulation = 0;
  let drsWithNoRules = 0;
  let drsWithNoControls = 0;
  let drsCovered = 0;

  const rows: TraceabilityRow[] = registry.map(entry => {
    const rules = getRulesForDR(entry.dr_id);
    const controls = getControlsForDR(entry.dr_id);
    const inTemplate = entry.internal_column_names.length > 0;
    const ingestible = isDRIngestible(entry);

    // Population: average across all columns for this DR
    let populationPct: number | null = null;
    if (inTemplate && entry.dataset_file && populations.length > 0) {
      const pcts = entry.internal_column_names
        .map(col => getColumnPopulationPct(populations, entry.dataset_file!, col))
        .filter((p): p is number => p !== null);
      if (pcts.length > 0) {
        populationPct = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      }
    }

    // Last run pass rate + exception count
    let lastRunPassRate: number | null = null;
    let exceptionCount = 0;
    if (exceptionCountsByDR) {
      const counts = exceptionCountsByDR.get(entry.dr_id);
      if (counts) {
        const total = counts.pass + counts.fail;
        lastRunPassRate = total > 0 ? (counts.pass / total) * 100 : 100;
        exceptionCount = counts.fail;
      }
    }

    // Coverage status (Part G)
    const coverageStatus = computeCoverageStatus(inTemplate, rules.length, controls.length);

    // Gap counting
    if (entry.mandatory_for_default_use_case) {
      if (!inTemplate) mandatoryNotInTemplate++;
      if (inTemplate && !ingestible) mandatoryNotIngestible++;
      if (populationPct !== null && populationPct < CONFORMANCE_CONFIG.populationWarningThreshold) {
        mandatoryLowPopulation++;
      }
    }
    if (rules.length === 0) drsWithNoRules++;
    if (controls.length === 0) drsWithNoControls++;
    if (coverageStatus === 'COVERED') drsCovered++;

    return {
      dr_id: entry.dr_id,
      business_term: entry.business_term,
      mandatory: entry.mandatory_for_default_use_case,
      vatLawStatus: entry.vat_law_status,
      isNewPintField: entry.vat_law_status.toLowerCase() === 'new',
      dataset_file: entry.dataset_file,
      internal_columns: entry.internal_column_names,
      inTemplate,
      ingestible,
      populationPct,
      ruleIds: rules.map(r => r.rule_id),
      ruleNames: rules.map(r => r.rule_name),
      controlIds: controls.map(c => c.control_id),
      controlNames: controls.map(c => c.control_name),
      coverageStatus,
      lastRunPassRate,
      category: entry.category,
      dataResponsibility: entry.data_responsibility,
      exceptionCount,
    };
  });

  const mandatoryDRs = registry.filter(e => e.mandatory_for_default_use_case).length;

  return {
    rows,
    gaps: {
      mandatoryNotInTemplate,
      mandatoryNotIngestible,
      mandatoryUnmapped,
      mandatoryLowPopulation,
      drsWithNoRules,
      drsWithNoControls,
      drsCovered,
      totalDRs: registry.length,
      mandatoryDRs,
      populationThreshold: CONFORMANCE_CONFIG.populationWarningThreshold,
    },
    specVersion: CONFORMANCE_CONFIG.specVersionLabel,
  };
}

/** Check if the system is ready to run checks */
export interface ReadinessResult {
  canRun: boolean;
  reasons: { message: string; link: string; linkLabel: string }[];
}

export function checkRunReadiness(
  hasMappingProfile: boolean,
  mandatoryMappingCoverage: number,
  mandatoryPopulationPct: number | null,
): ReadinessResult {
  const reasons: { message: string; link: string; linkLabel: string }[] = [];

  if (!hasMappingProfile) {
    reasons.push({
      message: 'No active mapping profile found.',
      link: '/mapping?tab=create',
      linkLabel: 'Create Mapping',
    });
  }

  if (mandatoryMappingCoverage < CONFORMANCE_CONFIG.mandatoryMappingCoverageThreshold) {
    reasons.push({
      message: `Mandatory DR mapping coverage is ${mandatoryMappingCoverage.toFixed(0)}% (required: ${CONFORMANCE_CONFIG.mandatoryMappingCoverageThreshold}%).`,
      link: '/mapping',
      linkLabel: 'Fix Mapping',
    });
  }

  if (mandatoryPopulationPct !== null && mandatoryPopulationPct < CONFORMANCE_CONFIG.mandatoryPopulationThreshold) {
    reasons.push({
      message: `Mandatory DR population coverage is ${mandatoryPopulationPct.toFixed(0)}% (required: ${CONFORMANCE_CONFIG.mandatoryPopulationThreshold}%).`,
      link: '/upload',
      linkLabel: 'Re-upload Data',
    });
  }

  return {
    canRun: reasons.length === 0,
    reasons,
  };
}
