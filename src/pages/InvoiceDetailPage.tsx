import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, User, AlertTriangle, CheckCircle, Clock, Briefcase, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompliance } from '@/context/ComplianceContext';
import { SeverityBadge } from '@/components/SeverityBadge';
import { fetchLifecycleEvents, fetchCaseByInvoice } from '@/lib/api/casesApi';
import { InvoiceLifecycleEvent, Case, InvoiceStatus } from '@/types/cases';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  'Received': 'bg-gray-500',
  'Pre-Validated': 'bg-blue-500',
  'Held': 'bg-yellow-500',
  'Submitted': 'bg-cyan-500',
  'Acknowledged': 'bg-purple-500',
  'Accepted': 'bg-green-500',
  'Rejected': 'bg-red-500',
  'Resolved': 'bg-emerald-500',
  'Resubmitted': 'bg-orange-500',
  'Closed': 'bg-gray-600',
};

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { isChecksRun, getInvoiceDetails, headers } = useCompliance();
  const [lifecycleEvents, setLifecycleEvents] = useState<InvoiceLifecycleEvent[]>([]);
  const [linkedCase, setLinkedCase] = useState<Case | null>(null);

  useEffect(() => {
    if (invoiceId) {
      loadAdditionalData();
    }
  }, [invoiceId]);

  const loadAdditionalData = async () => {
    if (!invoiceId) return;
    const [events, caseData] = await Promise.all([
      fetchLifecycleEvents(invoiceId),
      fetchCaseByInvoice(invoiceId),
    ]);
    setLifecycleEvents(events);
    setLinkedCase(caseData);
  };

  if (!isChecksRun || !invoiceId) {
    navigate('/');
    return null;
  }

  const { header, lines, buyer, exceptions } = getInvoiceDetails(invoiceId);

  if (!header) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">The invoice ID "{invoiceId}" was not found.</p>
          <Button onClick={() => navigate('/exceptions')}>Back to Exceptions</Button>
        </div>
      </div>
    );
  }

  const currentStatus = lifecycleEvents.length > 0 
    ? lifecycleEvents[lifecycleEvents.length - 1].status 
    : 'Received';

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-6xl py-8 md:py-10">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Invoice {header.invoice_number}
              </h1>
              <p className="text-muted-foreground">
                ID: {header.invoice_id} | Issued: {header.issue_date}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Current Status Badge */}
            <div className={cn(
              'px-3 py-1 rounded-full text-white text-sm font-medium',
              STATUS_COLORS[currentStatus]
            )}>
              {currentStatus}
            </div>
            
            {exceptions.length > 0 ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-severity-critical-bg border border-severity-critical/30">
                <AlertTriangle className="w-5 h-5 text-severity-critical" />
                <span className="font-medium text-severity-critical">
                  {exceptions.length} Exception{exceptions.length !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-bg border border-success/30">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-medium text-success">All Checks Passed</span>
              </div>
            )}
          </div>
        </div>

        {/* Linked Case Banner */}
        {linkedCase && (
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4 mb-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-primary" />
                <div>
                  <span className="font-medium text-foreground">Linked Case: </span>
                  <span className="font-mono text-primary">{linkedCase.case_number}</span>
                </div>
                <SeverityBadge severity={linkedCase.severity} />
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  linkedCase.status === 'Resolved' ? 'bg-success-bg text-success' :
                  linkedCase.status === 'Open' ? 'bg-severity-critical-bg text-severity-critical' :
                  'bg-severity-medium-bg text-severity-medium'
                )}>
                  {linkedCase.status}
                </span>
                {linkedCase.is_sla_breached && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-severity-critical-bg text-severity-critical">
                    SLA Breached
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/cases')}>
                View Case
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-slide-up">
          {/* Invoice Info */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Invoice Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Invoice Type</dt>
                <dd className="font-medium text-foreground">{header.invoice_type || 'INVOICE'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Currency</dt>
                <dd className="font-medium text-foreground">{header.currency}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Seller TRN</dt>
                <dd className="font-mono text-sm text-foreground">{header.seller_trn}</dd>
              </div>
            </dl>
          </div>

          {/* Buyer Info */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Buyer Details
            </h2>
            {buyer ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd className="font-medium text-foreground">{buyer.buyer_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Buyer ID</dt>
                  <dd className="font-mono text-sm text-foreground">{buyer.buyer_id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">TRN</dt>
                  <dd className="font-mono text-sm text-foreground">{buyer.buyer_trn || '(missing)'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-severity-critical text-sm">
                Buyer ID "{header.buyer_id}" not found
              </p>
            )}
          </div>

          {/* Totals */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Totals</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Excl. VAT</dt>
                <dd className="font-medium text-foreground">
                  {header.total_excl_vat?.toFixed(2) || '-'} {header.currency}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">VAT Total</dt>
                <dd className="font-medium text-foreground">
                  {header.vat_total?.toFixed(2) || '-'} {header.currency}
                </dd>
              </div>
              <div className="pt-2 border-t">
                <dt className="text-xs text-muted-foreground">Incl. VAT</dt>
                <dd className="text-lg font-bold text-foreground">
                  {header.total_incl_vat?.toFixed(2) || '-'} {header.currency}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Lifecycle History */}
        {lifecycleEvents.length > 0 && (
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm mb-8 animate-slide-up">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Lifecycle History
              </h2>
            </div>
            <div className="p-6">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-6">
                  {lifecycleEvents.map((event, idx) => (
                    <div key={event.id} className="relative pl-10">
                      <div className={cn(
                        'absolute left-2 w-5 h-5 rounded-full border-2 border-background',
                        STATUS_COLORS[event.status]
                      )} />
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{event.status}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>
                        {event.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                        )}
                        {event.changed_by && (
                          <p className="text-xs text-muted-foreground mt-1">By: {event.changed_by}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exceptions */}
        {exceptions.length > 0 && (
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm mb-8 animate-slide-up">
            <div className="p-6 border-b bg-severity-critical-bg/30">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-severity-critical" />
                Failed Checks ({exceptions.length})
              </h2>
            </div>
            <div className="divide-y">
              {exceptions.map((exception) => (
                <div key={exception.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{exception.checkName}</span>
                        <SeverityBadge severity={exception.severity} />
                      </div>
                      <p className="text-sm text-muted-foreground">{exception.message}</p>
                      {exception.lineNumber && (
                        <p className="text-xs text-muted-foreground mt-1">Line #{exception.lineNumber}</p>
                      )}
                    </div>
                    {exception.expectedValue && (
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          Expected: <span className="text-success">{exception.expectedValue}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Actual: <span className="text-severity-critical">{exception.actualValue}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line Items */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm animate-slide-up">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-foreground">
              Line Items ({lines.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">#</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Qty</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Unit Price</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Discount</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Line Total</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">VAT Rate</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">VAT Amount</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const lineExceptions = exceptions.filter(e => e.lineId === line.line_id);
                  const hasError = lineExceptions.length > 0;
                  
                  return (
                    <tr 
                      key={line.line_id} 
                      className={cn('border-b transition-colors', hasError ? 'bg-severity-critical-bg/30' : 'hover:bg-muted/20')}
                    >
                      <td className="p-4 font-medium text-foreground">{line.line_number}</td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">{line.description || '-'}</td>
                      <td className="p-4 text-right text-sm text-foreground">{line.quantity}</td>
                      <td className="p-4 text-right text-sm text-foreground">{line.unit_price.toFixed(2)}</td>
                      <td className="p-4 text-right text-sm text-foreground">{(line.line_discount || 0).toFixed(2)}</td>
                      <td className="p-4 text-right text-sm font-medium text-foreground">{line.line_total_excl_vat.toFixed(2)}</td>
                      <td className="p-4 text-right text-sm text-foreground">{(line.vat_rate * 100).toFixed(0)}%</td>
                      <td className="p-4 text-right text-sm text-foreground">{line.vat_amount.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        {hasError ? (
                          <span className="inline-flex items-center gap-1 text-xs text-severity-critical">
                            <AlertTriangle className="w-3 h-3" />
                            {lineExceptions.length}
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-success mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


