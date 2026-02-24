import { supabase } from '@/integrations/supabase/client';
import { CheckRun, CustomCheckConfig, EntityScore, InvestigationFlag } from '@/types/customChecks';
import { DatasetType } from '@/types/datasets';
import { shouldUseLocalDevFallback } from '@/lib/api/supabaseEnv';

const LOCAL_CHECK_RUNS_KEY = 'drcs_local_check_runs_v1';
const LOCAL_ENTITY_SCORES_KEY = 'drcs_local_entity_scores_v1';

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local persistence failures in browser private modes/storage constraints.
  }
}

function nextLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveLocalCheckRun(run: Omit<CheckRun, 'id'>): string {
  const existing = readLocalJson<CheckRun[]>(LOCAL_CHECK_RUNS_KEY, []);
  const entry: CheckRun = {
    id: nextLocalId('local-run'),
    ...run,
    dataset_type: run.dataset_type || 'AR',
  };
  const next = [entry, ...existing].slice(0, 500);
  writeLocalJson(LOCAL_CHECK_RUNS_KEY, next);
  return entry.id;
}

function saveLocalEntityScores(scores: Omit<EntityScore, 'id' | 'created_at'>[]): void {
  const existing = readLocalJson<EntityScore[]>(LOCAL_ENTITY_SCORES_KEY, []);
  const createdAt = new Date().toISOString();
  const entries: EntityScore[] = scores.map((score) => ({
    id: nextLocalId('local-score'),
    created_at: createdAt,
    ...score,
  }));
  const next = [...entries, ...existing].slice(0, 2000);
  writeLocalJson(LOCAL_ENTITY_SCORES_KEY, next);
}

function fetchLocalCheckRuns(limit = 20): CheckRun[] {
  const runs = readLocalJson<CheckRun[]>(LOCAL_CHECK_RUNS_KEY, []);
  return [...runs]
    .sort((a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime())
    .slice(0, limit);
}

function fetchLocalEntityScores(runId: string, entityType?: string): EntityScore[] {
  const scores = readLocalJson<EntityScore[]>(LOCAL_ENTITY_SCORES_KEY, []);
  return scores
    .filter((score) => score.run_id === runId && (!entityType || score.entity_type === entityType))
    .sort((a, b) => a.score - b.score);
}

function mapCustomCheckRow(row: any): CustomCheckConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    severity: row.severity as any,
    check_type: (row.check_type as any) || 'VALIDATION',
    dataset_scope: row.dataset_scope as any,
    rule_type: row.rule_type as any,
    parameters: row.parameters as any,
    message_template: row.message_template,
    is_active: row.is_active,
  };
}

export async function fetchCustomChecks(): Promise<CustomCheckConfig[]> {
  const { data, error } = await supabase
    .from('custom_checks')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching custom checks:', error);
    return [];
  }

  return (data || []).map(mapCustomCheckRow);
}

export async function fetchAllCustomChecks(): Promise<CustomCheckConfig[]> {
  const { data, error } = await supabase
    .from('custom_checks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching custom checks:', error);
    return [];
  }

  return (data || []).map(mapCustomCheckRow);
}

export async function createCustomCheck(
  check: Omit<CustomCheckConfig, 'id'>
): Promise<CustomCheckConfig | null> {
  const insertData = {
    name: check.name,
    description: check.description,
    severity: check.severity,
    check_type: check.check_type || 'VALIDATION',
    dataset_scope: check.dataset_scope,
    rule_type: check.rule_type,
    parameters: check.parameters as unknown as Record<string, unknown>,
    message_template: check.message_template,
    is_active: check.is_active,
  };

  const { data, error } = await supabase
    .from('custom_checks')
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating custom check:', error);
    return null;
  }

  return mapCustomCheckRow(data);
}

export async function updateCustomCheck(
  id: string,
  check: Partial<CustomCheckConfig>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (check.name !== undefined) updateData.name = check.name;
  if (check.description !== undefined) updateData.description = check.description;
  if (check.severity !== undefined) updateData.severity = check.severity;
  if (check.check_type !== undefined) updateData.check_type = check.check_type;
  if (check.dataset_scope !== undefined) updateData.dataset_scope = check.dataset_scope;
  if (check.rule_type !== undefined) updateData.rule_type = check.rule_type;
  if (check.parameters !== undefined) updateData.parameters = check.parameters;
  if (check.message_template !== undefined) updateData.message_template = check.message_template;
  if (check.is_active !== undefined) updateData.is_active = check.is_active;

  const { error } = await supabase.from('custom_checks').update(updateData as any).eq('id', id);

  if (error) {
    console.error('Error updating custom check:', error);
    return false;
  }

  return true;
}

