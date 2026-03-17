import type { PintAECheck } from '@/types/pintAE';

export const OVERLAY_RUNTIME_CHECKS: PintAECheck[] = [
  {
    check_id: 'IBR-137-AE',
    check_name: 'Disclosed Agent Principal ID Requirement',
    description:
      'Requires the principal identifier when the invoice transaction type code indicates disclosed-agent billing.',
    scope: 'Header',
    rule_type: 'dependency_rule',
    execution_layer: 'dependency_rule',
    severity: 'Critical',
    use_case: 'Overlay Family',
    pint_reference_terms: ['BTUAE-02', 'BTAE-14'],
    owner_team_default: 'Client IT',
    suggested_fix: 'Populate the principal identifier for disclosed-agent billing invoices.',
    evidence_required: 'Principal identifier carried in the canonical invoice header.',
    is_enabled: true,
    parameters: {},
  },
  {
    check_id: 'IBR-138-AE',
    check_name: 'Summary Invoice Invoicing Period Requirement',
    description:
      'Requires invoicing-period data when the invoice transaction type code indicates a summary invoice.',
    scope: 'Header',
    rule_type: 'dependency_rule',
    execution_layer: 'dependency_rule',
    severity: 'Critical',
    use_case: 'Overlay Family',
    pint_reference_terms: ['BTUAE-02', 'IBG-14'],
    owner_team_default: 'Client IT',
    suggested_fix: 'Populate the invoicing-period start or end date for summary invoices.',
    evidence_required: 'Invoicing-period fields carried in the canonical invoice header.',
    is_enabled: true,
    parameters: {},
  },
  {
    check_id: 'IBR-152-AE',
    check_name: 'Export Delivery Information Requirement',
    description:
      'Requires delivery information when the invoice transaction type code indicates an export scenario.',
    scope: 'Header',
    rule_type: 'dependency_rule',
    execution_layer: 'dependency_rule',
    severity: 'Critical',
    use_case: 'Overlay Family',
    pint_reference_terms: ['BTUAE-02', 'IBG-13', 'IBT-075', 'IBT-077', 'IBT-079', 'IBT-080'],
    owner_team_default: 'Client IT',
    suggested_fix: 'Populate delivery information fields and ensure the deliver-to country code is not AE for exports.',
    evidence_required: 'Deliver-to and delivery-information fields carried in the canonical invoice header.',
    is_enabled: true,
    parameters: {},
  },
];

export const OVERLAY_RUNTIME_RULE_IDS = OVERLAY_RUNTIME_CHECKS.map((check) => check.check_id);
