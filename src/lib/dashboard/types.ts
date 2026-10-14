import type { Severity } from '@/types/compliance';

export type DatasetScope = 'AR' | 'AP';

export type DashboardRecord = Record<string, unknown>;

export interface DashboardException {
  id: string;
  checkId: string;
  checkName: string;
  severity: Severity;
  invoiceId?: string;
  datasetType?: string;
  direction?: string;
  message: string;
}

export interface DashboardCheckResult {
  checkId: string;
  checkName: string;
  passed: number;
  failed: number;
  severity: Severity;
  datasetType?: string;
  direction?: string;
}

export interface ExceptionBreakdownItem {
  key: string;
  label: string;
  count: number;
  affectedInvoices: number;
  hasInvoiceCoverage: boolean;
  severity: Severity;
  description: string;
}

export interface ExceptionTheme {
  title: string;
  value: string;
  subtitle: string;
}

export interface DashboardSnapshot {
  hasLiveSignals: boolean;
  modeLabel: string;
  totalInvoices: number;
  submissionReadyCount: number;
  submissionReadyRate: number;
  rulePassRate: number;
  totalRuleOutcomes: number;
  criticalBlockerOutcomes: number;
  criticalBlockerDocumentCount: number;
  avgCriticalBlockersPerDocument: number;
  acceptedInvoices: number;
  successRate: number;
  passRate: number;
  criticalIssues: number;
  complianceReadiness: number | null;
  goLiveReadiness: number | null;
  mandatoryCompleteness: number;
  conditionalCompleteness: number;
  conditionalFieldDocumentCount: number;
  nullFieldRate: number;
  duplicateInvoiceRatio: number;
  invalidCodelistCount: number;
  currencyMismatchCount: number;
  ibtMandatoryCoverage: number;
  pintRuleCoverage: number;
  creditNoteCoverage: number;
  creditNoteCount: number;
  creditNoteReasonCoverage: number;
  creditNoteReasonTextCoverage?: number;
  creditNoteReferenceCoverage: number;
  creditNoteIssueDateCoverage?: number;
  headerCompleteness: number;
  buyerCompleteness: number;
  lineCompleteness: number;
  executedRuleOutcomes: number;
  regulatoryRegisteredControls: number;
  regulatoryApplicableControls: number;
  regulatoryEvaluatedControls: number;
  regulatoryNotApplicableControls: number;
  regulatoryNotEvaluatedControls: number;
  supplementaryControls: number;
  evaluationCoverage: number | null;
  exceptionsTotal: number;
  exceptionsBySeverity: Record<Severity, number>;
  blockingIssues: ExceptionBreakdownItem[];
  exceptionThemes: ExceptionTheme[];
}

export interface ScoreInput {
  label: string;
  score: number;
  weight: number;
  summary: string;
}
