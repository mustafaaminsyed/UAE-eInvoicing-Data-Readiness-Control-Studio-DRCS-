export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value === null) return 'N/A';
  return `${value.toFixed(digits)}%`;
}

export function progressTone(value: number) {
  if (value >= 90) return 'success';
  if (value >= 75) return 'warning';
  return 'danger';
}

export function readinessBand(score: number | null) {
  if (score === null) return { label: 'Awaiting data', tone: 'default' as const };
  if (score >= 90) return { label: 'Ready', tone: 'success' as const };
  if (score >= 75) return { label: 'Watch', tone: 'warning' as const };
  return { label: 'Blocked', tone: 'danger' as const };
}

export function describeReadiness(score: number | null, criticalIssues: number) {
  if (score === null) {
    return 'Readiness will appear after invoice data is loaded and validation outcomes exist for the current scope.';
  }

  if (criticalIssues > 0) {
    return 'Critical blockers are still active, so the portfolio should be treated as remediation-first rather than submission-ready.';
  }

  if (score >= 90) {
    return 'The current portfolio looks structurally stable and regulator-facing controls are largely in place.';
  }

  if (score >= 75) {
    return 'Core controls are forming well, but a limited group of data and rule defects still needs deliberate cleanup.';
  }

  return 'Readiness remains materially constrained by unresolved data quality, rule conformance, or scenario coverage issues.';
}

export function getRunModeBadge(runSummary: { run_mode?: string; readiness_qualification?: string; mapping_coverage_percent?: number | null } | null) {
  if (!runSummary?.run_mode) return null;

  if (runSummary.run_mode === 'diagnostic_mapping') {
    return {
      label: 'Diagnostic run',
      toneClass: 'border-amber-500/25 bg-amber-500/10 text-amber-700',
      detail:
        runSummary.mapping_coverage_percent !== null && runSummary.mapping_coverage_percent !== undefined
          ? `Mapped coverage ${Math.round(runSummary.mapping_coverage_percent)}%`
          : 'Partial mapping coverage',
    };
  }

  if (runSummary.run_mode === 'governed_mapping') {
    return {
      label: 'Governed mapping run',
      toneClass: 'border-primary/20 bg-primary/10 text-primary',
      detail:
        runSummary.mapping_coverage_percent !== null && runSummary.mapping_coverage_percent !== undefined
          ? `Mapped coverage ${Math.round(runSummary.mapping_coverage_percent)}%`
          : 'Mapped execution path',
    };
  }

  return {
    label: 'Raw template run',
    toneClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    detail:
      runSummary.readiness_qualification === 'diagnostic_only'
        ? 'Diagnostic only'
        : 'Canonical source columns detected',
  };
}
