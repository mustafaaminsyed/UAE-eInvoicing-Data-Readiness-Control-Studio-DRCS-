import { ArrowRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getWorkflowSection } from '@/components/dashboard/workflowSections';
import { cn } from '@/lib/utils';

interface WorkflowSectionPageProps {
  sectionPath: string;
}

export default function WorkflowSectionPage({ sectionPath }: WorkflowSectionPageProps) {
  const section = getWorkflowSection(sectionPath);

  if (!section) {
    return null;
  }

  const SectionIcon = section.icon;

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="surface-glass rounded-[28px] border-border/70 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4">
            <span
              className={cn(
                'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                section.placeholder
                  ? 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
                  : 'border-primary/15 bg-primary/10 text-primary'
              )}
            >
              <Clock3 className="h-3.5 w-3.5" />
              {section.status}
            </span>
            <div className="space-y-2">
              <CardTitle className="text-xl">Section preview</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                This workspace is staged inside the new shell and will become a dedicated
                workflow view. You can use the related areas below while the full experience is
                being shaped.
              </CardDescription>
            </div>
            {section.shortcuts?.length ? (
              <div className="flex flex-wrap gap-2.5">
                {section.shortcuts.map((shortcut) => (
                  <Button asChild key={shortcut.path} variant="outline" className="h-10 rounded-full px-4">
                    <Link to={shortcut.path}>
                      {shortcut.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary">
            <SectionIcon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="rounded-2xl border-border/70 bg-card/92 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)]">
          <CardHeader className="p-5 pb-2.5">
            <CardTitle className="text-lg">Purpose</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-sm leading-6 text-muted-foreground">{section.primaryJob}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/92 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)]">
          <CardHeader className="p-5 pb-2.5">
            <CardTitle className="text-lg">Planned Modules</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {section.modules.map((module) => (
                <li key={module} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  {module}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/92 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)]">
          <CardHeader className="p-5 pb-2.5">
            <CardTitle className="text-lg">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0 text-sm text-muted-foreground">
            <p>The shared navigation and workspace framing are already in place.</p>
            <p>This section currently acts as a guided preview rather than a full workflow surface.</p>
            <p>Dedicated content can be added here without changing the shell structure.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
