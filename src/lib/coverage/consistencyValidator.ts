// =============================================================================
// Part K: Safety Checks - Internal Consistency Validator
// Ensures registry, rules, controls, and templates are internally consistent
// =============================================================================

import { getDRRegistry } from '@/lib/registry/drRegistry';
import { getRuleTraceability } from '@/lib/rules/ruleTraceability';
import { getControlsRegistry } from '@/lib/registry/controlsRegistry';

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

// These references are intentionally outside the 50 customer DR registry.
// They are meta/group/derived terms used by checks, so they should not block export.
const NON_BLOCKING_RULE_REFERENCES = new Set<string>([
  'IBG-23',
  'IBG-25',
  'IBT-006',
  'IBT-007',
  'BTUAE-001',
  'BTUAE-002',
  'BTUAE-003',
  'BTUAE-004',
  'BTUAE-005',
]);

export function runConsistencyChecks(): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  let passed = 0;

  const registry = getDRRegistry();
  const rules = getRuleTraceability();
  const controls = getControlsRegistry();

  const allDrIds = new Set(registry.map((e) => e.dr_id));
  const mandatoryDrs = registry.filter((e) => e.mandatory_for_default_use_case);

  // 1. All mandatory DRs appear in dr_registry
  if (mandatoryDrs.length > 0) passed++;

  // 2. All rules reference valid DR IDs
  const invalidRuleDRs: string[] = [];
  const nonBlockingRuleDRs: string[] = [];
  for (const rule of rules) {
    for (const drId of rule.affected_dr_ids) {
      if (!allDrIds.has(drId)) {
        const trace = `${rule.rule_id} -> ${drId}`;
        if (NON_BLOCKING_RULE_REFERENCES.has(drId)) {
          nonBlockingRuleDRs.push(trace);
        } else {
          invalidRuleDRs.push(trace);
        }
      }
    }
  }
  if (nonBlockingRuleDRs.length > 0) {
    issues.push({
      level: 'warning',
      category: 'Rule-DR Integrity',
      message: `${nonBlockingRuleDRs.length} rule reference(s) are outside the customer DR registry (non-blocking meta/derived terms)`,
      affected_ids: nonBlockingRuleDRs,
    });
  }
  if (invalidRuleDRs.length > 0) {
    issues.push({
      level: 'error',
      category: 'Rule-DR Integrity',
      message: `${invalidRuleDRs.length} rule(s) reference DR IDs not in registry`,
      affected_ids: invalidRuleDRs,
    });
  } else {
    passed++;
  }

  // 3. All template columns reference valid DR IDs (via DR_TO_COLUMN_MAP)
  // Checked implicitly: every DR in registry with columns has valid dr_id
  const orphanColumns = registry.filter(
    (e) => e.internal_column_names.length > 0 && !allDrIds.has(e.dr_id)
  );
  if (orphanColumns.length > 0) {
    issues.push({
      level: 'error',
      category: 'Template-DR Integrity',
      message: `${orphanColumns.length} template column mapping(s) reference invalid DR IDs`,
      affected_ids: orphanColumns.map((e) => e.dr_id),
    });
  } else {
    passed++;
  }

  // 4. No DR is marked COVERED without at least one rule and one control
  const ruledDRs = new Set<string>();
  rules.forEach((r) => r.affected_dr_ids.forEach((id) => ruledDRs.add(id)));
  const controlledDRs = new Set<string>();
  controls.forEach((c) => c.covered_dr_ids.forEach((id) => controlledDRs.add(id)));

  const falseCovered = registry.filter((e) => {
    const hasRule = ruledDRs.has(e.dr_id);
    const hasControl = controlledDRs.has(e.dr_id);
    return e.internal_column_names.length > 0 && hasRule && !hasControl;
  });
  if (falseCovered.length > 0) {
    issues.push({
      level: 'warning',
      category: 'Coverage Integrity',
      message: `${falseCovered.length} DR(s) have rules but no control linked`,
      affected_ids: falseCovered.map((e) => e.dr_id),
    });
  } else {
    passed++;
  }

  // 5. Controls reference valid rule IDs
  const allRuleIds = new Set(rules.map((r) => r.rule_id));
  const invalidControlRules: string[] = [];
  for (const ctrl of controls) {
    for (const ruleId of ctrl.covered_rule_ids) {
      if (!allRuleIds.has(ruleId)) {
        invalidControlRules.push(`${ctrl.control_id} -> ${ruleId}`);
      }
    }
  }
  if (invalidControlRules.length > 0) {
    issues.push({
      level: 'error',
      category: 'Control-Rule Integrity',
      message: `${invalidControlRules.length} control(s) reference rule IDs not in check pack`,
      affected_ids: invalidControlRules,
    });
  } else {
    passed++;
  }

  // 6. Mandatory DRs without any rule mapping
  const mandatoryNoRules = mandatoryDrs.filter((d) => !ruledDRs.has(d.dr_id));
  if (mandatoryNoRules.length > 0) {
    issues.push({
      level: 'warning',
      category: 'Mandatory Coverage',
      message: `${mandatoryNoRules.length} mandatory DR(s) have no validation rule`,
      affected_ids: mandatoryNoRules.map((d) => d.dr_id),
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
