import { supabase } from '@/integrations/supabase/client';
import { 
  PintAECheck, 
  PintAEException, 
  RunSummary, 
  ClientRiskScore,
  calculateRiskScore,
  calculateHealthScore 
} from '@/types/pintAE';
import { Severity } from '@/types/compliance';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

// ============ PINT-AE Checks CRUD ============

export async function fetchPintAEChecks(): Promise<PintAECheck[]> {
  const { data, error } = await supabase
    .from('pint_ae_checks')
    .select('*')
    .order('check_id', { ascending: true });

  if (error) {
    console.error('Error fetching PINT-AE checks:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    check_id: row.check_id,
    check_name: row.check_name,
    description: row.description || undefined,
    scope: row.scope as PintAECheck['scope'],
    rule_type: row.rule_type as PintAECheck['rule_type'],
    severity: row.severity as Severity,
    use_case: row.use_case || undefined,
    pint_reference_terms: row.pint_reference_terms || [],
    mof_rule_reference: row.mof_rule_reference || undefined,
    pass_condition: row.pass_condition || undefined,
    fail_condition: row.fail_condition || undefined,
    owner_team_default: row.owner_team_default as PintAECheck['owner_team_default'],
    suggested_fix: row.suggested_fix || undefined,
    evidence_required: row.evidence_required || undefined,
    is_enabled: row.is_enabled,
    parameters: (row.parameters as Record<string, any>) || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchEnabledPintAEChecks(): Promise<PintAECheck[]> {
  const { data, error } = await supabase
    .from('pint_ae_checks')
    .select('*')
    .eq('is_enabled', true)
    .order('check_id', { ascending: true });

  if (error) {
    console.error('Error fetching enabled PINT-AE checks:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    check_id: row.check_id,
    check_name: row.check_name,
    description: row.description || undefined,
    scope: row.scope as PintAECheck['scope'],
    rule_type: row.rule_type as PintAECheck['rule_type'],
    severity: row.severity as Severity,
    use_case: row.use_case || undefined,
    pint_reference_terms: row.pint_reference_terms || [],
    mof_rule_reference: row.mof_rule_reference || undefined,
    pass_condition: row.pass_condition || undefined,
    fail_condition: row.fail_condition || undefined,
    owner_team_default: row.owner_team_default as PintAECheck['owner_team_default'],
    suggested_fix: row.suggested_fix || undefined,
    evidence_required: row.evidence_required || undefined,
    is_enabled: row.is_enabled,
    parameters: (row.parameters as Record<string, any>) || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function upsertPintAECheck(check: PintAECheck): Promise<boolean> {
  const { error } = await supabase
    .from('pint_ae_checks')
    .upsert({
      check_id: check.check_id,
      check_name: check.check_name,
      description: check.description,
      scope: check.scope,
      rule_type: check.rule_type,
      severity: check.severity,
      use_case: check.use_case,
      pint_reference_terms: check.pint_reference_terms,
      mof_rule_reference: check.mof_rule_reference,
      pass_condition: check.pass_condition,
      fail_condition: check.fail_condition,
      owner_team_default: check.owner_team_default,
      suggested_fix: check.suggested_fix,
      evidence_required: check.evidence_required,
      is_enabled: check.is_enabled,
      parameters: check.parameters,
    }, { onConflict: 'check_id' });

  if (error) {
    console.error('Error upserting PINT-AE check:', error);
    return false;
  }
  return true;
}

export async function toggleCheckEnabled(checkId: string, isEnabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('pint_ae_checks')
    .update({ is_enabled: isEnabled })
    .eq('check_id', checkId);

  if (error) {
    console.error('Error toggling check:', error);
    return false;
  }
  return true;
}

export interface ChecksDiagnostics {
  totalChecks: number;
  enabledChecks: number;
  uc1ChecksPresent: boolean;
  uc1CheckCount: number;
  dataSource: 'supabase' | 'hardcoded' | 'none';
  lastSeedAttempt?: string;
  lastSeedResult?: 'success' | 'skipped' | 'error';
}

export async function getChecksDiagnostics(): Promise<ChecksDiagnostics> {
  const { data: allChecks } = await supabase
    .from('pint_ae_checks')
    .select('check_id, is_enabled');

  const checks = allChecks || [];
  const enabledChecks = checks.filter(c => c.is_enabled);
  const uc1Checks = checks.filter(c => c.check_id.startsWith('UAE-UC1-CHK-'));

  return {
    totalChecks: checks.length,
    enabledChecks: enabledChecks.length,
    uc1ChecksPresent: uc1Checks.length > 0,
    uc1CheckCount: uc1Checks.length,
    dataSource: checks.length > 0 ? 'supabase' : 'none',
  };
}

export async function seedUC1CheckPack(forceUpsert = false): Promise<{ success: boolean; message: string }> {
  console.log('[PINT-AE] Starting UC1 check pack seed...');
  
  // Check specifically if UC1 checks already exist
  const { data: existingUC1 } = await supabase
    .from('pint_ae_checks')
    .select('check_id')
    .ilike('check_id', 'UAE-UC1-CHK-%')
    .limit(1);

  if (existingUC1 && existingUC1.length > 0 && !forceUpsert) {
    console.log('[PINT-AE] UC1 checks already exist, skipping seed (use forceUpsert=true to update)');
    return { success: true, message: 'Seed skipped - UC1 checks already exist' };
  }

  // Prepare checks for upsert
  const checksToUpsert = UAE_UC1_CHECK_PACK.map(check => ({
    check_id: check.check_id,
    check_name: check.check_name,
    description: check.description,
    scope: check.scope,
    rule_type: check.rule_type,
    severity: check.severity,
    use_case: check.use_case,
    pint_reference_terms: check.pint_reference_terms,
    mof_rule_reference: check.mof_rule_reference,
    pass_condition: check.pass_condition,
    fail_condition: check.fail_condition,
    owner_team_default: check.owner_team_default,
    suggested_fix: check.suggested_fix,
    evidence_required: check.evidence_required,
    is_enabled: check.is_enabled,
    parameters: check.parameters,
  }));

  // Use upsert to handle both insert and update scenarios
  const { error } = await supabase
    .from('pint_ae_checks')
    .upsert(checksToUpsert, { onConflict: 'check_id' });

  if (error) {
    console.error('[PINT-AE] Error seeding UC1 check pack:', error);
    return { success: false, message: `Seed failed: ${error.message}` };
  }

  console.log('[PINT-AE] Successfully seeded/updated UC1 check pack with', checksToUpsert.length, 'checks');
  return { success: true, message: `Seeded ${checksToUpsert.length} UC1 checks` };
}

// ============ Exceptions CRUD ============

export async function saveExceptions(runId: string, exceptions: PintAEException[]): Promise<boolean> {
  if (exceptions.length === 0) return true;

  const exceptionsToInsert = exceptions.map(e => ({
    run_id: runId,
    timestamp: e.timestamp,
    check_id: e.check_id,
    check_name: e.check_name,
    severity: e.severity,
    scope: e.scope,
    rule_type: e.rule_type,
    use_case: e.use_case,
    pint_reference_terms: e.pint_reference_terms,
    invoice_id: e.invoice_id,
    invoice_number: e.invoice_number,
    seller_trn: e.seller_trn,
    buyer_id: e.buyer_id,
    line_id: e.line_id,
    field_name: e.field_name,
    observed_value: e.observed_value,
    expected_value_or_rule: e.expected_value_or_rule,
    message: e.message,
    suggested_fix: e.suggested_fix,
    root_cause_category: e.root_cause_category,
    owner_team: e.owner_team,
    sla_target_hours: e.sla_target_hours,
    case_status: e.case_status,
    case_id: e.case_id,
  }));

  const { error } = await supabase
    .from('check_exceptions')
    .insert(exceptionsToInsert);

  if (error) {
    console.error('Error saving exceptions:', error);
    return false;
  }
  return true;
}

export async function fetchExceptionsByRun(runId: string): Promise<PintAEException[]> {
  const { data, error } = await supabase
    .from('check_exceptions')
    .select('*')
    .eq('run_id', runId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching exceptions:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    run_id: row.run_id || undefined,
    timestamp: row.timestamp,
    check_id: row.check_id,
    check_name: row.check_name,
    severity: row.severity as Severity,
    scope: row.scope as PintAEException['scope'],
    rule_type: row.rule_type as PintAEException['rule_type'],
    use_case: row.use_case || undefined,
    pint_reference_terms: row.pint_reference_terms || [],
    invoice_id: row.invoice_id || undefined,
    invoice_number: row.invoice_number || undefined,
    seller_trn: row.seller_trn || undefined,
    buyer_id: row.buyer_id || undefined,
    line_id: row.line_id || undefined,
    field_name: row.field_name || undefined,
    observed_value: row.observed_value || undefined,
    expected_value_or_rule: row.expected_value_or_rule || undefined,
    message: row.message,
    suggested_fix: row.suggested_fix || undefined,
    root_cause_category: (row.root_cause_category || 'Unclassified') as PintAEException['root_cause_category'],
    owner_team: (row.owner_team || 'ASP Ops') as PintAEException['owner_team'],
    sla_target_hours: row.sla_target_hours || 24,
    case_status: (row.case_status || 'Open') as PintAEException['case_status'],
    case_id: row.case_id || undefined,
  }));
}

// ============ Run Summary ============

export async function saveRunSummary(summary: Omit<RunSummary, 'id'>): Promise<boolean> {
  const { error } = await supabase
    .from('run_summaries')
    .insert({
      run_id: summary.run_id,
      total_invoices_tested: summary.total_invoices_tested,
      total_exceptions: summary.total_exceptions,
      pass_rate_percent: summary.pass_rate_percent,
      exceptions_by_severity: summary.exceptions_by_severity,
      top_10_failing_checks: summary.top_10_failing_checks,
      top_10_clients_by_risk: summary.top_10_clients_by_risk,
    });

  if (error) {
    console.error('Error saving run summary:', error);
    return false;
  }
  return true;
}

export async function fetchLatestRunSummary(): Promise<RunSummary | null> {
  const { data, error } = await supabase
    .from('run_summaries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    run_id: data.run_id,
    total_invoices_tested: data.total_invoices_tested,
    total_exceptions: data.total_exceptions,
    pass_rate_percent: Number(data.pass_rate_percent),
    exceptions_by_severity: data.exceptions_by_severity as Record<Severity, number>,
    top_10_failing_checks: data.top_10_failing_checks as RunSummary['top_10_failing_checks'],
    top_10_clients_by_risk: data.top_10_clients_by_risk as RunSummary['top_10_clients_by_risk'],
  };
}

// ============ Client Risk Scores ============

export async function saveClientRiskScores(runId: string, scores: Omit<ClientRiskScore, 'id' | 'run_id'>[]): Promise<boolean> {
  if (scores.length === 0) return true;

  const scoresToInsert = scores.map(s => ({
    run_id: runId,
    seller_trn: s.seller_trn,
    client_name: s.client_name,
    risk_score: s.risk_score,
    health_score: s.health_score,
    critical_count: s.critical_count,
    high_count: s.high_count,
    medium_count: s.medium_count,
    low_count: s.low_count,
    total_exceptions: s.total_exceptions,
    total_invoices: s.total_invoices,
  }));

  const { error } = await supabase
    .from('client_risk_scores')
    .insert(scoresToInsert);

  if (error) {
    console.error('Error saving client risk scores:', error);
    return false;
  }
  return true;
}

export async function fetchClientRiskScoresByRun(runId: string): Promise<ClientRiskScore[]> {
  const { data, error } = await supabase
    .from('client_risk_scores')
    .select('*')
    .eq('run_id', runId)
    .order('risk_score', { ascending: false });

  if (error) {
    console.error('Error fetching client risk scores:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    run_id: row.run_id,
    seller_trn: row.seller_trn,
    client_name: row.client_name || undefined,
    risk_score: row.risk_score,
    health_score: row.health_score,
    critical_count: row.critical_count,
    high_count: row.high_count,
    medium_count: row.medium_count,
    low_count: row.low_count,
    total_exceptions: row.total_exceptions,
    total_invoices: row.total_invoices,
  }));
}

export async function fetchLatestClientRiskScores(limit = 10): Promise<ClientRiskScore[]> {
  // Get the latest run
  const { data: latestRun } = await supabase
    .from('check_runs')
    .select('id')
    .order('run_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) return [];

  const { data, error } = await supabase
    .from('client_risk_scores')
    .select('*')
    .eq('run_id', latestRun.id)
    .order('risk_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching latest client risk scores:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    run_id: row.run_id,
    seller_trn: row.seller_trn,
    client_name: row.client_name || undefined,
    risk_score: row.risk_score,
    health_score: row.health_score,
    critical_count: row.critical_count,
    high_count: row.high_count,
    medium_count: row.medium_count,
    low_count: row.low_count,
    total_exceptions: row.total_exceptions,
    total_invoices: row.total_invoices,
  }));
}

// ============ Utility Functions ============

export function calculateClientScores(
  exceptions: PintAEException[],
  headers: { invoice_id: string; seller_trn: string }[]
): Omit<ClientRiskScore, 'id' | 'run_id'>[] {
  const sellerMap = new Map<string, {
    critical: number;
    high: number;
    medium: number;
    low: number;
    invoices: Set<string>;
  }>();

  // Initialize from headers
  headers.forEach(h => {
    if (!sellerMap.has(h.seller_trn)) {
      sellerMap.set(h.seller_trn, {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        invoices: new Set(),
      });
    }
    sellerMap.get(h.seller_trn)!.invoices.add(h.invoice_id);
  });

  // Count exceptions by seller
  exceptions.forEach(e => {
    if (e.seller_trn && sellerMap.has(e.seller_trn)) {
      const counts = sellerMap.get(e.seller_trn)!;
      switch (e.severity) {
        case 'Critical': counts.critical++; break;
        case 'High': counts.high++; break;
        case 'Medium': counts.medium++; break;
        case 'Low': counts.low++; break;
      }
    }
  });

  // Calculate scores
  return Array.from(sellerMap.entries()).map(([seller_trn, data]) => {
    const totalExceptions = data.critical + data.high + data.medium + data.low;
    const riskScore = calculateRiskScore(data.critical, data.high, data.medium, data.low);
    const healthScore = calculateHealthScore(riskScore, data.invoices.size);

    return {
      seller_trn,
      risk_score: riskScore,
      health_score: healthScore,
      critical_count: data.critical,
      high_count: data.high,
      medium_count: data.medium,
      low_count: data.low,
      total_exceptions: totalExceptions,
      total_invoices: data.invoices.size,
    };
  });
}

export function generateRunSummary(
  runId: string,
  totalInvoices: number,
  exceptions: PintAEException[],
  clientScores: Omit<ClientRiskScore, 'id' | 'run_id'>[]
): Omit<RunSummary, 'id'> {
  // Count by severity
  const severityCounts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  exceptions.forEach(e => severityCounts[e.severity]++);

  // Count by check
  const checkCounts = new Map<string, { check_id: string; check_name: string; count: number }>();
  exceptions.forEach(e => {
    if (!checkCounts.has(e.check_id)) {
      checkCounts.set(e.check_id, { check_id: e.check_id, check_name: e.check_name, count: 0 });
    }
    checkCounts.get(e.check_id)!.count++;
  });

  const top10Checks = Array.from(checkCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const top10Clients = clientScores
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 10)
    .map(c => ({
      seller_trn: c.seller_trn,
      client_name: c.client_name,
      risk_score: c.risk_score,
      health_score: c.health_score,
    }));

  // Calculate pass rate
  const invoicesWithExceptions = new Set(exceptions.filter(e => e.invoice_id).map(e => e.invoice_id)).size;
  const passRate = totalInvoices > 0 
    ? ((totalInvoices - invoicesWithExceptions) / totalInvoices) * 100 
    : 100;

  return {
    run_id: runId,
    total_invoices_tested: totalInvoices,
    total_exceptions: exceptions.length,
    pass_rate_percent: Math.round(passRate * 100) / 100,
    exceptions_by_severity: severityCounts,
    top_10_failing_checks: top10Checks,
    top_10_clients_by_risk: top10Clients,
  };
}
