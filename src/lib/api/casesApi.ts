import { supabase } from '@/integrations/supabase/client';
import { 
  Case, 
  CaseNote, 
  CaseStatus, 
  OwnerTeam, 
  InvoiceLifecycleEvent, 
  InvoiceStatus,
  Rejection,
  RejectionCategory,
  RootCauseOwner,
  ClientHealth,
  SLAMetrics,
  LifecycleMetrics,
  SLA_HOURS_BY_SEVERITY
} from '@/types/cases';
import { Severity } from '@/types/compliance';

// Generate case number
function generateCaseNumber(): string {
  const date = new Date();
  const prefix = 'CASE';
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${datePart}-${random}`;
}

// ============ CASES ============

export async function createCase(params: {
  invoice_id: string;
  invoice_number?: string;
  seller_trn?: string;
  buyer_id?: string;
  exception_id?: string;
  check_name?: string;
  severity: Severity;
  owner_team: OwnerTeam;
}): Promise<Case | null> {
  const slaHours = SLA_HOURS_BY_SEVERITY[params.severity] || 24;
  const slaTargetAt = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('cases')
    .insert({
      case_number: generateCaseNumber(),
      invoice_id: params.invoice_id,
      invoice_number: params.invoice_number,
      seller_trn: params.seller_trn,
      buyer_id: params.buyer_id,
      exception_id: params.exception_id,
      check_name: params.check_name,
      severity: params.severity,
      owner_team: params.owner_team,
      sla_hours: slaHours,
      sla_target_at: slaTargetAt,
      status: 'Open',
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating case:', error);
    return null;
  }

  return data as unknown as Case;
}

export async function fetchCases(filters?: {
  status?: CaseStatus;
  owner_team?: OwnerTeam;
  is_sla_breached?: boolean;
  seller_trn?: string;
}): Promise<Case[]> {
  let query = supabase.from('cases').select('*').order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.owner_team) query = query.eq('owner_team', filters.owner_team);
  if (filters?.is_sla_breached !== undefined) query = query.eq('is_sla_breached', filters.is_sla_breached);
  if (filters?.seller_trn) query = query.eq('seller_trn', filters.seller_trn);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching cases:', error);
    return [];
  }
  return (data || []) as unknown as Case[];
}

export async function fetchCaseByInvoice(invoiceId: string): Promise<Case | null> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching case:', error);
    return null;
  }
  return data as unknown as Case;
}

export async function updateCase(id: string, updates: Partial<Case>): Promise<boolean> {
  const updateData: any = { ...updates };
  
  if (updates.status === 'Resolved' && !updates.resolved_at) {
    updateData.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase.from('cases').update(updateData).eq('id', id);
  if (error) {
    console.error('Error updating case:', error);
    return false;
  }
  return true;
}

export async function addCaseNote(caseId: string, note: string, createdBy?: string): Promise<CaseNote | null> {
  const { data, error } = await supabase
    .from('case_notes')
    .insert({ case_id: caseId, note, created_by: createdBy } as any)
    .select()
    .single();

  if (error) {
    console.error('Error adding case note:', error);
    return null;
  }
  return data as unknown as CaseNote;
}

export async function fetchCaseNotes(caseId: string): Promise<CaseNote[]> {
  const { data, error } = await supabase
    .from('case_notes')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching case notes:', error);
    return [];
  }
  return (data || []) as unknown as CaseNote[];
}

export async function getSLAMetrics(): Promise<SLAMetrics> {
  const { data: cases, error } = await supabase.from('cases').select('*');
  
  if (error || !cases) {
    return { averageResolutionHours: {}, breachPercentage: 0, totalCases: 0, breachedCases: 0, openCases: 0, resolvedCases: 0 };
  }

  const allCases = cases as unknown as Case[];
  const resolved = allCases.filter(c => c.status === 'Resolved' && c.resolved_at);
  const breached = allCases.filter(c => c.is_sla_breached);
  const open = allCases.filter(c => c.status !== 'Resolved');

  const avgBySeverity: Record<string, number[]> = { Critical: [], High: [], Medium: [], Low: [] };
  resolved.forEach(c => {
    const created = new Date(c.created_at).getTime();
    const resolvedAt = new Date(c.resolved_at!).getTime();
    const hours = (resolvedAt - created) / (1000 * 60 * 60);
    avgBySeverity[c.severity]?.push(hours);
  });

  const averageResolutionHours: Record<string, number> = {};
  Object.entries(avgBySeverity).forEach(([sev, hours]) => {
    if (hours.length > 0) {
      averageResolutionHours[sev] = hours.reduce((a, b) => a + b, 0) / hours.length;
    }
  });

  return {
    averageResolutionHours,
    breachPercentage: allCases.length > 0 ? (breached.length / allCases.length) * 100 : 0,
    totalCases: allCases.length,
    breachedCases: breached.length,
    openCases: open.length,
    resolvedCases: resolved.length,
  };
}

// ============ LIFECYCLE ============

export async function addLifecycleEvent(params: {
  invoice_id: string;
  invoice_number?: string;
  seller_trn: string;
  buyer_id?: string;
  status: InvoiceStatus;
  previous_status?: string;
  changed_by?: string;
  notes?: string;
}): Promise<InvoiceLifecycleEvent | null> {
  const { data, error } = await supabase
    .from('invoice_lifecycle')
    .insert(params as any)
    .select()
    .single();

  if (error) {
    console.error('Error adding lifecycle event:', error);
    return null;
  }
  return data as unknown as InvoiceLifecycleEvent;
}

export async function fetchLifecycleEvents(invoiceId: string): Promise<InvoiceLifecycleEvent[]> {
  const { data, error } = await supabase
    .from('invoice_lifecycle')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching lifecycle events:', error);
    return [];
  }
  return (data || []) as unknown as InvoiceLifecycleEvent[];
}

export async function getLifecycleMetrics(): Promise<LifecycleMetrics> {
  const { data, error } = await supabase
    .from('invoice_lifecycle')
    .select('invoice_id, status')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { statusCounts: {} as Record<InvoiceStatus, number>, totalInvoices: 0 };
  }

  // Get latest status per invoice
  const latestByInvoice = new Map<string, InvoiceStatus>();
  (data as any[]).forEach(row => {
    if (!latestByInvoice.has(row.invoice_id)) {
      latestByInvoice.set(row.invoice_id, row.status);
    }
  });

  const statusCounts: Record<InvoiceStatus, number> = {
    'Received': 0, 'Pre-Validated': 0, 'Held': 0, 'Submitted': 0,
    'Acknowledged': 0, 'Accepted': 0, 'Rejected': 0, 'Resolved': 0,
    'Resubmitted': 0, 'Closed': 0
  };

  latestByInvoice.forEach(status => {
    statusCounts[status]++;
  });

  return { statusCounts, totalInvoices: latestByInvoice.size };
}

// ============ REJECTIONS ============

export async function createRejection(params: {
  invoice_id: string;
  invoice_number?: string;
  seller_trn: string;
  rejection_code: string;
  rejection_category: RejectionCategory;
  root_cause_owner?: RootCauseOwner;
  description?: string;
}): Promise<Rejection | null> {
  // Check for repeat
  const { data: existing } = await supabase
    .from('rejections')
    .select('id')
    .eq('invoice_id', params.invoice_id)
    .eq('rejection_code', params.rejection_code)
    .limit(1);

  const isRepeat = (existing?.length || 0) > 0;
  const originalId = isRepeat ? (existing as any)[0].id : null;

  const { data, error } = await supabase
    .from('rejections')
    .insert({
      ...params,
      is_repeat: isRepeat,
      original_rejection_id: originalId,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating rejection:', error);
    return null;
  }
  return data as unknown as Rejection;
}

export async function fetchRejections(sellerTrn?: string): Promise<Rejection[]> {
  let query = supabase.from('rejections').select('*').order('created_at', { ascending: false });
  if (sellerTrn) query = query.eq('seller_trn', sellerTrn);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching rejections:', error);
    return [];
  }
  return (data || []) as unknown as Rejection[];
}

export async function getRejectionAnalytics(): Promise<{
  byCategory: Record<string, number>;
  byClient: { seller_trn: string; count: number; rate: number }[];
  repeatRate: number;
  totalRejections: number;
}> {
  const { data: rejections, error } = await supabase.from('rejections').select('*');
  
  if (error || !rejections) {
    return { byCategory: {}, byClient: [], repeatRate: 0, totalRejections: 0 };
  }

  const all = rejections as unknown as Rejection[];
  const byCategory: Record<string, number> = {};
  const byClient = new Map<string, number>();
  let repeatCount = 0;

  all.forEach(r => {
    byCategory[r.rejection_category] = (byCategory[r.rejection_category] || 0) + 1;
    byClient.set(r.seller_trn, (byClient.get(r.seller_trn) || 0) + 1);
    if (r.is_repeat) repeatCount++;
  });

  return {
    byCategory,
    byClient: Array.from(byClient.entries())
      .map(([seller_trn, count]) => ({ seller_trn, count, rate: count / all.length }))
      .sort((a, b) => b.count - a.count),
    repeatRate: all.length > 0 ? (repeatCount / all.length) * 100 : 0,
    totalRejections: all.length,
  };
}

// ============ CLIENT HEALTH ============

export async function calculateClientHealth(sellerTrn: string, clientName?: string): Promise<ClientHealth | null> {
  // Get cases for this client
  const { data: cases } = await supabase.from('cases').select('*').eq('seller_trn', sellerTrn);
  const { data: rejections } = await supabase.from('rejections').select('*').eq('seller_trn', sellerTrn);
  const { data: lifecycle } = await supabase.from('invoice_lifecycle').select('invoice_id').eq('seller_trn', sellerTrn);

  const allCases = (cases || []) as unknown as Case[];
  const allRejections = (rejections || []) as unknown as Rejection[];
  const uniqueInvoices = new Set((lifecycle || []).map((l: any) => l.invoice_id)).size;

  const criticalIssues = allCases.filter(c => c.severity === 'Critical').length;
  const slaBreaches = allCases.filter(c => c.is_sla_breached).length;
  const rejectionRate = uniqueInvoices > 0 ? allRejections.length / uniqueInvoices : 0;

  // Calculate score: start at 100, deduct for issues
  let score = 100;
  score -= criticalIssues * 10; // -10 per critical
  score -= slaBreaches * 5; // -5 per SLA breach
  score -= rejectionRate * 50; // -50 for 100% rejection rate
  score = Math.max(0, Math.min(100, score));

  const { data, error } = await supabase
    .from('client_health')
    .upsert({
      seller_trn: sellerTrn,
      client_name: clientName,
      score,
      rejection_rate: rejectionRate,
      critical_issues: criticalIssues,
      sla_breaches: slaBreaches,
      total_invoices: uniqueInvoices,
      total_rejections: allRejections.length,
      calculated_at: new Date().toISOString(),
    } as any, { onConflict: 'seller_trn' })
    .select()
    .single();

  if (error) {
    console.error('Error calculating client health:', error);
    return null;
  }
  return data as unknown as ClientHealth;
}

export async function fetchClientHealthScores(): Promise<ClientHealth[]> {
  const { data, error } = await supabase
    .from('client_health')
    .select('*')
    .order('score', { ascending: true });

  if (error) {
    console.error('Error fetching client health:', error);
    return [];
  }
  return (data || []) as unknown as ClientHealth[];
}

// Update SLA breach status for open cases
export async function updateSLABreaches(): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('cases')
    .update({ is_sla_breached: true })
    .neq('status', 'Resolved')
    .lt('sla_target_at', now)
    .eq('is_sla_breached', false);
}
