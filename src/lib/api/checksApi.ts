import { supabase } from '@/integrations/supabase/client';
import { CustomCheckConfig } from '@/types/customChecks';
import { CheckRun, EntityScore } from '@/types/customChecks';

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

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    severity: row.severity as any,
    dataset_scope: row.dataset_scope as any,
    rule_type: row.rule_type as any,
    parameters: row.parameters as any,
    message_template: row.message_template,
    is_active: row.is_active,
  }));
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

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    severity: row.severity as any,
    dataset_scope: row.dataset_scope as any,
    rule_type: row.rule_type as any,
    parameters: row.parameters as any,
    message_template: row.message_template,
    is_active: row.is_active,
  }));
}

export async function createCustomCheck(check: Omit<CustomCheckConfig, 'id'>): Promise<CustomCheckConfig | null> {
  const insertData = {
    name: check.name,
    description: check.description,
    severity: check.severity,
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

  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    severity: data.severity as any,
    dataset_scope: data.dataset_scope as any,
    rule_type: data.rule_type as any,
    parameters: data.parameters as any,
    message_template: data.message_template,
    is_active: data.is_active,
  };
}

export async function updateCustomCheck(id: string, check: Partial<CustomCheckConfig>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (check.name !== undefined) updateData.name = check.name;
  if (check.description !== undefined) updateData.description = check.description;
  if (check.severity !== undefined) updateData.severity = check.severity;
  if (check.dataset_scope !== undefined) updateData.dataset_scope = check.dataset_scope;
  if (check.rule_type !== undefined) updateData.rule_type = check.rule_type;
  if (check.parameters !== undefined) updateData.parameters = check.parameters;
  if (check.message_template !== undefined) updateData.message_template = check.message_template;
  if (check.is_active !== undefined) updateData.is_active = check.is_active;
  
  const { error } = await supabase
    .from('custom_checks')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating custom check:', error);
    return false;
  }

  return true;
}

export async function deleteCustomCheck(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('custom_checks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting custom check:', error);
    return false;
  }

  return true;
}

export async function saveCheckRun(run: Omit<CheckRun, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('check_runs')
    .insert({
      run_date: run.run_date,
      total_invoices: run.total_invoices,
      total_exceptions: run.total_exceptions,
      critical_count: run.critical_count,
      high_count: run.high_count,
      medium_count: run.medium_count,
      low_count: run.low_count,
      pass_rate: run.pass_rate,
      results_summary: run.results_summary,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving check run:', error);
    return null;
  }

  return data.id;
}

export async function saveEntityScores(scores: Omit<EntityScore, 'id' | 'created_at'>[]): Promise<boolean> {
  if (scores.length === 0) return true;
  
  const { error } = await supabase
    .from('entity_scores')
    .insert(scores.map(score => ({
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
    })));

  if (error) {
    console.error('Error saving entity scores:', error);
    return false;
  }

  return true;
}

export async function fetchCheckRuns(limit: number = 20): Promise<CheckRun[]> {
  const { data, error } = await supabase
    .from('check_runs')
    .select('*')
    .order('run_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching check runs:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    run_date: row.run_date,
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

export async function fetchEntityScores(runId: string, entityType?: string): Promise<EntityScore[]> {
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

  return (data || []).map(row => ({
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

export async function fetchLatestEntityScores(entityType?: string, limit: number = 10): Promise<EntityScore[]> {
  // First get the latest run
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

  return (data || []).map(row => ({
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
