import { Severity } from './compliance';
import { DatasetType } from './datasets';

// PINT-AE Check Scope
export type CheckScope = 'Header' | 'Lines' | 'Party' | 'Cross';

// PINT-AE Rule Types
export type RuleType = 'Presence' | 'Format' | 'CodeList' | 'Math' | 'Dependency' | 'CrossCheck';

// Owner Teams
export type OwnerTeam = 'ASP Ops' | 'Client Finance' | 'Client IT' | 'Buyer-side';

// Exception Case Status
export type ExceptionCaseStatus = 'Open' | 'In Progress' | 'Waiting on Client' | 'Resolved' | 'Closed';

// Root Cause Categories
export type RootCauseCategory = 
  | 'Unclassified' 
  | 'Data Entry Error' 
  | 'System Integration Issue'
  | 'Missing Master Data'
  | 'Calculation Error'
  | 'Format Non-Compliance'
  | 'Business Rule Violation'
  | 'Buyer Data Issue';

// PINT-AE Check Definition
export interface PintAECheck {
  id?: string;
  check_id: string;
  check_name: string;
  description?: string;
  scope: CheckScope;
  rule_type: RuleType;
  severity: Severity;
  use_case?: string;
  pint_reference_terms: string[];
  mof_rule_reference?: string;
  pass_condition?: string;
  fail_condition?: string;
  owner_team_default: OwnerTeam;
  suggested_fix?: string;
  evidence_required?: string;
  is_enabled: boolean;
  parameters: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// Enhanced Exception with PINT-AE fields
export interface PintAEException {
  id: string;
  run_id?: string;
  timestamp: string;
  dataset_type?: DatasetType;
  check_id: string;
  check_name: string;
  severity: Severity;
  scope?: CheckScope;
  rule_type?: RuleType;
  use_case?: string;
  pint_reference_terms: string[];
  invoice_id?: string;
  invoice_number?: string;
  seller_trn?: string;
  buyer_id?: string;
  line_id?: string;
  field_name?: string;
  observed_value?: string;
  expected_value_or_rule?: string;
  message: string;
  suggested_fix?: string;
  root_cause_category: RootCauseCategory;
  owner_team: OwnerTeam;
  sla_target_hours: number;
  case_status: ExceptionCaseStatus;
  case_id?: string;
}

// Run Summary
export interface RunSummary {
  id?: string;
  run_id: string;
  total_invoices_tested: number;
  total_exceptions: number;
  pass_rate_percent: number;
  exceptions_by_severity: Record<Severity, number>;
  top_10_failing_checks: { check_id: string; check_name: string; count: number }[];
  top_10_clients_by_risk: { seller_trn: string; client_name?: string; risk_score: number; health_score: number }[];
}

// Client Risk Score
export interface ClientRiskScore {
  id?: string;
  run_id: string;
  seller_trn: string;
  client_name?: string;
  risk_score: number;
  health_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_exceptions: number;
  total_invoices: number;
}

// Risk Scoring Constants
export const RISK_WEIGHTS: Record<Severity, number> = {
  Critical: 10,
  High: 6,
  Medium: 3,
  Low: 1,
};

// SLA Hours by Severity
export const SLA_HOURS_BY_SEVERITY: Record<Severity, number> = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
};

// Calculate risk score
export function calculateRiskScore(
  criticalCount: number,
  highCount: number,
  mediumCount: number,
  lowCount: number
): number {
  return (
    criticalCount * RISK_WEIGHTS.Critical +
    highCount * RISK_WEIGHTS.High +
    mediumCount * RISK_WEIGHTS.Medium +
    lowCount * RISK_WEIGHTS.Low
  );
}

// Calculate health score (0-100)
export function calculateHealthScore(riskScore: number, totalInvoices: number): number {
  if (totalInvoices === 0) return 100;
  // Normalize: max risk per invoice ~ 50 points, so we scale accordingly
  const normalizedRisk = (riskScore / totalInvoices) * 2;
  return Math.max(0, Math.min(100, Math.round(100 - normalizedRisk)));
}
