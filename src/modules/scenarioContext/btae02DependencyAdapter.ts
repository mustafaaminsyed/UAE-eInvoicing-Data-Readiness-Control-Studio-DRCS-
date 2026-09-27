import type { PintAEExecutionResult } from '@/lib/checks/pintAECheckRunner';
import type {
  Btae02Assessment,
  Btae02DependencyStatus,
  Btae02PositionAssessment,
} from './btae02Assessment';

export interface Btae02InvoiceIdentity {
  invoiceId?: string;
  invoiceNumber?: string;
}

const RULE_TO_FLAG = {
  'IBR-138-AE': 'summary_invoice',
  'IBR-137-AE': 'disclosed_agent_billing',
  'IBR-152-AE': 'exports',
} as const;

function matchesIdentity(result: PintAEExecutionResult, identity: Btae02InvoiceIdentity): boolean {
  if (identity.invoiceId && result.invoiceId) return identity.invoiceId === result.invoiceId;
  if (identity.invoiceNumber && result.invoiceNumber) return identity.invoiceNumber === result.invoiceNumber;
  return false;
}

function statusFor(result: PintAEExecutionResult): Btae02DependencyStatus {
  if (result.status === 'passed') return 'satisfied';
  if (result.status === 'failed') return 'failed';
  if (result.status === 'not_applicable') return 'not_applicable';
  return 'not_evaluated';
}

export function projectBtae02Dependencies(
  assessment: Btae02Assessment,
  executionResults: readonly PintAEExecutionResult[],
  identity: Btae02InvoiceIdentity,
): Btae02Assessment {
  const positions: Btae02PositionAssessment[] = assessment.declaration.positions.map((position) => {
    const ruleId = Object.entries(RULE_TO_FLAG).find(([, flag]) => flag === position.flag)?.[0];
    if (!ruleId) return { ...position, evidence: [...position.evidence], dependency: { ...position.dependency } };

    const matches = executionResults.filter((result) => result.ruleId === ruleId && matchesIdentity(result, identity));
    const result = matches.length === 1 ? matches[0] : undefined;
    if (!result) return { ...position, evidence: [...position.evidence], dependency: { ...position.dependency } };

    return {
      ...position,
      evidence: [...position.evidence],
      dependency: {
        status: statusFor(result),
        ruleId,
        ...(result.reason ? { reason: result.reason } : {}),
      },
    };
  });

  return {
    ...assessment,
    declaration: { ...assessment.declaration, positions },
  };
}
