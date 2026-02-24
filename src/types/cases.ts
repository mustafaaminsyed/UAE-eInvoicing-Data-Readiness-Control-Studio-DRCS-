export type InvoiceStatus = 
  | 'Received' 
  | 'Pre-Validated' 
  | 'Held' 
  | 'Submitted' 
  | 'Acknowledged' 
  | 'Accepted' 
  | 'Rejected' 
  | 'Resolved' 
  | 'Resubmitted' 
  | 'Closed';

export type CaseStatus = 'Open' | 'In Progress' | 'Waiting' | 'Resolved';

export type OwnerTeam = 'ASP Ops' | 'Client Finance' | 'Client IT' | 'Buyer-side';

export type RejectionCategory = 
  | 'Data Quality' 
  | 'Schema Validation' 
  | 'Business Rules' 
  | 'Buyer Validation' 
  | 'Tax Authority' 
  | 'Technical' 
  | 'Other';

export type RootCauseOwner = 'ASP Ops' | 'Client Finance' | 'Client IT' | 'Buyer-side' | 'Tax Authority' | 'System';

export interface InvoiceLifecycleEvent {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  seller_trn: string;
  buyer_id?: string;
  status: InvoiceStatus;
  previous_status?: string;
  changed_by?: string;
  notes?: string;
  created_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  invoice_id: string;
  invoice_number?: string;
  seller_trn?: string;
  buyer_id?: string;
  exception_id?: string;
  check_name?: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  owner_team: OwnerTeam;
  sla_hours: number;
  sla_target_at?: string;
  status: CaseStatus;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  is_sla_breached: boolean;
}

export interface CaseNote {
  id: string;
  case_id: string;
  note: string;
  created_by?: string;
  created_at: string;
}

export interface Rejection {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  seller_trn: string;
  rejection_code: string;
  rejection_category: RejectionCategory;
  root_cause_owner?: RootCauseOwner;
  description?: string;
  is_repeat: boolean;
  original_rejection_id?: string;
  created_at: string;
  resolved_at?: string;
}

export interface ClientHealth {
  id: string;
  seller_trn: string;
  client_name?: string;
  score: number;
  rejection_rate: number;
  critical_issues: number;
  sla_breaches: number;
  total_invoices: number;
  total_rejections: number;
  calculated_at: string;
}

export interface SLAMetrics {
  averageResolutionHours: Record<string, number>;
  breachPercentage: number;
  totalCases: number;
  breachedCases: number;
  openCases: number;
  resolvedCases: number;
}

export interface LifecycleMetrics {
  statusCounts: Record<InvoiceStatus, number>;
  totalInvoices: number;
}

// SLA hours by severity
export const SLA_HOURS_BY_SEVERITY: Record<string, number> = {
  Critical: 4,
  High: 8,
  Medium: 24,
  Low: 48,
};
