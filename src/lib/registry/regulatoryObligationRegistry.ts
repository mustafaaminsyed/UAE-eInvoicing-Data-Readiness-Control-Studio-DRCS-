import {
  canonicalizePintTermId,
  type RegulatoryResponsibility,
} from '@/lib/registry/pintTermGovernance';

export type ObligationApplicability =
  | { kind: 'always' }
  | { kind: 'conditional'; condition: string; dependsOn: string[] }
  | { kind: 'alternative'; groupId: string; minimumRequired: number; alternatives: string[] };

export type AcquisitionMethod =
  | 'source_field'
  | 'derived_value'
  | 'fixed_configuration'
  | 'asp_generation'
  | 'not_yet_decided';

export type ObligationImplementationState =
  | 'implemented'
  | 'partially_implemented'
  | 'not_implemented'
  | 'external_boundary';

export interface RegulatoryObligation {
  termId: string;
  businessTerm: string;
  responsibility: RegulatoryResponsibility;
  applicability: ObligationApplicability;
  acquisitionMethod: AcquisitionMethod;
  implementationState: ObligationImplementationState;
  sourceFields: string[];
  ruleReferences: string[];
  evidence: string;
  implementationNote: string;
}

const OBLIGATIONS: readonly RegulatoryObligation[] = [
  {
    termId: 'BTAE-07',
    businessTerm: 'Invoice unique identifier',
    responsibility: 'asp_generated',
    applicability: { kind: 'always' },
    acquisitionMethod: 'asp_generation',
    implementationState: 'external_boundary',
    sourceFields: [],
    ruleReferences: ['IBR-193-AE'],
    evidence: 'The identifier is mandatory in the output document but generated at the ASP boundary.',
    implementationNote: 'Do not request this as taxpayer upload data; capture ASP output evidence when that boundary is implemented.',
  },
  {
    termId: 'BTAE-03',
    businessTerm: 'Credit note reason code',
    responsibility: 'taxpayer_source',
    applicability: { kind: 'conditional', condition: 'Invoice type is a credit note.', dependsOn: ['IBT-003'] },
    acquisitionMethod: 'source_field',
    implementationState: 'implemented',
    sourceFields: ['headers.credit_note_reason_code'],
    ruleReferences: ['IBR-158-AE', 'UAE-UC1-CHK-055', 'UAE-UC1-CHK-058'],
    evidence: 'Current checks require and validate the reason code only in credit-note context.',
    implementationNote: 'Retain conditional treatment; it is not a universal invoice-header requirement.',
  },
  {
    termId: 'IBT-025',
    businessTerm: 'Preceding invoice reference',
    responsibility: 'taxpayer_source',
    applicability: {
      kind: 'conditional',
      condition: 'Invoice type is 381 or 81, except where credit note reason code is VD.',
      dependsOn: ['IBT-003', 'BTAE-03'],
    },
    acquisitionMethod: 'source_field',
    implementationState: 'implemented',
    sourceFields: ['headers.preceding_invoice_reference'],
    ruleReferences: ['IBR-055-AE', 'UAE-UC1-CHK-056'],
    evidence: 'The runtime check models the credit-note and VD exception condition.',
    implementationNote: 'Keep the field optional at upload and evaluate it after document context is known.',
  },
  {
    termId: 'IBT-026',
    businessTerm: 'Preceding invoice issue date',
    responsibility: 'taxpayer_source',
    applicability: {
      kind: 'conditional',
      condition: 'A preceding-invoice reference group is supplied and its issue date is required by the selected profile.',
      dependsOn: ['IBT-025'],
    },
    acquisitionMethod: 'source_field',
    implementationState: 'partially_implemented',
    sourceFields: ['headers.preceding_invoice_issue_date'],
    ruleReferences: ['UAE-UC1-CHK-057'],
    evidence: 'DCS validates the date format when populated but does not yet model the complete group-level obligation.',
    implementationNote: 'Add group-aware applicability in Phase 2B before changing requiredness.',
  },
  {
    termId: 'IBT-031',
    businessTerm: 'Seller VAT identifier',
    responsibility: 'taxpayer_source',
    applicability: {
      kind: 'alternative',
      groupId: 'seller-tax-identifier',
      minimumRequired: 1,
      alternatives: ['IBT-031', 'IBT-032'],
    },
    acquisitionMethod: 'source_field',
    implementationState: 'partially_implemented',
    sourceFields: ['headers.seller_trn'],
    ruleReferences: ['IBR-177-AE', 'IBR-132-AE', 'UAE-UC1-CHK-013'],
    evidence: 'DCS supports UAE VAT/TRN capture and validation but currently treats that path as the primary source.',
    implementationNote: 'Model the IBT-032 alternative before asserting complete seller-identifier coverage.',
  },
  {
    termId: 'IBT-032',
    businessTerm: 'Seller tax registration identifier',
    responsibility: 'taxpayer_source',
    applicability: {
      kind: 'alternative',
      groupId: 'seller-tax-identifier',
      minimumRequired: 1,
      alternatives: ['IBT-031', 'IBT-032'],
    },
    acquisitionMethod: 'not_yet_decided',
    implementationState: 'not_implemented',
    sourceFields: [],
    ruleReferences: ['IBR-177-AE', 'IBR-148-AE'],
    evidence: 'The specification permits this identifier as the alternative to IBT-031; canonical ingestion has no dedicated field.',
    implementationNote: 'Decide whether to add a dedicated source field or a governed identifier abstraction.',
  },
  {
    termId: 'IBT-113',
    businessTerm: 'Paid amount',
    responsibility: 'taxpayer_source',
    applicability: {
      kind: 'conditional',
      condition: 'An amount has been paid before or at invoice issuance and must participate in payable-amount reconciliation.',
      dependsOn: ['IBT-115'],
    },
    acquisitionMethod: 'not_yet_decided',
    implementationState: 'not_implemented',
    sourceFields: [],
    ruleReferences: ['IBR-CO-16'],
    evidence: 'The term is absent from canonical ingestion and the current payable-amount equation.',
    implementationNote: 'Confirm the payment-state source and calculation behavior before adding an input.',
  },
  {
    termId: 'BTAE-06',
    businessTerm: 'Frequency of billing',
    responsibility: 'taxpayer_source',
    applicability: { kind: 'conditional', condition: 'A billing frequency is supplied for the invoice.', dependsOn: [] },
    acquisitionMethod: 'not_yet_decided',
    implementationState: 'not_implemented',
    sourceFields: [],
    ruleReferences: ['IBR-160-AE'],
    evidence: 'The conditional dependency exists in PINT-AE rules but is not modeled in canonical ingestion.',
    implementationNote: 'Assess source ownership and accepted codes before adding runtime enforcement.',
  },
  {
    termId: 'IBT-022',
    businessTerm: 'Invoice note',
    responsibility: 'taxpayer_source',
    applicability: {
      kind: 'conditional',
      condition: "Frequency of billing (BTAE-06) is 'Others'.",
      dependsOn: ['BTAE-06'],
    },
    acquisitionMethod: 'source_field',
    implementationState: 'partially_implemented',
    sourceFields: ['headers.note'],
    ruleReferences: ['IBR-160-AE'],
    evidence: 'A mapping target exists, but the canonical parser and conditional runtime rule are not yet reconciled.',
    implementationNote: 'Do not make the note universally mandatory; enforce it only after BTAE-06 is modeled.',
  },
] as const;

