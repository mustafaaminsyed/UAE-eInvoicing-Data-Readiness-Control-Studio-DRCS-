// =============================================================================
// Rule Traceability - Maps executable validation rules to DR IDs
// Coverage is derived from the explicit validation -> DR mapping registry.
// =============================================================================

import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import { getShadowApplicabilityDefinitions } from '@/modules/scenarioContext/shadowApplicability';
import { ExecutionLayer, RuleType } from '@/types/pintAE';

export interface RuleTraceEntry {
  rule_id: string;
  rule_name: string;
  affected_dr_ids: string[];
  referenced_dr_ids: string[];
  rule_type: RuleType;
  execution_layer: ExecutionLayer;
  severity: string;
  scope: string;
  applies_when?: string;
}

export function buildRuleTraceability(): RuleTraceEntry[] {
  const runtimeEntries = UAE_UC1_CHECK_PACK.map((check) => ({
    rule_id: check.check_id,
    rule_name: check.check_name,
    affected_dr_ids: getValidationDRTargets(check.check_id).map((target) => target.dr_id),
    referenced_dr_ids: getValidationDRTargets(check.check_id, { includeReferenceOnly: true }).map(
      (target) => target.dr_id
    ),
    rule_type: check.rule_type,
    execution_layer: check.execution_layer,
    severity: check.severity,
    scope: check.scope,
    applies_when: check.use_case,
  }));

  const overlayBridgeEntries: RuleTraceEntry[] = getShadowApplicabilityDefinitions()
    .filter((definition) => definition.source === 'shadow_only' && definition.family === 'overlay')
    .map((definition) => ({
      rule_id: definition.ruleId,
      rule_name: definition.title,
      affected_dr_ids: getValidationDRTargets(definition.ruleId).map((target) => target.dr_id),
      referenced_dr_ids: getValidationDRTargets(definition.ruleId, { includeReferenceOnly: true }).map(
        (target) => target.dr_id
      ),
      rule_type: 'dependency_rule' as RuleType,
      execution_layer: 'dependency_rule' as ExecutionLayer,
      severity: 'Critical',
      scope: 'Header',
      applies_when: 'ScenarioContext overlay traceability bridge',
    }));

  return [...runtimeEntries, ...overlayBridgeEntries];
}

export function getIndirectRuleTraceability(): RuleTraceEntry[] {
  return getShadowApplicabilityDefinitions()
    .filter((definition) => definition.source === 'shadow_only')
    .map((definition) => ({
      rule_id: definition.ruleId,
      rule_name: definition.title,
      affected_dr_ids: definition.linkedDrIds,
      referenced_dr_ids: definition.linkedDrIds,
      rule_type: 'dependency_rule' as RuleType,
      execution_layer: 'dependency_rule' as ExecutionLayer,
      severity: 'Critical',
      scope: 'Header',
      applies_when: 'ScenarioContext shadow applicability traceability',
    }));
}

let _traceMap: RuleTraceEntry[] | null = null;

export function getRuleTraceability(): RuleTraceEntry[] {
  if (!_traceMap) _traceMap = buildRuleTraceability();
  return _traceMap;
}

export function getRuleTraceabilityEntry(ruleId: string): RuleTraceEntry | undefined {
  return getRuleTraceability().find((rule) => rule.rule_id === ruleId);
}

export function getAffectedDRIdsForRule(ruleId: string): string[] {
  return getRuleTraceabilityEntry(ruleId)?.affected_dr_ids ?? [];
}

export function getReferencedDRIdsForRule(ruleId: string): string[] {
  return getRuleTraceabilityEntry(ruleId)?.referenced_dr_ids ?? [];
}

export function getRulesForDR(drId: string): RuleTraceEntry[] {
  return getRuleTraceability().filter((rule) => rule.affected_dr_ids.includes(drId));
}

export function getIndirectRulesForDR(drId: string): RuleTraceEntry[] {
  return getIndirectRuleTraceability().filter((rule) => rule.affected_dr_ids.includes(drId));
}

export function getDRsWithRules(): Set<string> {
  const ids = new Set<string>();
  getRuleTraceability().forEach((rule) => rule.affected_dr_ids.forEach((id) => ids.add(id)));
  return ids;
}

export function getDRsWithoutRules(allDrIds: string[]): string[] {
  const withRules = getDRsWithRules();
  return allDrIds.filter((id) => !withRules.has(id));
}
