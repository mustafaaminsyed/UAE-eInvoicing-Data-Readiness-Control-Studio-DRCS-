import type {
  ExecutionLayer,
  FailureClass,
  LegacyRuleType,
  PintAECheck,
  RuleType,
} from '@/types/pintAE';

export const ALLOWED_RULE_TYPES: RuleType[] = [
  'dynamic_codelist',
  'fixed_literal',
  'enumeration',
  'dependency_rule',
  'structural_rule',
];

export const ALLOWED_EXECUTION_LAYERS: ExecutionLayer[] = [
  'schema',
  'codelist',
  'national_rule',
  'dependency_rule',
  'semantic_rule',
];

export type RawPintAECheck = Omit<PintAECheck, 'rule_type' | 'execution_layer'> & {
  rule_type?: LegacyRuleType | RuleType;
  execution_layer?: ExecutionLayer;
};

type RuleMetadata = {
  rule_type: RuleType;
  execution_layer: ExecutionLayer;
};

const RULE_METADATA_BY_CHECK_ID: Record<string, RuleMetadata> = {
  'UAE-UC1-CHK-001': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-002': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-003': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-004': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-005': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-006': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-007': { rule_type: 'fixed_literal', execution_layer: 'national_rule' },
  'UAE-UC1-CHK-008': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-009': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-010': { rule_type: 'structural_rule', execution_layer: 'national_rule' },
  'UAE-UC1-CHK-011': { rule_type: 'enumeration', execution_layer: 'national_rule' },
  'UAE-UC1-CHK-012': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-013': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-014': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-014A': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-014B': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-015': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-016': { rule_type: 'enumeration', execution_layer: 'national_rule' },
  'UAE-UC1-CHK-017': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-018': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-019': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-020': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-021': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-022': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-023': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-024': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-025': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-026': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-027': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-028': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-029': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-030': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-031': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-032': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-033': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-034': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-035': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-036': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-037': { rule_type: 'enumeration', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-038': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-039': { rule_type: 'structural_rule', execution_layer: 'schema' },
  'UAE-UC1-CHK-040': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-041': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-042': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-043': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-044': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-045': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-046': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-047': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-048': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-049': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-050': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-051': { rule_type: 'dependency_rule', execution_layer: 'dependency_rule' },
  'UAE-UC1-CHK-052': { rule_type: 'dynamic_codelist', execution_layer: 'codelist' },
  'UAE-UC1-CHK-053': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
  'UAE-UC1-CHK-054': { rule_type: 'structural_rule', execution_layer: 'semantic_rule' },
};

export function getRuleMetadataForCheck(checkId: string): RuleMetadata | undefined {
  return RULE_METADATA_BY_CHECK_ID[checkId];
}

export function normalizePintAECheck(check: RawPintAECheck): PintAECheck {
  const metadata = getRuleMetadataForCheck(check.check_id);
  if (!metadata) {
    throw new Error(`Missing rule taxonomy metadata for check ${check.check_id}`);
  }

  return {
    ...check,
    rule_type: metadata.rule_type,
    execution_layer: metadata.execution_layer,
  };
}

export function assertPintAETaxonomy(checks: Array<Pick<PintAECheck, 'check_id' | 'rule_type' | 'execution_layer'>>): void {
  const invalid: string[] = [];

  for (const check of checks) {
    if (!ALLOWED_RULE_TYPES.includes(check.rule_type)) {
      invalid.push(`${check.check_id}: invalid rule_type ${String(check.rule_type)}`);
    }
    if (!ALLOWED_EXECUTION_LAYERS.includes(check.execution_layer)) {
      invalid.push(`${check.check_id}: invalid execution_layer ${String(check.execution_layer)}`);
    }
  }

  if (invalid.length > 0) {
    throw new Error(`PINT-AE rule taxonomy validation failed: ${invalid.join('; ')}`);
  }
}

export function getFailureClassForRule(ruleType: RuleType, executionLayer: ExecutionLayer): FailureClass {
  switch (ruleType) {
    case 'dynamic_codelist':
      return 'codelist_failure';
    case 'fixed_literal':
      return 'fixed_rule_failure';
    case 'enumeration':
      return 'enumeration_failure';
    case 'dependency_rule':
      return 'dependency_failure';
    case 'structural_rule':
      return executionLayer === 'semantic_rule' ? 'semantic_failure' : 'structural_failure';
    default: {
      const exhaustive: never = ruleType;
      throw new Error(`Unhandled rule type: ${String(exhaustive)}`);
    }
  }
}