export async function deleteCustomCheck(id: string): Promise<boolean> {
  const { error } = await supabase.from('custom_checks').delete().eq('id', id);

  if (error) {
    console.error('Error deleting custom check:', error);
    return false;
  }

  return true;
}

export async function seedStarterSearchChecks(): Promise<void> {
  const starterChecks: Omit<CustomCheckConfig, 'id'>[] = [
    {
      name: 'Possible Duplicate (Vendor + Amount + Date)',
      description:
        'Flags likely duplicate AP invoices when vendor similarity is high, amount is equal, and dates are within +/-3 days.',
      severity: 'Low',
      check_type: 'SEARCH_CHECK',
      dataset_scope: 'header',
      rule_type: 'fuzzy_duplicate',
      parameters: {
        vendor_similarity_threshold: 0.9,
        amount_tolerance: 0.01,
        date_window_days: 3,
      },
      message_template: 'Potential duplicate AP invoice detected',
      is_active: true,
    },
    {
      name: 'Possible Invoice Number Variant',
      description:
        'Detects near-duplicate invoice numbers after normalization (spaces, dashes, separators removed).',
      severity: 'Low',
      check_type: 'SEARCH_CHECK',
      dataset_scope: 'header',
      rule_type: 'invoice_number_variant',
      parameters: {
        invoice_number_similarity_threshold: 0.88,
      },
      message_template: 'Potential invoice-number variant detected',
      is_active: true,
    },
    {
      name: 'Possible Seller TRN Formatting Variant',
      description:
        'Flags similar seller TRN values with minor format differences or low edit distance.',
      severity: 'Low',
      check_type: 'SEARCH_CHECK',
      dataset_scope: 'header',
      rule_type: 'trn_format_similarity',
      parameters: {
        trn_distance_threshold: 2,
      },
      message_template: 'Potential TRN formatting variant detected',
      is_active: true,
    },
  ];

  const existing = await fetchAllCustomChecks();
  const existingNames = new Set(existing.map((check) => check.name.toLowerCase()));
  const missing = starterChecks.filter(
    (check) => !existingNames.has(check.name.toLowerCase())
  );

  if (missing.length === 0) return;

  const payload = missing.map((check) => ({
    name: check.name,
    description: check.description || null,
    severity: check.severity,
    check_type: check.check_type || 'SEARCH_CHECK',
    dataset_scope: check.dataset_scope,
    rule_type: check.rule_type,
    parameters: check.parameters as unknown as Record<string, unknown>,
    message_template: check.message_template,
    is_active: check.is_active,
  }));

  const { error } = await supabase.from('custom_checks').insert(payload as any);
  if (error) {
    console.error('Error seeding starter search checks:', error);
  }
}

export async function saveCheckRun(run: Omit<CheckRun, 'id'>): Promise<string | null> {
  if (shouldUseLocalDevFallback()) {
    return saveLocalCheckRun(run);
  }

  const { data, error } = await supabase
    .from('check_runs')
    .insert({
      run_date: run.run_date,
      dataset_type: run.dataset_type || 'AR',
      total_invoices: run.total_invoices,
      total_exceptions: run.total_exceptions,
      critical_count: run.critical_count,
      high_count: run.high_count,
      medium_count: run.medium_count,
      low_count: run.low_count,
      pass_rate: run.pass_rate,
      results_summary: run.results_summary,
    } as any)
    .select('id')
    .single();

  if (error) {
    console.error('Error saving check run:', error);
    return null;
  }

  return data.id;
}

export async function saveEntityScores(
  scores: Omit<EntityScore, 'id' | 'created_at'>[]
): Promise<boolean> {
  if (scores.length === 0) return true;
  if (shouldUseLocalDevFallback()) {
    saveLocalEntityScores(scores);
    return true;
  }

  const { error } = await supabase.from('entity_scores').insert(
    scores.map((score) => ({
      run_id: score.run_id,
      entity_type: score.entity_type,
      entity_id: score.entity_id,
      entity_name: score.entity_name,
      score: score.score,
      total_exceptions: score.total_exceptions,
      critical_count: score.critical_count,
      high_count: score.high_count,
      medium_count: score.medium_count,
      low_count: score.low_count,
    })) as any
  );

  if (error) {
    console.error('Error saving entity scores:', error);
    return false;
  }

  return true;
}

