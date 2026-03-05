import rawCrosswalk from '../../../docs/mof_rulebook_crosswalk.json';
import { MofRulebook } from '@/lib/rulebook/types';

interface CrosswalkRow {
  mof_field_number: number;
  pint_dr_ids?: string[];
}

interface CrosswalkDocument {
  field_crosswalk?: CrosswalkRow[];
}

export interface MofRuleTraceEntry {
  rule_id: string;
  exception_code: string;
  affected_dr_ids: string[];
}

function buildFieldToDrIdsMap(): Map<number, string[]> {
  const map = new Map<number, string[]>();
  const crosswalk = rawCrosswalk as CrosswalkDocument;
  (crosswalk.field_crosswalk || []).forEach((row) => {
    if (typeof row.mof_field_number !== 'number') return;
    const drIds = Array.isArray(row.pint_dr_ids)
      ? row.pint_dr_ids.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];
    map.set(row.mof_field_number, drIds);
  });
  return map;
}

export function buildMofRuleTraceability(rulebook: MofRulebook): MofRuleTraceEntry[] {
  const fieldToDrIds = buildFieldToDrIdsMap();
  return rulebook.validation_rules.map((rule) => {
    const drIds = new Set<string>();
    const fieldNumbers = [
      ...(Array.isArray(rule.required_field_numbers) ? rule.required_field_numbers : []),
      ...(typeof rule.field_number === 'number' ? [rule.field_number] : []),
    ];
    fieldNumbers.forEach((fieldNumber) => {
      (fieldToDrIds.get(fieldNumber) || []).forEach((drId) => drIds.add(drId));
    });

    return {
      rule_id: rule.rule_id,
      exception_code: rule.exception_code,
      affected_dr_ids: Array.from(drIds),
    };
  });
}

