// =============================================================================
// Evidence Data Builder — Assembles all evidence pack data from existing registries
// Read-only: does not modify any ingestion, validation, or execution logic
// =============================================================================

import { getDRRegistry, DRRegistryEntry } from '@/lib/registry/drRegistry';
import { getRuleTraceability, RuleTraceEntry } from '@/lib/rules/ruleTraceability';
import { getControlsRegistry, ControlEntry } from '@/lib/registry/controlsRegistry';
import { computeTraceabilityMatrix, CoverageStatus, TraceabilityRow } from '@/lib/coverage/conformanceEngine';
import { DatasetPopulation } from '@/lib/coverage/populationCoverage';
import { CONFORMANCE_CONFIG } from '@/config/conformance';
import { PintAEException } from '@/types/pintAE';
import { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { ExecutionStatus, RuleExecution } from '@/types/executionLedger';
import { recordedCountsByDR } from '@/lib/coverage/executionCoverage';

// ── Tab A: Overview ──────────────────────────────────────────────────
export interface EvidenceOverview {
  assessmentRunId: string;
  executionTimestamp: string;
  scope: string;
  specVersion: string;
  drVersion: string;
  datasetName: string;
  counts: {
    totalInvoices: number;
    totalBuyers: number;
    totalLines: number;
    totalDRs: number;
    mandatoryDRs: number;
    coveredDRs: number;
    drsNoRules: number;
    drsNoControls: number;
    openExceptions: number;
  };
}

// ── Tab B: DR Coverage ───────────────────────────────────────────────
export interface DRCoverageRow {
  dr_id: string;
  business_term: string;
  mandatory: boolean;
  template: string;
  column_names: string;
  rule_count: number;
  control_count: number;
  population_percentage: number | null;
  coverage_status: CoverageStatus;
  asp_derived: boolean;
  system_default_allowed: boolean;
}

// ── Tab C: Rules Execution ───────────────────────────────────────────
export interface RuleExecutionRow {
  rule_id: string;
  rule_name: string;
  severity: string;
  linked_dr_ids: string;
  execution_count: number;
  failure_count: number;
  execution_source: 'recorded' | 'unavailable';
  status: ExecutionStatus;
  pass_count: number;
  not_applicable_count: number;
  not_evaluated_count: number;
  exception_count: number;
  error_count: number;
  reason: string;
}

// ── Tab D: Exceptions & Cases ────────────────────────────────────────
export interface ExceptionRow {
  exception_id: string;
  dr_id: string;
  rule_id: string;
  record_reference: string;
  severity: string;
  message: string;
  exception_status: string;
  case_id: string;
  case_status: string;
}

// ── Tab E: Controls Coverage ─────────────────────────────────────────
export interface ControlCoverageRow {
  control_id: string;
  control_name: string;
  control_type: string;
  covered_rule_ids: string;
  covered_dr_ids: string;
  linked_exception_count: number;
}

// ── Tab F: Data Quality & Population ─────────────────────────────────
export interface PopulationQualityRow {
  dr_id: string;
  business_term: string;
  mandatory: boolean;
  population_percentage: number | null;
  threshold: number;
  pass_fail: 'Pass' | 'Fail' | 'N/A';
}

// ── Full Evidence Pack ───────────────────────────────────────────────
export interface EvidencePackData {
  executionRecords: RuleExecution[];
  overview: EvidenceOverview;
  drCoverage: DRCoverageRow[];
  ruleExecution: RuleExecutionRow[];
  exceptions: ExceptionRow[];
  controlsCoverage: ControlCoverageRow[];
  populationQuality: PopulationQualityRow[];
  traceabilityRows: TraceabilityRow[];
}

export function buildEvidencePackData(
  runId: string,
  runTimestamp: string,
  buyers: Buyer[],
  headers: InvoiceHeader[],
  lines: InvoiceLine[],
  pintAEExceptions: PintAEException[],
  populations: DatasetPopulation[],
  executions: RuleExecution[] = [],
): EvidencePackData {
  const registry = getDRRegistry();
  const rules = [...getRuleTraceability()];
  for (const execution of executions) {
    const check = execution.check;
    const entry = { rule_id: check.check_id, rule_name: check.check_name, affected_dr_ids: check.pint_reference_terms, severity: check.severity, scope: check.scope };
    const index = rules.findIndex(rule => rule.rule_id === check.check_id);
    if (index >= 0) rules[index] = entry;
    else rules.push(entry);
  }
  const controls = getControlsRegistry();

  const exceptionCountsByDR = recordedCountsByDR(executions);

  const { rows: traceRows, gaps } = computeTraceabilityMatrix(populations, exceptionCountsByDR);

  // ── Tab A ──
  const overview: EvidenceOverview = {
    assessmentRunId: runId,
    executionTimestamp: runTimestamp,
    scope: CONFORMANCE_CONFIG.defaultUseCase,
    specVersion: 'PINT-AE 2025-Q2',
    drVersion: 'UAE DR v1.0.1',
    datasetName: headers.length > 0 ? (headers[0].seller_name ?? headers[0].seller_trn) : 'Unknown',
    counts: {
      totalInvoices: headers.length,
      totalBuyers: buyers.length,
      totalLines: lines.length,
      totalDRs: gaps.totalDRs,
      mandatoryDRs: gaps.mandatoryDRs,
      coveredDRs: gaps.drsCovered,
      drsNoRules: gaps.drsWithNoRules,
      drsNoControls: gaps.drsWithNoControls,
      openExceptions: pintAEExceptions.filter(e => e.case_status === 'Open').length,
    },
  };

  // ── Tab B ──
  const drCoverage: DRCoverageRow[] = traceRows.map(r => {
    const entry = registry.find(e => e.dr_id === r.dr_id);
    return {
      dr_id: r.dr_id,
      business_term: r.business_term,
      mandatory: r.mandatory,
      template: r.dataset_file ?? ((entry?.system_default_allowed ?? false) ? 'system_default' : 'asp_derived'),
      column_names: r.internal_columns.join('; '),
      rule_count: r.ruleIds.length,
      control_count: r.controlIds.length,
      population_percentage: r.populationPct,
      coverage_status: r.coverageStatus,
      asp_derived: entry?.asp_derived ?? false,
      system_default_allowed: entry?.system_default_allowed ?? false,
    };
  });

  // ── Tab C ──
  const ruleExecution: RuleExecutionRow[] = rules.map(r => {
    const recorded = executions.filter(execution => execution.check.check_id === r.rule_id);
    const sum = (key: 'passed' | 'failed' | 'notApplicable' | 'notEvaluated' | 'errors' | 'exceptionCount') => recorded.reduce((total, row) => total + row[key], 0);
    const passed = sum('passed'), failed = sum('failed'), skipped = sum('notEvaluated'), errors = sum('errors');
    const status: ExecutionStatus = errors ? 'error' : failed ? 'fail'
      : !recorded.length || skipped || recorded.some(row => row.status === 'not_evaluated') ? 'not_evaluated'
      : passed ? 'pass' : 'not_applicable';
    return {
      rule_id: r.rule_id, rule_name: r.rule_name, severity: r.severity, linked_dr_ids: r.affected_dr_ids.join('; '),
      execution_count: passed + failed, failure_count: failed, pass_count: passed,
      not_applicable_count: sum('notApplicable'), not_evaluated_count: skipped, error_count: errors,
      exception_count: sum('exceptionCount'), status,
      execution_source: recorded.length ? 'recorded' : 'unavailable',
      reason: recorded.length ? [...new Set(recorded.map(row => row.reason).filter(Boolean))].join('; ') : 'No execution record for this rule',
    };
  });

  // ── Tab D ──
  const exceptions: ExceptionRow[] = pintAEExceptions.map(e => ({
    exception_id: e.id,
    dr_id: (e.pint_reference_terms ?? []).join('; '),
    rule_id: e.check_id,
    record_reference: e.line_id ?? e.invoice_id ?? e.buyer_id ?? '',
    severity: e.severity,
    message: e.message,
    exception_status: e.case_status,
    case_id: e.case_id ?? '',
    case_status: e.case_status,
  }));

  // ── Tab E ──
  const ruleExcCounts = new Map<string, number>();
  for (const exc of pintAEExceptions) {
    ruleExcCounts.set(exc.check_id, (ruleExcCounts.get(exc.check_id) ?? 0) + 1);
  }
  const controlsCoverage: ControlCoverageRow[] = controls.map(c => {
    const linkedExcCount = c.covered_rule_ids.reduce(
      (sum, ruleId) => sum + (ruleExcCounts.get(ruleId) ?? 0), 0
    );
    return {
      control_id: c.control_id,
      control_name: c.control_name,
      control_type: c.control_type,
      covered_rule_ids: c.covered_rule_ids.join('; '),
      covered_dr_ids: c.covered_dr_ids.join('; '),
      linked_exception_count: linkedExcCount,
    };
  });

  // ── Tab F ──
  const threshold = CONFORMANCE_CONFIG.populationWarningThreshold;
  const populationQuality: PopulationQualityRow[] = traceRows.map(r => {
    const entry = registry.find(e => e.dr_id === r.dr_id);
    const isAspDerived = (entry?.asp_derived ?? false) || (entry?.system_default_allowed ?? false);
    let pass_fail: 'Pass' | 'Fail' | 'N/A';
    if (isAspDerived || r.populationPct === null) {
      pass_fail = 'N/A';
    } else if (r.populationPct >= threshold) {
      pass_fail = 'Pass';
    } else {
      pass_fail = 'Fail';
    }
    return {
      dr_id: r.dr_id,
      business_term: r.business_term,
      mandatory: r.mandatory,
      population_percentage: isAspDerived ? null : r.populationPct,
      threshold,
      pass_fail,
    };
  });

  return {
    executionRecords: executions,
    overview,
    drCoverage,
    ruleExecution,
    exceptions,
    controlsCoverage,
    populationQuality,
    traceabilityRows: traceRows,
  };
}
