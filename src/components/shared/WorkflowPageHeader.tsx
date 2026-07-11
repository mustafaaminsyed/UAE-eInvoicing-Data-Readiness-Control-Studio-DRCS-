import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkflowPageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  align?: 'center' | 'split';
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  descriptionClassName?: string;
}

export function WorkflowPageHeader({
  title,
  description,
  icon,
  align = 'split',
  meta,
  actions,
  className,
  descriptionClassName,
}: WorkflowPageHeaderProps) {
  if (align === 'center') {
    return (
      <div className={cn('text-center', className)}>
        {icon ? (
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className={cn('mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground', descriptionClassName)}>
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{meta}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between', className)}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-[2rem]">
              {title}
            </h1>
            {description ? (
              <p className={cn('mt-1 max-w-3xl text-sm leading-6 text-muted-foreground', descriptionClassName)}>
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  );
}
