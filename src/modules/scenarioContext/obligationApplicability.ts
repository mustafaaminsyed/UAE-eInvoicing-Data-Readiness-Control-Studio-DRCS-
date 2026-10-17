import {
  getRegulatoryObligation,
  getRegulatoryObligations,
  type RegulatoryObligation,
} from '@/lib/registry/regulatoryObligationRegistry';
import { buildScenarioContext } from '@/modules/scenarioContext/buildScenarioContext';
import type { ScenarioInvoiceInput } from '@/modules/scenarioLens/types';
import type { ScenarioContext, ScenarioDocumentVariant } from '@/types/scenarioContext';

export type ObligationApplicabilityState = 'applicable' | 'not_applicable' | 'unresolved';

export interface ObligationApplicabilityDecision {
  termId: string;
  state: ObligationApplicabilityState;
  reason: string;
  evidenceFields: string[];
  shadow: true;
  authoritative: false;
}

export interface ObligationApplicabilityReport {
  context: ScenarioContext;
  decisions: ObligationApplicabilityDecision[];
  summary: Record<ObligationApplicabilityState, number>;
  shadow: true;
  authoritative: false;
}

type Evaluator = (
  obligation: RegulatoryObligation,
  context: ScenarioContext,
  input: ScenarioInvoiceInput
) => ObligationApplicabilityDecision;

const EVALUATORS: Record<string, Evaluator> = {
  'BTAE-03': (_obligation, context) => evaluateCreditNoteTerm(context, 'Credit-note reason code'),
  'IBT-025': (_obligation, context, input) => {
    if (isKnownNonCredit(context.documentVariant.value)) {
      return decision('IBT-025', 'not_applicable', 'The document is not a credit-note variant.', ['invoice_type']);
    }
    if (!isCreditNote(context.documentVariant.value)) {
      return decision('IBT-025', 'unresolved', 'The document variant is unknown.', ['invoice_type']);
    }
    const reasonCode = readText(input.header, ['credit_note_reason_code', 'creditNoteReasonCode']);
    if (reasonCode.toUpperCase() === 'VD') {
      return decision('IBT-025', 'not_applicable', 'Credit-note reason VD activates the preceding-reference exception.', ['invoice_type', 'credit_note_reason_code']);
    }
    return decision('IBT-025', 'applicable', 'A credit-note variant requires a preceding invoice reference unless reason code VD applies.', ['invoice_type', 'credit_note_reason_code']);
  },
  'IBT-026': (_obligation, context, input) => {
    const reference = readText(input.header, ['preceding_invoice_reference', 'precedingInvoiceReference']);
    if (reference) {
      return decision('IBT-026', 'applicable', 'A preceding-invoice reference group is present.', ['preceding_invoice_reference']);
    }
    if (isKnownNonCredit(context.documentVariant.value)) {
      return decision('IBT-026', 'not_applicable', 'No preceding-invoice group is present on a non-credit document.', ['invoice_type', 'preceding_invoice_reference']);
    }
    return decision('IBT-026', 'unresolved', 'Group-level date requiredness cannot be resolved until preceding-invoice applicability is established.', ['invoice_type', 'preceding_invoice_reference']);
  },
  'IBT-031': (_obligation, _context, input) => evaluateSellerIdentifier('IBT-031', 'IBT-032', input),
  'IBT-032': (_obligation, _context, input) => evaluateSellerIdentifier('IBT-032', 'IBT-031', input),
  'IBT-113': (_obligation, _context, input) => {
    const paid = readNumber(input.header, ['paid_amount', 'paidAmount']);
    if (paid === null) {
      return decision('IBT-113', 'unresolved', 'No payment-state evidence is available to determine whether a paid amount applies.', ['paid_amount']);
    }
    return paid > 0
      ? decision('IBT-113', 'applicable', 'A positive amount was paid before or at issuance.', ['paid_amount'])
      : decision('IBT-113', 'not_applicable', 'The explicitly supplied paid amount is zero.', ['paid_amount']);
  },
  'BTAE-06': (_obligation, _context, input) => {
    const frequency = readText(input.header, ['billing_frequency', 'billingFrequency']);
    return frequency
      ? decision('BTAE-06', 'applicable', 'Billing-frequency evidence is present.', ['billing_frequency'])
      : decision('BTAE-06', 'unresolved', 'DCS cannot determine whether billing frequency applies from the available source data.', ['billing_frequency']);
  },
  'IBT-022': (_obligation, _context, input) => {
    const frequency = readText(input.header, ['billing_frequency', 'billingFrequency']);
    if (!frequency) {
      return decision('IBT-022', 'unresolved', 'Billing frequency is unavailable, so the Others condition cannot be evaluated.', ['billing_frequency']);
    }
    return isOtherFrequency(frequency)
      ? decision('IBT-022', 'applicable', "Billing frequency is 'Others', so an invoice note is required.", ['billing_frequency'])
      : decision('IBT-022', 'not_applicable', "Billing frequency is not 'Others'.", ['billing_frequency']);
  },
};

