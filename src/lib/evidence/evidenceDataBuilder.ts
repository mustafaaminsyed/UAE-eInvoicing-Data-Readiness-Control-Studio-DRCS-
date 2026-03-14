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
import { ExecutionLayer, FailureClass, PintAEException, RuleType } from '@/types/pintAE';
import { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getFailureClassForRule } from '@/lib/validation/pintAERuleMetadata';
import { EvidenceRuleExecutionTelemetryRow } from '@/types/evidence';
import { checksRegistry } from '@/lib/checks/checksRegistry';

export interface EvidencePackBuildOverrides {
  datasetName?: string;
  totalInvoices?: number;
  totalBuyers?: number;
  totalLines?: number;
  executionTelemetry?: EvidenceRuleExecutionTelemetryRow[];
}

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
  rule_type: RuleType;
  execution_layer: ExecutionLayer;
  failure_class: FailureClass;
  linked_dr_ids: string;
  execution_count: number;
  failure_count: number;
  execution_source: 'estimated' | 'runtime';
}

// ── Tab D: Exceptions & Cases ────────────────────────────────────────
export interface ExceptionRow {
  exception_id: string;
  dr_id: string;
  rule_id: string;
  rule_type: RuleType | '';
  execution_layer: ExecutionLayer | '';
  failure_class: FailureClass | '';
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
  overview: EvidenceOverview;
  drCoverage: DRCoverageRow[];
  ruleExecution: RuleExecutionRow[];
  exceptions: ExceptionRow[];
  controlsCoverage: ControlCoverageRow[];
  populationQuality: PopulationQualityRow[];
  traceabilityRows: TraceabilityRow[];
}

type EvidenceRuleCatalogEntry = {
  rule_id: string;
  rule_name: string;
  severity: string;
  rule_type: RuleType;
  execution_layer: ExecutionLayer;
  linked_dr_ids: string;
};

