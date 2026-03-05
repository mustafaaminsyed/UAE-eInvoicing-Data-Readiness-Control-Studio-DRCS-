import rawRulebook from '../../../docs/uae_einvoicing_data_schema.json';
import rawCrosswalk from '../../../docs/mof_rulebook_crosswalk.json';
import { adaptMofRulebook } from '@/lib/rulebook/adapter';
import { MofRulebook, MofValidationRule, RulebookAdapterResult, RulebookValidationResult } from '@/lib/rulebook/types';
import { validateMofRulebook } from '@/lib/rulebook/validator';

interface CrosswalkMetadata {
  generated_on?: string;
  precedence_policy?: string;
}

interface CrosswalkDocument {
  metadata?: CrosswalkMetadata;
}

export interface RulebookGovernanceMetadata {
  ruleSource: 'PINT_UC1' | 'UAE_MOF_OVERLAY';
  rulebookTitle: string;
  rulebookVersion: string;
  rulebookDate: string;
  crosswalkVersion: string;
  precedencePolicy: string;
  mode: 'legacy_only' | 'shadow' | 'enforced';
}

export interface LoadedRulebookBundle {
  rulebook: MofRulebook;
  validation: RulebookValidationResult;
  adapted: RulebookAdapterResult;
  versionLabel: string;
  governance: RulebookGovernanceMetadata;
}

function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== 'string') return fallback;
  return raw.toLowerCase() === 'true';
}

export function isMofRulebookEnabled(): boolean {
  return readFlag(import.meta.env.VITE_USE_MOF_RULEBOOK, false);
}

export function isMofRulebookShadowModeEnabled(): boolean {
  return readFlag(import.meta.env.VITE_RULEBOOK_SHADOW_MODE, true);
}

export function isMofMandatoryGateEnabled(): boolean {
  return readFlag(import.meta.env.VITE_MOF_MANDATORY_GATE_ENABLED, false);
}

export function getMofMandatoryGateFieldNumbers(): number[] {
  const raw = import.meta.env.VITE_MOF_MANDATORY_GATE_FIELDS;
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

let cachedBundle: LoadedRulebookBundle | null = null;

function withRuntimeValidationOverlays(rulebook: MofRulebook): MofRulebook {
  const overlays: MofValidationRule[] = [];

  const overlayRuleId = 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST';
  const hasOverlay = rulebook.validation_rules.some((rule) => rule.rule_id === overlayRuleId);
  if (!hasOverlay) {
    overlays.push({
      rule_id: overlayRuleId,
      invoice_type: ['tax_invoice', 'commercial_xml'],
      severity: 'error',
      type: 'regex',
      field_number: 25,
      pattern: '^(TL|EID|PAS|CD)$',
      exception_code: 'EINV_FIELD_VALUE_INVALID',
    });
  }

  const aedConsistencyRuleId = 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY';
  const hasAedConsistencyRule = rulebook.validation_rules.some(
    (rule) => rule.rule_id === aedConsistencyRuleId
  );
  if (!hasAedConsistencyRule) {
    overlays.push({
      rule_id: aedConsistencyRuleId,
      invoice_type: 'commercial_xml',
      severity: 'error',
      type: 'fx_consistency',
      field_number: 49,
      exception_code: 'EINV_FIELD_VALUE_INVALID',
    });
  }

  const grossPriceRuleId = 'UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY';
  const hasGrossPriceRule = rulebook.validation_rules.some(
    (rule) => rule.rule_id === grossPriceRuleId
  );
  if (!hasGrossPriceRule) {
    overlays.push({
      rule_id: grossPriceRuleId,
      invoice_type: 'commercial_xml',
      severity: 'error',
      type: 'gross_price_consistency',
      field_number: 44,
      exception_code: 'EINV_FIELD_VALUE_INVALID',
    });
  }

  const vatAedConsistencyRuleId = 'UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY';
  const hasVatAedConsistencyRule = rulebook.validation_rules.some(
    (rule) => rule.rule_id === vatAedConsistencyRuleId
  );
  if (!hasVatAedConsistencyRule) {
    overlays.push({
      rule_id: vatAedConsistencyRuleId,
      invoice_type: 'commercial_xml',
      severity: 'error',
      type: 'fx_consistency',
      field_number: 48,
      exception_code: 'EINV_FIELD_VALUE_INVALID',
    });
  }

  if (overlays.length === 0) return rulebook;

  return {
    ...rulebook,
    validation_rules: [...rulebook.validation_rules, ...overlays],
  };
}

export function loadMofRulebookBundle(): LoadedRulebookBundle {
  if (cachedBundle) return cachedBundle;

  const raw = rawRulebook as MofRulebook;
  const rulebook = withRuntimeValidationOverlays(raw);
  const validation = validateMofRulebook(rulebook);
  const adapted = adaptMofRulebook(rulebook);
  const source = rulebook.spec?.source_document;
  const crosswalk = rawCrosswalk as CrosswalkDocument;
  const crosswalkMetadata = crosswalk.metadata || {};
  const versionLabel = source ? `${source.title} ${source.version} (${source.date})` : 'unknown';
  const mode = isMofRulebookEnabled()
    ? 'enforced'
    : isMofRulebookShadowModeEnabled()
      ? 'shadow'
      : 'legacy_only';
  const governance: RulebookGovernanceMetadata = {
    ruleSource: (isMofRulebookEnabled() || isMofRulebookShadowModeEnabled())
      ? 'UAE_MOF_OVERLAY'
      : 'PINT_UC1',
    rulebookTitle: source?.title || 'unknown',
    rulebookVersion: source?.version || 'unknown',
    rulebookDate: source?.date || 'unknown',
    crosswalkVersion: crosswalkMetadata.generated_on || 'unknown',
    precedencePolicy: crosswalkMetadata.precedence_policy || 'unspecified',
    mode,
  };

  cachedBundle = {
    rulebook,
    validation,
    adapted,
    versionLabel,
    governance,
  };

  return cachedBundle;
}
