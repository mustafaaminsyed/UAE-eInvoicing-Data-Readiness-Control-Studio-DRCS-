export const EXECUTIVE_KPI_LABELS = {
  submissionReadyInvoices: {
    title: 'Submission-ready invoices',
    subtitle: 'Invoices passing all executed rule checks in current scope',
    helpSummary:
      'A document is submission-ready when it passes every rule check executed against it. This is the primary go/no-go signal for FTA submission.',
  },
  rulePassRate: {
    title: 'Rule pass rate',
    helpSummary:
      'The share of individual rule-outcome evaluations that returned pass. One document generates multiple rule outcomes - this metric reflects rule-engine performance, not document-level readiness.',
  },
} as const;