export async function fetchCheckRuns(limit: number = 20): Promise<CheckRun[]> {
  if (shouldUseLocalDevFallback()) {
    return fetchLocalCheckRuns(limit);
  }

  const { data, error } = await supabase
    .from('check_runs')
    .select('*')
    .order('run_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching check runs:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    run_date: row.run_date,
    dataset_type: (row.dataset_type as any) || 'AR',
    total_invoices: row.total_invoices,
    total_exceptions: row.total_exceptions,
    critical_count: row.critical_count,
    high_count: row.high_count,
    medium_count: row.medium_count,
    low_count: row.low_count,
    pass_rate: Number(row.pass_rate),
    results_summary: row.results_summary,
  }));
}

export async function saveInvestigationFlags(
  runId: string | null,
  flags: InvestigationFlag[]
): Promise<boolean> {
  if (flags.length === 0) return true;

  const payload = flags.map((flag) => ({
    run_id: runId,
    dataset_type: flag.datasetType,
    check_id: flag.checkId,
    check_name: flag.checkName,
    invoice_id: flag.invoiceId || null,
    invoice_number: flag.invoiceNumber || null,
    counterparty_name: flag.counterpartyName || null,
    message: flag.message,
    confidence_score: flag.confidenceScore || null,
    matched_invoice_id: flag.matchedInvoiceId || null,
    matched_invoice_number: flag.matchedInvoiceNumber || null,
  }));

  const { error } = await supabase.from('investigation_flags').insert(payload as any);
  if (error) {
    console.error('Error saving investigation flags:', error);
    return false;
  }

  return true;
}

export async function fetchInvestigationFlags(
  datasetType?: DatasetType
): Promise<InvestigationFlag[]> {
  let query = supabase
    .from('investigation_flags')
    .select('*')
    .order('created_at', { ascending: false });

  if (datasetType) query = query.eq('dataset_type', datasetType);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching investigation flags:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    checkId: row.check_id,
    checkName: row.check_name,
    datasetType: (row.dataset_type as DatasetType) || 'AP',
    invoiceId: row.invoice_id || undefined,
    invoiceNumber: row.invoice_number || undefined,
    counterpartyName: row.counterparty_name || undefined,
    message: row.message,
    confidenceScore: row.confidence_score || undefined,
    matchedInvoiceId: row.matched_invoice_id || undefined,
    matchedInvoiceNumber: row.matched_invoice_number || undefined,
    createdAt: row.created_at,
  }));
}

export async function fetchEntityScores(
  runId: string,
  entityType?: string
): Promise<EntityScore[]> {
  if (shouldUseLocalDevFallback()) {
    return fetchLocalEntityScores(runId, entityType);
  }

  let query = supabase
    .from('entity_scores')
    .select('*')
    .eq('run_id', runId)
    .order('score', { ascending: true });

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching entity scores:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    run_id: row.run_id,
    entity_type: row.entity_type as any,
    entity_id: row.entity_id,
    entity_name: row.entity_name || undefined,
    score: Number(row.score),
    total_exceptions: row.total_exceptions,
    critical_count: row.critical_count,
    high_count: row.high_count,
    medium_count: row.medium_count,
    low_count: row.low_count,
    created_at: row.created_at,
  }));
}

export async function fetchLatestEntityScores(
  entityType?: string,
  limit: number = 10
): Promise<EntityScore[]> {
  if (shouldUseLocalDevFallback()) {
    const latestRun = fetchLocalCheckRuns(1)[0];
    if (!latestRun) return [];
    return fetchLocalEntityScores(latestRun.id, entityType).slice(0, limit);
  }

  const { data: latestRun } = await supabase
    .from('check_runs')
    .select('id')
    .order('run_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestRun) return [];

  let query = supabase
    .from('entity_scores')
    .select('*')
    .eq('run_id', latestRun.id)
    .order('score', { ascending: true })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching entity scores:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    run_id: row.run_id,
    entity_type: row.entity_type as any,
    entity_id: row.entity_id,
    entity_name: row.entity_name || undefined,
    score: Number(row.score),
    total_exceptions: row.total_exceptions,
    critical_count: row.critical_count,
    high_count: row.high_count,
    medium_count: row.medium_count,
    low_count: row.low_count,
    created_at: row.created_at,
  }));
}
