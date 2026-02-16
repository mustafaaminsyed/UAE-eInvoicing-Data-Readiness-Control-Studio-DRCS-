import { Severity } from '@/types/compliance';

export interface CustomCheckConfig {
  id?: string;
  name: string;
  description?: string;
  severity: Severity;
  dataset_scope: 'header' | 'lines' | 'buyers' | 'cross-file';
  rule_type: 'missing' | 'duplicate' | 'math' | 'regex' | 'custom_formula';
  parameters: CustomCheckParameters;
  message_template: string;
  is_active: boolean;
}

export interface CustomCheckParameters {
  // For missing rule
  field?: string;
  
  // For duplicate rule
  fields?: string[];
  
  // For math rule
  left_expression?: string;
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  right_expression?: string;
  tolerance?: number;
  
  // For regex rule
  pattern?: string;
  
  // For custom formula
  formula?: string;
  
  // Conditional filter
  condition?: string;
}

export interface CheckRun {
  id: string;
  run_date: string;
  total_invoices: number;
  total_exceptions: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  pass_rate: number;
  results_summary?: any;
}

export interface EntityScore {
  id: string;
  run_id: string;
  entity_type: 'seller' | 'buyer' | 'invoice';
  entity_id: string;
  entity_name?: string;
  score: number;
  total_exceptions: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  created_at: string;
}

// Severity weights for scoring
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  Critical: 25,
  High: 15,
  Medium: 8,
  Low: 3,
};

export function calculateScore(
  criticalCount: number,
  highCount: number,
  mediumCount: number,
  lowCount: number
): number {
  const totalPenalty = 
    criticalCount * SEVERITY_WEIGHTS.Critical +
    highCount * SEVERITY_WEIGHTS.High +
    mediumCount * SEVERITY_WEIGHTS.Medium +
    lowCount * SEVERITY_WEIGHTS.Low;
  
  return Math.max(0, Math.min(100, 100 - totalPenalty));
}
