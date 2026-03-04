import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PipelineState = 'complete' | 'active' | 'pending' | 'blocked';

export interface PipelineStep {
  id: string;
  label: string;
  state: PipelineState;
}

interface PipelineProgressProps {
  steps: PipelineStep[];
}

const STATE_STYLES: Record<PipelineState, string> = {
  complete: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  active: 'bg-primary/15 text-primary border-primary/30',
  pending: 'bg-muted text-muted-foreground border-border',
  blocked: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function PipelineProgress({ steps }: PipelineProgressProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-lg p-4">
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3 min-w-max">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
                STATE_STYLES[step.state]
              )}
            >
              {step.state === 'complete' && <CheckCircle2 className="h-3.5 w-3.5" />}
              {step.state === 'active' && <Circle className="h-3.5 w-3.5 fill-current" />}
              {step.state === 'pending' && <Circle className="h-3.5 w-3.5" />}
              {step.state === 'blocked' && <Lock className="h-3.5 w-3.5" />}
              <span>{step.label}</span>
            </div>
            {index < steps.length - 1 && <span className="text-muted-foreground/50">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