export function evaluateObligationApplicability(
  termId: string,
  input: ScenarioInvoiceInput,
  context: ScenarioContext = buildScenarioContext(input)
): ObligationApplicabilityDecision | undefined {
  const obligation = getRegulatoryObligation(termId);
  if (!obligation) return undefined;
  const evaluator = EVALUATORS[obligation.termId];
  if (evaluator) return evaluator(obligation, context, input);
  if (obligation.applicability.kind === 'always') {
    return decision(obligation.termId, 'applicable', 'The obligation is defined as always applicable.', []);
  }
  return decision(obligation.termId, 'unresolved', 'No shadow evaluator is registered for this conditional obligation.', []);
}

export function buildObligationApplicabilityReport(
  input: ScenarioInvoiceInput
): ObligationApplicabilityReport {
  const context = buildScenarioContext(input);
  const decisions = getRegulatoryObligations().map((obligation) => {
    const result = evaluateObligationApplicability(obligation.termId, input, context);
    if (!result) throw new Error(`Missing applicability decision for ${obligation.termId}`);
    return result;
  });
  return {
    context,
    decisions,
    summary: {
      applicable: decisions.filter((item) => item.state === 'applicable').length,
      not_applicable: decisions.filter((item) => item.state === 'not_applicable').length,
      unresolved: decisions.filter((item) => item.state === 'unresolved').length,
    },
    shadow: true,
    authoritative: false,
  };
}

function evaluateCreditNoteTerm(context: ScenarioContext, label: string): ObligationApplicabilityDecision {
  if (isCreditNote(context.documentVariant.value)) {
    return decision('BTAE-03', 'applicable', `${label} applies to the classified credit-note variant.`, ['invoice_type']);
  }
  if (isKnownNonCredit(context.documentVariant.value)) {
    return decision('BTAE-03', 'not_applicable', `${label} does not apply to the classified non-credit document.`, ['invoice_type']);
  }
  return decision('BTAE-03', 'unresolved', 'The document variant is unknown.', ['invoice_type']);
}

function evaluateSellerIdentifier(
  termId: 'IBT-031' | 'IBT-032',
  alternativeId: 'IBT-031' | 'IBT-032',
  input: ScenarioInvoiceInput
): ObligationApplicabilityDecision {
  const vatId = readText(input.header, ['seller_trn', 'sellerTrn']);
  const taxId = readText(input.header, ['seller_tax_registration_id', 'sellerTaxRegistrationId', 'seller_tin']);
  const ownPresent = termId === 'IBT-031' ? Boolean(vatId) : Boolean(taxId);
  const alternativePresent = termId === 'IBT-031' ? Boolean(taxId) : Boolean(vatId);
  if (ownPresent) return decision(termId, 'applicable', `${termId} is the supplied seller identifier alternative.`, [termId === 'IBT-031' ? 'seller_trn' : 'seller_tax_registration_id']);
  if (alternativePresent) return decision(termId, 'not_applicable', `${alternativeId} satisfies the seller identifier alternative group.`, [alternativeId === 'IBT-031' ? 'seller_trn' : 'seller_tax_registration_id']);
  return decision(termId, 'unresolved', `Neither ${termId} nor ${alternativeId} is available; the required alternative cannot be selected.`, ['seller_trn', 'seller_tax_registration_id']);
}

function decision(
  termId: string,
  state: ObligationApplicabilityState,
  reason: string,
  evidenceFields: string[]
): ObligationApplicabilityDecision {
  return { termId, state, reason, evidenceFields, shadow: true, authoritative: false };
}

function isCreditNote(variant: ScenarioDocumentVariant): boolean {
  return variant === 'credit_note' || variant === 'self_billing_credit_note' || variant === 'commercial_credit_note';
}

function isKnownNonCredit(variant: ScenarioDocumentVariant): boolean {
  return variant !== 'unknown' && !isCreditNote(variant);
}

function isOtherFrequency(value: string): boolean {
  return ['other', 'others', 'oth'].includes(value.trim().toLowerCase());
}

function readText(source: object, keys: string[]): string {
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function readNumber(source: object, keys: string[]): number | null {
  const value = readText(source, keys);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
