// =============================================================================
// Controls Registry — Links controls → rules → DRs
// Part E: Each control covers one or more rules; DR coverage is derived.
// =============================================================================

import { getRuleTraceability, RuleTraceEntry } from '@/lib/rules/ruleTraceability';

export type ControlType = 'preventive' | 'detective';

export interface ControlEntry {
  control_id: string;
  control_name: string;
  control_type: ControlType;
  description: string;
  covered_rule_ids: string[];
  /** Derived from covered rules' affected_dr_ids */
  covered_dr_ids: string[];
}

// ── Static controls registry ────────────────────────────────────────
// Each control covers specific validation rules. DR linkage is derived.
const CONTROLS_DEFINITION: Omit<ControlEntry, 'covered_dr_ids'>[] = [
  // ── Preventive Controls ──
  {
    control_id: 'CTRL-001',
    control_name: 'Header Mandatory Fields Gate',
    control_type: 'preventive',
    description: 'Blocks invoice submission when mandatory header identifiers are missing',
    covered_rule_ids: ['UAE-UC1-CHK-001', 'UAE-UC1-CHK-002', 'UAE-UC1-CHK-004', 'UAE-UC1-CHK-005'],
  },
  {
    control_id: 'CTRL-002',
    control_name: 'Date Format Enforcement',
    control_type: 'preventive',
    description: 'Ensures all dates conform to ISO 8601 YYYY-MM-DD format before processing',
    covered_rule_ids: ['UAE-UC1-CHK-003'],
  },
  {
    control_id: 'CTRL-003',
    control_name: 'Currency Code Validation',
    control_type: 'preventive',
    description: 'Validates currency codes against ISO 4217 and enforces AED tax accounting',
    covered_rule_ids: ['UAE-UC1-CHK-006', 'UAE-UC1-CHK-007', 'UAE-UC1-CHK-008'],
  },
  {
    control_id: 'CTRL-004',
    control_name: 'Seller Identity Verification',
    control_type: 'preventive',
    description: 'Ensures seller name, TRN, electronic address, and address are complete and valid',
    covered_rule_ids: ['UAE-UC1-CHK-012', 'UAE-UC1-CHK-013', 'UAE-UC1-CHK-014', 'UAE-UC1-CHK-015'],
  },
  {
    control_id: 'CTRL-005',
    control_name: 'Buyer Identity Verification',
    control_type: 'preventive',
    description: 'Ensures buyer name, TRN format, electronic address, and address are valid',
    covered_rule_ids: ['UAE-UC1-CHK-017', 'UAE-UC1-CHK-018', 'UAE-UC1-CHK-019', 'UAE-UC1-CHK-020'],
  },
  {
    control_id: 'CTRL-006',
    control_name: 'UAE Subdivision Code Gate',
    control_type: 'preventive',
    description: 'Validates emirate codes against the official UAE code list',
    covered_rule_ids: ['UAE-UC1-CHK-016'],
  },
  {
    control_id: 'CTRL-007',
    control_name: 'ASP Metadata Enforcement',
    control_type: 'preventive',
    description: 'Validates ASP-derived fields: specification ID and business process type',
    covered_rule_ids: ['UAE-UC1-CHK-010', 'UAE-UC1-CHK-011'],
  },
  {
    control_id: 'CTRL-008',
    control_name: 'Transaction Type Code Validation',
    control_type: 'preventive',
    description: 'Validates BTUAE-02 transaction type code format and presence',
    covered_rule_ids: ['UAE-UC1-CHK-004'], // Transaction type is validated as part of mandatory header fields
  },

  // ── Detective Controls ──
  {
    control_id: 'CTRL-009',
    control_name: 'Invoice Totals Reconciliation',
    control_type: 'detective',
    description: 'Detects mismatches between line sums and header totals',
    covered_rule_ids: ['UAE-UC1-CHK-021', 'UAE-UC1-CHK-025', 'UAE-UC1-CHK-029'],
  },
  {
    control_id: 'CTRL-010',
    control_name: 'Decimal Precision Audit',
    control_type: 'detective',
    description: 'Detects monetary amounts exceeding 2 decimal places',
    covered_rule_ids: ['UAE-UC1-CHK-022', 'UAE-UC1-CHK-023', 'UAE-UC1-CHK-024', 'UAE-UC1-CHK-026'],
  },
  {
    control_id: 'CTRL-011',
    control_name: 'Tax Calculation Verification',
    control_type: 'detective',
    description: 'Verifies tax category amounts match taxable base × rate formula',
    covered_rule_ids: ['UAE-UC1-CHK-027', 'UAE-UC1-CHK-028'],
  },
  {
    control_id: 'CTRL-012',
    control_name: 'Line Item Completeness Check',
    control_type: 'detective',
    description: 'Ensures every invoice has at least one line and each line has required identifiers and quantities',
    covered_rule_ids: ['UAE-UC1-CHK-030', 'UAE-UC1-CHK-031', 'UAE-UC1-CHK-032', 'UAE-UC1-CHK-033'],
  },
  {
    control_id: 'CTRL-013',
    control_name: 'Line Net Amount Reconciliation',
    control_type: 'detective',
    description: 'Validates line net amount = (quantity × unit price) - discounts + charges',
    covered_rule_ids: ['UAE-UC1-CHK-034'],
  },
  {
    control_id: 'CTRL-014',
    control_name: 'Payment Terms Consistency',
    control_type: 'detective',
    description: 'Ensures payment due date is present when amount due > 0 and is not before issue date',
    covered_rule_ids: ['UAE-UC1-CHK-009'],
  },
];

// ── Build registry with derived DR IDs ──────────────────────────────
function buildControlsRegistry(): ControlEntry[] {
  const ruleTrace = getRuleTraceability();
  const ruleMap = new Map<string, RuleTraceEntry>();
  ruleTrace.forEach(r => ruleMap.set(r.rule_id, r));

  return CONTROLS_DEFINITION.map(ctrl => {
    const drIds = new Set<string>();
    for (const ruleId of ctrl.covered_rule_ids) {
      const rule = ruleMap.get(ruleId);
      if (rule) {
        rule.affected_dr_ids.forEach(id => drIds.add(id));
      }
    }
    return {
      ...ctrl,
      covered_dr_ids: Array.from(drIds),
    };
  });
}

// Singleton
let _controls: ControlEntry[] | null = null;
export function getControlsRegistry(): ControlEntry[] {
  if (!_controls) _controls = buildControlsRegistry();
  return _controls;
}

/** Get all controls that cover a given DR ID */
export function getControlsForDR(drId: string): ControlEntry[] {
  return getControlsRegistry().filter(c => c.covered_dr_ids.includes(drId));
}

/** Get all controls that cover a given rule ID */
export function getControlsForRule(ruleId: string): ControlEntry[] {
  return getControlsRegistry().filter(c => c.covered_rule_ids.includes(ruleId));
}

/** Get DR IDs that have at least one control */
export function getDRsWithControls(): Set<string> {
  const ids = new Set<string>();
  getControlsRegistry().forEach(c => c.covered_dr_ids.forEach(id => ids.add(id)));
  return ids;
}
