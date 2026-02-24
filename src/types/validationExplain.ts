import { Exception } from './compliance';

export type ValidationRisk = 'Low' | 'Medium' | 'High' | 'Critical';
export type ValidationExplanationStatus = 'completed' | 'failed';

export interface ValidationExplanation {
  id?: string;
  tenantId: string;
  exceptionKey: string;
  checkExceptionId?: string | null;
  validationRunId?: string | null;
  invoiceId?: string | null;
  ruleCode?: string | null;
  checkId?: string | null;
  checkName?: string | null;
  datasetType?: string | null;
  direction?: string | null;
  explanation: string;
  risk: ValidationRisk;
  recommendedFix: string;
  confidence: number;
  model?: string | null;
  promptVersion: string;
  sourceContext?: Record<string, unknown> | null;
  status: ValidationExplanationStatus;
  errorMessage?: string | null;
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  cached?: boolean;
  source?: 'cache' | 'edge' | 'fallback';
}

export interface GenerateValidationExplanationOptions {
  regenerate?: boolean;
  tenantId?: string;
  promptVersion?: string;
}

export interface ValidationExplainFunctionInput {
  exception_key: string;
  tenant_id: string;
  regenerate: boolean;
  prompt_version: string;
  exception: {
    id: string;
    check_id: string;
    check_name: string;
    severity: string;
    message: string;
    invoice_id?: string | null;
    invoice_number?: string | null;
    seller_trn?: string | null;
    buyer_id?: string | null;
    line_id?: string | null;
    field_name?: string | null;
    expected_value?: string | number | null;
    actual_value?: string | number | null;
    dataset_type?: string | null;
    direction?: string | null;
    validation_run_id?: string | null;
  };
}

export type ExceptionLike = Pick<
  Exception,
  | 'id'
  | 'checkId'
  | 'checkName'
  | 'severity'
  | 'message'
  | 'invoiceId'
  | 'invoiceNumber'
  | 'sellerTrn'
  | 'buyerId'
  | 'lineId'
  | 'field'
  | 'expectedValue'
  | 'actualValue'
  | 'datasetType'
  | 'direction'
  | 'validationRunId'
>;
