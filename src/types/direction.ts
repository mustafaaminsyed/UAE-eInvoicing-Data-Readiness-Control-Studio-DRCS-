export type Direction = 'AR' | 'AP';

export const DEFAULT_DIRECTION: Direction = 'AR';

export interface OrganizationProfile {
  ourEntityTRNs: string[];
  entityIds?: string[];
}

export type ExceptionWorkflowStatus = 'Open' | 'In Review' | 'Resolved' | 'Waived';

export type APResolutionReasonCode =
  | 'REQUEST_VENDOR_CORRECTION'
  | 'DUPLICATE_REJECT'
  | 'MARK_NON_RECOVERABLE'
  | 'ACCEPT_WITH_VARIANCE';

export type ARResolutionReasonCode =
  | 'REISSUE_INVOICE'
  | 'CREDIT_NOTE_NEEDED'
  | 'CORRECT_BUYER_DATA_AND_RESEND';

export type ResolutionReasonCode = APResolutionReasonCode | ARResolutionReasonCode;
