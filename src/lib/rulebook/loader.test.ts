import { describe, expect, it } from 'vitest';
import { loadMofRulebookBundle } from '@/lib/rulebook/loader';

describe('loadMofRulebookBundle', () => {
  it('adds field 25 codelist overlay rule for execution', () => {
    const bundle = loadMofRulebookBundle();
    const overlayRule = bundle.rulebook.validation_rules.find(
      (rule) => rule.rule_id === 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST'
    );
    expect(overlayRule).toBeDefined();
    expect(overlayRule?.field_number).toBe(25);
    expect(overlayRule?.type).toBe('regex');
    expect(overlayRule?.pattern).toBe('^(TL|EID|PAS|CD)$');

    const adaptedRule = bundle.adapted.checks.find(
      (check) => check.id === 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST'
    );
    expect(adaptedRule).toBeDefined();
    expect(adaptedRule?.executable).toBe(true);
    expect(adaptedRule?.internalField).toBe('buyer_legal_reg_id_type');

    const field49Rule = bundle.rulebook.validation_rules.find(
      (rule) => rule.rule_id === 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY'
    );
    expect(field49Rule).toBeDefined();
    expect(field49Rule?.field_number).toBe(49);
    expect(field49Rule?.type).toBe('fx_consistency');

    const field44Rule = bundle.rulebook.validation_rules.find(
      (rule) => rule.rule_id === 'UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY'
    );
    expect(field44Rule).toBeDefined();
    expect(field44Rule?.field_number).toBe(44);
    expect(field44Rule?.type).toBe('gross_price_consistency');

    const field48Rule = bundle.rulebook.validation_rules.find(
      (rule) => rule.rule_id === 'UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY'
    );
    expect(field48Rule).toBeDefined();
    expect(field48Rule?.field_number).toBe(48);
    expect(field48Rule?.type).toBe('fx_consistency');
  });
});
