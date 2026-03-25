// =============================================================================
// Safety Checks - Internal Consistency Validator and Rule Integrity Gate
// =============================================================================

import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { OVERLAY_RUNTIME_CHECKS } from '@/lib/checks/overlayRuntimeChecks';
import { getDRRegistry } from '@/lib/registry/drRegistry';
import {
  getDRCoverageMaturity,
  VALIDATION_TO_DR_MAP,
  ValidationDRMapEntry,
} from '@/lib/registry/validationToDRMap';
import { getRuleTraceability } from '@/lib/rules/ruleTraceability';
import { getControlsRegistry } from '@/lib/registry/controlsRegistry';
import { PintAECheck } from '@/types/pintAE';
import { assertPintAETaxonomy } from '@/lib/validation/pintAERuleMetadata';

export type ConsistencyLevel = 'error' | 'warning' | 'info';

export interface ConsistencyIssue {
  level: ConsistencyLevel;
  category: string;
  message: string;
  affected_ids: string[];
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  passed: number;
  failed: number;
  timestamp: string;
}

export interface ConsistencyCheckOptions {
  checks?: PintAECheck[];
  validationMap?: ValidationDRMapEntry[];
}

const ACTIVE_EXECUTABLE_CHECKS: PintAECheck[] = [
  ...UAE_UC1_CHECK_PACK,
  ...OVERLAY_RUNTIME_CHECKS,
];

function buildValidationMapIndex(validationMap: ValidationDRMapEntry[]): Map<string, ValidationDRMapEntry> {
  return new Map(validationMap.map((entry) => [entry.validation_id, entry]));
}

function findFieldBindingIssues(
  validationMap: ValidationDRMapEntry[],
  registry = getDRRegistry()
): { errors: string[]; warnings: string[] } {
  const registryMap = new Map(registry.map((entry) => [entry.dr_id, entry]));
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of validationMap) {
    for (const target of entry.dr_targets) {
      const drEntry = registryMap.get(target.dr_id);
      if (!drEntry) {
        errors.push(`${entry.validation_id} -> ${target.dr_id}`);
        continue;
      }

      if (drEntry.internal_column_names.length === 0) {
        continue;
      }

      const hasFieldMatch = target.validated_fields.some((field) =>
        drEntry.internal_column_names.includes(field)
      );

      if (!hasFieldMatch) {
        const issue = `${entry.validation_id} -> ${target.dr_id} [${target.validated_fields.join(', ')} vs ${drEntry.internal_column_names.join(', ')}]`;
        if (target.mapping_type === 'reference_only') {
          warnings.push(issue);
        } else {
          errors.push(issue);
        }
      }
    }
  }

  return { errors, warnings };
}

export function runConsistencyChecks(options: ConsistencyCheckOptions = {}): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  let passed = 0;

  const checks = options.checks ?? ACTIVE_EXECUTABLE_CHECKS;
  const validationMap = options.validationMap ?? VALIDATION_TO_DR_MAP;
  const registry = getDRRegistry();
  const controls = getControlsRegistry();
  const ruleTrace = getRuleTraceability();
  const checkMap = new Map(checks.map((check) => [check.check_id, check]));
  const validationMapIndex = buildValidationMapIndex(validationMap);

  try {
    assertPintAETaxonomy(checks);
    passed++;
  } catch (error) {
    issues.push({
      level: 'error',
      category: 'Rule Taxonomy',
      message: error instanceof Error ? error.message : String(error),
      affected_ids: checks.map((check) => check.check_id),
    });
  }

  const invalidMappedRules = validationMap
    .map((entry) => entry.validation_id)
    .filter((validationId) => !checkMap.has(validationId));
  if (invalidMappedRules.length > 0) {
    issues.push({
      level: 'error',
      category: 'Validation Registry',
      message: `${invalidMappedRules.length} validation mapping(s) reference non-existent checks`,
      affected_ids: invalidMappedRules,
    });
  } else {
    passed++;
  }

  const { errors: fieldBindingErrors, warnings: fieldBindingWarnings } = findFieldBindingIssues(
    validationMap,
    registry
  );
  if (fieldBindingWarnings.length > 0) {
    issues.push({
      level: 'warning',
      category: 'Rule Field Mapping',
      message: `${fieldBindingWarnings.length} reference-only mapping(s) do not align to the DR registry columns`,
      affected_ids: fieldBindingWarnings,
    });
  }
  if (fieldBindingErrors.length > 0) {
    issues.push({
      level: 'error',
      category: 'Rule Field Mapping',
      message: `${fieldBindingErrors.length} validation mapping(s) do not match the DR field binding`,
      affected_ids: fieldBindingErrors,
    });
  } else {
    passed++;
  }

  const runtimeEnforcedWithoutRule = registry
    .filter((entry) => getDRCoverageMaturity(entry.dr_id) === 'runtime_enforced')
    .filter((entry) => !ruleTrace.some((rule) => rule.affected_dr_ids.includes(entry.dr_id)))
    .map((entry) => entry.dr_id);
  if (runtimeEnforcedWithoutRule.length > 0) {
    issues.push({
      level: 'error',
      category: 'Rule Integrity Gate',
      message: `${runtimeEnforcedWithoutRule.length} runtime-enforced DR(s) have no executable validation`,
      affected_ids: runtimeEnforcedWithoutRule,
    });
  } else {
    passed++;
  }

  const rulesWithoutClassification = checks
    .filter((check) => !check.rule_type || !check.execution_layer)
    .map((check) => check.check_id);
  if (rulesWithoutClassification.length > 0) {
    issues.push({
      level: 'error',
      category: 'Rule Integrity Gate',
      message: `${rulesWithoutClassification.length} rule(s) are missing rule_type or execution_layer metadata`,
      affected_ids: rulesWithoutClassification,
    });
  } else {
    passed++;
  }

  const invalidControlRules: string[] = [];
  const allRuleIds = new Set(checks.map((check) => check.check_id));
  for (const control of controls) {
    for (const ruleId of control.covered_rule_ids) {
      if (!allRuleIds.has(ruleId)) {
        invalidControlRules.push(`${control.control_id} -> ${ruleId}`);
      }
    }
  }
  if (invalidControlRules.length > 0) {
    issues.push({
      level: 'error',
      category: 'Control-Rule Integrity',
      message: `${invalidControlRules.length} control(s) reference rule IDs not in the active validation pack`,
      affected_ids: invalidControlRules,
    });
  } else {
    passed++;
  }

  const rulesWithoutExplicitMapping = checks
    .filter((check) => !validationMapIndex.has(check.check_id))
    .map((check) => check.check_id);
  if (rulesWithoutExplicitMapping.length > 0) {
    issues.push({
      level: 'warning',
      category: 'Validation Mapping',
      message: `${rulesWithoutExplicitMapping.length} rule(s) have no explicit validation-to-DR mapping entry`,
      affected_ids: rulesWithoutExplicitMapping,
    });
  } else {
    passed++;
  }

  return {
    issues,
    passed,
    failed: issues.length,
    timestamp: new Date().toISOString(),
  };
}

export function runRuleIntegrityGate(options: ConsistencyCheckOptions = {}): void {
  const report = runConsistencyChecks(options);
  const errors = report.issues.filter((issue) => issue.level === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => issue.message).join('; '));
  }
}
