import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle,
  ExternalLink, FileText, Lock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { TraceabilityRow, CoverageStatus } from '@/lib/coverage/conformanceEngine';
import { getRulesForDR, RuleTraceEntry } from '@/lib/rules/ruleTraceability';
import { getControlsForDR, ControlEntry } from '@/lib/registry/controlsRegistry';
import { PintAEException } from '@/types/pintAE';

interface DrillDownDialogProps {
  row: TraceabilityRow | null;
  exceptions: PintAEException[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CoverageStatusBadge({ status }: { status: CoverageStatus }) {
  const config: Record<CoverageStatus, { label: string; className: string }> = {
    COVERED: { label: 'Covered', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20' },
    NO_CONTROL: { label: 'No Control', className: 'bg-accent/10 text-accent-foreground border-accent/20' },
    NO_RULE: { label: 'No Rule', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    NOT_IN_TEMPLATE: { label: 'Not in Template', className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  };
  const c = config[status];
  return <Badge variant="outline" className={cn('text-xs', c.className)}>{c.label}</Badge>;
}

export function DrillDownDialog({ row, exceptions, open, onOpenChange }: DrillDownDialogProps) {
  if (!row) return null;

  const rules = getRulesForDR(row.dr_id);
  const controls = getControlsForDR(row.dr_id);
  const drExceptions = exceptions.filter(e =>
    e.pint_reference_terms?.includes(row.dr_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <code className="text-primary">{row.dr_id}</code>
            <span className="font-normal text-muted-foreground">—</span>
            <span>{row.business_term}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* DR Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Mandatory</span>
              <p className="font-medium">{row.mandatory ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Coverage</span>
              <div className="mt-0.5"><CoverageStatusBadge status={row.coverageStatus} /></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Template</span>
              <p className="font-medium">{row.dataset_file || 'ASP-derived'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Column(s)</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {row.internal_columns.length > 0 ? row.internal_columns.map(c => (
                  <code key={c} className="text-xs bg-muted px-1.5 py-0.5 rounded">{c}</code>
                )) : <span className="text-xs text-muted-foreground italic">None</span>}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Population</span>
              <p className="font-medium">{row.populationPct !== null ? `${row.populationPct.toFixed(1)}%` : '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Responsibility</span>
              <p className="font-medium text-xs">{row.dataResponsibility}</p>
            </div>
          </div>

          <Separator />

          {/* Linked Rules */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Shield className="w-4 h-4 text-primary" />
              Linked Rules ({rules.length})
            </h4>
            {rules.length > 0 ? (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.rule_id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                    <div>
                      <code className="text-xs text-primary">{rule.rule_id}</code>
                      <p className="text-xs text-foreground">{rule.rule_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{rule.severity}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No validation rules linked to this DR</p>
            )}
          </div>

          <Separator />

          {/* Linked Controls */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Lock className="w-4 h-4 text-primary" />
              Linked Controls ({controls.length})
            </h4>
            {controls.length > 0 ? (
              <div className="space-y-2">
                {controls.map(ctrl => (
                  <div key={ctrl.control_id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                    <div>
                      <code className="text-xs text-primary">{ctrl.control_id}</code>
                      <p className="text-xs text-foreground">{ctrl.control_name}</p>
                      <p className="text-xs text-muted-foreground">{ctrl.description}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-xs', ctrl.control_type === 'preventive' ? 'border-blue-500/30 text-blue-600' : 'border-purple-500/30 text-purple-600')}>
                      {ctrl.control_type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No controls linked to this DR</p>
            )}
          </div>

          <Separator />

          {/* Linked Exceptions */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Open Exceptions ({drExceptions.length})
            </h4>
            {drExceptions.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {drExceptions.slice(0, 20).map(exc => (
                  <div key={exc.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
                    <Badge variant="outline" className={cn('text-xs shrink-0',
                      exc.severity === 'Critical' ? 'border-destructive/30 text-destructive' :
                      exc.severity === 'High' ? 'border-orange-500/30 text-orange-600' :
                      'border-accent/30 text-accent-foreground'
                    )}>{exc.severity}</Badge>
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{exc.message}</p>
                      <p className="text-muted-foreground">{exc.invoice_number || exc.buyer_id || '—'}</p>
                    </div>
                  </div>
                ))}
                {drExceptions.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{drExceptions.length - 20} more exceptions
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No exceptions for this DR</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
