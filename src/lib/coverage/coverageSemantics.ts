import type { CoverageStatus } from '@/lib/coverage/conformanceEngine';

export const COVERAGE_DIMENSIONS = {
  source: {
    label: 'MoF source coverage',
    description: 'Whether source fields can supply the selected MoF crosswalk target.',
  },
  runtime: {
    label: 'Runtime control coverage',
    description: 'Whether DCS has an implemented validation rule and linked control for a registry term.',
  },
  unsupported: {
    label: 'Not evaluated by DCS',
    description: 'Registry terms with no direct or indirect runtime rule. Applicability is not inferred by this status.',
  },
} as const;

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  COVERED: 'Runtime controlled',
  INDIRECT_RULE: 'Indirect runtime coverage',
  NO_CONTROL: 'Rule without control',
  NO_RULE: 'Not evaluated by DCS',
  NOT_IN_TEMPLATE: 'Source not available',
};