const CORE_RULE_METADATA_OVERRIDES: Partial<Record<string, Pick<EvidenceRuleCatalogEntry, 'rule_type' | 'execution_layer'>>> = {
  buyer_trn_missing: { rule_type: 'structural_rule', execution_layer: 'schema' },
  buyer_trn_invalid_format: { rule_type: 'structural_rule', execution_layer: 'schema' },
  duplicate_invoice_number: { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  header_totals_mismatch: { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  line_totals_mismatch: { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  vat_calc_mismatch: { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  negative_without_credit_note: { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  buyer_not_found: { rule_type: 'structural_rule', execution_layer: 'schema' },
  missing_mandatory_fields: { rule_type: 'structural_rule', execution_layer: 'schema' },
  mixed_vat_rates_no_total: { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
};

function buildSupplementalRuleCatalog(): Map<string, EvidenceRuleCatalogEntry> {
  const catalog = new Map<string, EvidenceRuleCatalogEntry>();

  checksRegistry.forEach((check) => {
    const override = CORE_RULE_METADATA_OVERRIDES[check.id];
    catalog.set(check.id, {
      rule_id: check.id,
      rule_name: check.name,
      severity: check.severity,
      rule_type: override?.rule_type ?? 'structural_rule',
      execution_layer: override?.execution_layer ?? 'schema',
      linked_dr_ids: '',
    });
  });

  catalog.set('org_profile_our_entity_alignment', {
    rule_id: 'org_profile_our_entity_alignment',
    rule_name: 'Our-side TRN Alignment',
    severity: 'Critical',
    rule_type: 'enumeration',
    execution_layer: 'national_rule',
    linked_dr_ids: '',
  });

  return catalog;
}

export function buildEvidencePackData(
  runId: string,
  runTimestamp: string,
  buyers: Buyer[],
  headers: InvoiceHeader[],
  lines: InvoiceLine[],
  pintAEExceptions: PintAEException[],
  populations: DatasetPopulation[],
  overrides: EvidencePackBuildOverrides = {},
): EvidencePackData {
  const registry = getDRRegistry();
  const rules = getRuleTraceability();
  const controls = getControlsRegistry();
  const checkMap = new Map(UAE_UC1_CHECK_PACK.map((check) => [check.check_id, check]));
  const totalInvoices = overrides.totalInvoices ?? headers.length;
  const totalBuyers = overrides.totalBuyers ?? buyers.length;
  const totalLines = overrides.totalLines ?? lines.length;
  const hasRuntimeTelemetry = Object.prototype.hasOwnProperty.call(overrides, 'executionTelemetry');
  const telemetryByRule = new Map(
    (overrides.executionTelemetry ?? []).map((row) => [row.rule_id, row])
  );
  const supplementalRuleCatalog = buildSupplementalRuleCatalog();
  const datasetName =
    overrides.datasetName ?? (headers.length > 0 ? (headers[0].seller_name ?? headers[0].seller_trn) : 'Unknown');

  // Build exception counts by DR for the conformance engine
  const exceptionCountsByDR = new Map<string, { pass: number; fail: number }>();
  for (const exc of pintAEExceptions) {
    const drIds = getValidationDRTargets(exc.check_id).map((target) => target.dr_id);
    for (const drId of drIds) {
      const existing = exceptionCountsByDR.get(drId) ?? { pass: 0, fail: 0 };
      existing.fail++;
      exceptionCountsByDR.set(drId, existing);
    }
  }

  const { rows: traceRows, gaps } = computeTraceabilityMatrix(populations, exceptionCountsByDR);

  // ── Tab A ──
  const overview: EvidenceOverview = {
    assessmentRunId: runId,
    executionTimestamp: runTimestamp,
    scope: CONFORMANCE_CONFIG.defaultUseCase,
    specVersion: 'PINT-AE 2025-Q2',
    drVersion: 'UAE DR v1.0.1',
    datasetName,
    counts: {
      totalInvoices,
      totalBuyers,
      totalLines,
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
  const ruleExecMap = new Map<string, { executions: number; failures: number }>();
  for (const rule of rules) {
    ruleExecMap.set(rule.rule_id, { executions: 0, failures: 0 });
  }
  for (const exc of pintAEExceptions) {
    const existing = ruleExecMap.get(exc.check_id);
    if (existing) {
      existing.failures++;
    }
  }
  // Count executions as total invoices tested per rule scope
  for (const rule of rules) {
    const counts = ruleExecMap.get(rule.rule_id)!;
    if (rule.scope === 'Header' || rule.scope === 'Cross') {
      counts.executions = totalInvoices;
    } else if (rule.scope === 'Party') {
      counts.executions = totalBuyers;
    } else if (rule.scope === 'Lines') {
      counts.executions = totalLines;
    }
  }

  const ruleExecution: RuleExecutionRow[] = rules.map((r) => {
    const telemetry = telemetryByRule.get(r.rule_id);
    return {
      rule_id: r.rule_id,
      rule_name: r.rule_name,
      severity: r.severity,
      rule_type: r.rule_type,
      execution_layer: r.execution_layer,
      failure_class: getFailureClassForRule(r.rule_type, r.execution_layer),
      linked_dr_ids: r.affected_dr_ids.join('; '),
      execution_count: telemetry?.execution_count ?? ruleExecMap.get(r.rule_id)?.executions ?? 0,
      failure_count: telemetry?.failure_count ?? ruleExecMap.get(r.rule_id)?.failures ?? 0,
      execution_source: telemetry?.execution_source ?? (hasRuntimeTelemetry ? 'runtime' : 'estimated'),
    };
  });

  for (const telemetry of telemetryByRule.values()) {
    if (ruleExecution.some((row) => row.rule_id === telemetry.rule_id)) continue;
    const supplementalRule = supplementalRuleCatalog.get(telemetry.rule_id);
    if (!supplementalRule) continue;

    ruleExecution.push({
      rule_id: supplementalRule.rule_id,
      rule_name: supplementalRule.rule_name,
      severity: supplementalRule.severity,
      rule_type: supplementalRule.rule_type,
      execution_layer: supplementalRule.execution_layer,
      failure_class: getFailureClassForRule(supplementalRule.rule_type, supplementalRule.execution_layer),
      linked_dr_ids: supplementalRule.linked_dr_ids,
      execution_count: telemetry.execution_count,
      failure_count: telemetry.failure_count,
      execution_source: telemetry.execution_source,
    });
  }

  // ── Tab D ──
  const exceptions: ExceptionRow[] = pintAEExceptions.map(e => {
    const check = checkMap.get(e.check_id);
    const ruleType = e.rule_type ?? check?.rule_type ?? '';
    const executionLayer = e.execution_layer ?? check?.execution_layer ?? '';
    const failureClass =
      e.failure_class ??
      (ruleType && executionLayer ? getFailureClassForRule(ruleType, executionLayer) : '');

    return {
      exception_id: e.id,
      dr_id: getValidationDRTargets(e.check_id).map((target) => target.dr_id).join('; '),
      rule_id: e.check_id,
      rule_type: ruleType,
      execution_layer: executionLayer,
      failure_class: failureClass,
      record_reference: e.line_id ?? e.invoice_id ?? e.buyer_id ?? '',
      severity: e.severity,
      message: e.message,
      exception_status: e.case_status,
      case_id: e.case_id ?? '',
      case_status: e.case_status,
    };
  });

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
    overview,
    drCoverage,
    ruleExecution,
    exceptions,
    controlsCoverage,
    populationQuality,
    traceabilityRows: traceRows,
  };
}
