export type RegulatoryResponsibility =
  | 'taxpayer_source'
  | 'dcs_derived'
  | 'fixed_configuration'
  | 'asp_generated'
  | 'unresolved';

const LEGACY_TO_CANONICAL_TERM = {
  'BTUAE-02': 'BTAE-02',
  'BTUAE-08': 'BTAE-08',
  'BTUAE-15': 'BTAE-15',
} as const;

type LegacyPintTerm = keyof typeof LEGACY_TO_CANONICAL_TERM;

const CANONICAL_TO_LEGACY_TERM = Object.fromEntries(
  Object.entries(LEGACY_TO_CANONICAL_TERM).map(([legacy, canonical]) => [canonical, legacy])
) as Record<string, LegacyPintTerm>;

export function canonicalizePintTermId(termId: string): string {
  const normalized = termId.trim().toUpperCase();
  return LEGACY_TO_CANONICAL_TERM[normalized as LegacyPintTerm] ?? normalized;
}

export function getLegacyPintTermAliases(termId: string): string[] {
  const canonical = canonicalizePintTermId(termId);
  const legacy = CANONICAL_TO_LEGACY_TERM[canonical];
  return legacy ? [legacy] : [];
}

export function getCompatiblePintTermIds(termId: string): string[] {
  const canonical = canonicalizePintTermId(termId);
  return [canonical, ...getLegacyPintTermAliases(canonical)];
}

export function pintTermIdsEqual(left: string, right: string): boolean {
  return canonicalizePintTermId(left) === canonicalizePintTermId(right);
}

export interface ResponsibilityProfile {
  termId: string;
  responsibility: RegulatoryResponsibility;
  rationale: string;
  sourceRequired: boolean;
}

const RESPONSIBILITY_OVERRIDES: Record<string, Omit<ResponsibilityProfile, 'termId'>> = {
  'BTAE-07': {
    responsibility: 'asp_generated',
    rationale: 'The UAE e-invoicing guidance assigns invoice UUID generation to the ASP.',
    sourceRequired: false,
  },
};

export function getResponsibilityProfile(termId: string): ResponsibilityProfile | undefined {
  const canonical = canonicalizePintTermId(termId);
  const profile = RESPONSIBILITY_OVERRIDES[canonical];
  return profile ? { termId: canonical, ...profile } : undefined;
}

export function classifyRegistryResponsibility(
  dataResponsibility: string,
  options: { derived?: boolean; fixedConfiguration?: boolean } = {}
): RegulatoryResponsibility {
  if (options.fixedConfiguration) return 'fixed_configuration';
  if (options.derived) return 'dcs_derived';

  const normalized = dataResponsibility.trim().toLowerCase();
  if (normalized.includes('asp')) return 'asp_generated';
  if (normalized.includes('erp') || normalized.includes('taxpayer')) return 'taxpayer_source';
  return 'unresolved';
}