function assertRegistryIntegrity(entries: readonly RegulatoryObligation[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    const canonicalId = canonicalizePintTermId(entry.termId);
    if (canonicalId !== entry.termId) throw new Error(`Obligation term must be canonical: ${entry.termId}`);
    if (ids.has(canonicalId)) throw new Error(`Duplicate regulatory obligation: ${canonicalId}`);
    if (!entry.evidence.trim() || !entry.implementationNote.trim()) {
      throw new Error(`Obligation ${canonicalId} must include evidence and an implementation note.`);
    }
    ids.add(canonicalId);
  }
}

assertRegistryIntegrity(OBLIGATIONS);

export function getRegulatoryObligations(): RegulatoryObligation[] {
  return OBLIGATIONS.map((entry) => ({
    ...entry,
    sourceFields: [...entry.sourceFields],
    ruleReferences: [...entry.ruleReferences],
    applicability: entry.applicability.kind === 'conditional'
      ? { ...entry.applicability, dependsOn: [...entry.applicability.dependsOn] }
      : entry.applicability.kind === 'alternative'
        ? { ...entry.applicability, alternatives: [...entry.applicability.alternatives] }
        : { ...entry.applicability },
  }));
}

export function getRegulatoryObligation(termId: string): RegulatoryObligation | undefined {
  const canonicalId = canonicalizePintTermId(termId);
  return getRegulatoryObligations().find((entry) => entry.termId === canonicalId);
}

export function getRegulatoryObligationsByState(
  state: ObligationImplementationState
): RegulatoryObligation[] {
  return getRegulatoryObligations().filter((entry) => entry.implementationState === state);
}
