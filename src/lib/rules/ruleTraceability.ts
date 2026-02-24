// =============================================================================
// Rule Traceability — Maps validation rules to DR IDs
// Lightweight metadata layer; does NOT modify rule execution logic
// =============================================================================

import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

export interface RuleTraceEntry {
  rule_id: string;
  rule_name: string;
  affected_dr_ids: string[];
  severity: string;
  scope: string;
  applies_when?: string;
}

/** 
 * Build rule traceability from the existing check pack's pint_reference_terms.
 * This is purely metadata — no rule logic is changed.
 */
export function buildRuleTraceability(): RuleTraceEntry[] {
  return UAE_UC1_CHECK_PACK.map(check => ({
    rule_id: check.check_id,
    rule_name: check.check_name,
    affected_dr_ids: check.pint_reference_terms ?? [],
    severity: check.severity,
    scope: check.scope,
    applies_when: check.use_case,
  }));
}

// Singleton
let _traceMap: RuleTraceEntry[] | null = null;
export function getRuleTraceability(): RuleTraceEntry[] {
  if (!_traceMap) _traceMap = buildRuleTraceability();
  return _traceMap;
}

/** Get all rules that reference a given DR ID */
export function getRulesForDR(drId: string): RuleTraceEntry[] {
  return getRuleTraceability().filter(r => r.affected_dr_ids.includes(drId));
}

/** Get all DR IDs that have at least one rule mapped */
export function getDRsWithRules(): Set<string> {
  const ids = new Set<string>();
  getRuleTraceability().forEach(r => r.affected_dr_ids.forEach(id => ids.add(id)));
  return ids;
}

/** Get DR IDs with no rules mapped */
export function getDRsWithoutRules(allDrIds: string[]): string[] {
  const withRules = getDRsWithRules();
  return allDrIds.filter(id => !withRules.has(id));
}
