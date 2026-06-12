import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Database,
  FileDown,
  Inbox,
  LayoutDashboard,
  PlayCircle,
  Settings,
} from 'lucide-react';

export interface WorkflowShortcut {
  label: string;
  path: string;
}

export interface WorkflowSection {
  label: string;
  path: string;
  icon: LucideIcon;
  eyebrow: string;
  description: string;
  status: string;
  placeholder?: boolean;
  primaryJob: string;
  modules: string[];
  shortcuts?: WorkflowShortcut[];
}

export const WORKFLOW_SECTIONS: WorkflowSection[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    eyebrow: 'Executive overview',
    description: 'Track readiness, risk, and operational posture from a single workflow-oriented command surface.',
    status: 'Available',
    primaryJob: 'Surface the highest-signal readiness indicators and drive drill-down into active work.',
    modules: ['Readiness summary', 'Recent submission activity', 'Critical blockers'],
  },
  {
    label: 'Submissions',
    path: '/submissions',
    icon: Inbox,
    eyebrow: 'Dataset intake',
    description: 'Coordinate inbound datasets, submission states, and intake handoffs before validation begins.',
    status: 'Available',
    primaryJob: 'Give operations teams one place to intake, monitor, and triage incoming submissions.',
    modules: ['Submission queue', 'Upload health', 'Source-system handoff'],
    shortcuts: [
      { label: 'Open Upload Workspace', path: '/upload' },
      { label: 'Open Upload Audit', path: '/upload-audit' },
    ],
  },
  {
    label: 'Data Twin',
    path: '/data-twin',
    icon: Database,
    eyebrow: 'Invoice lineage',
    description: 'Anchor the digital twin view for invoice context, lineage, and explainable record-level inspection.',
    status: 'Available',
    primaryJob: 'Make invoice relationships and lineage understandable before exception handling or evidence assembly.',
    modules: ['Record lineage', 'Twin inspection', 'Context side panels'],
    shortcuts: [
      { label: 'Open Traceability', path: '/traceability' },
      { label: 'Open AP Explorer', path: '/ap-explorer' },
    ],
  },
  {
    label: 'Validation',
    path: '/validation',
    icon: PlayCircle,
    eyebrow: 'Deterministic checks',
    description: 'Hold the future validation orchestration flow, from readiness gates through governed rule execution.',
    status: 'Available',
    primaryJob: 'Guide operators from pre-run readiness to deterministic validation outputs with minimal ambiguity.',
    modules: ['Run controls', 'Rule execution states', 'Validation explainability'],
    shortcuts: [
      { label: 'Open Run Checks', path: '/run' },
      { label: 'Open Check Registry', path: '/check-registry' },
    ],
  },
  {
    label: 'Exceptions',
    path: '/exceptions',
    icon: AlertTriangle,
    eyebrow: 'Workflow resolution',
    description: 'Investigate validation findings, coordinate exception handling, and maintain regulator-friendly resolution context.',
    status: 'Available',
    primaryJob: 'Move findings from detection to accountable workflow resolution without losing traceability.',
    modules: ['Exception queue', 'Case assignment', 'Resolution history'],
    shortcuts: [
      { label: 'Open Cases', path: '/cases' },
      { label: 'Open Rejections', path: '/rejections' },
    ],
  },
  {
    label: 'Evidence',
    path: '/evidence',
    icon: FileDown,
    eyebrow: 'Audit-ready outputs',
    description: 'Package evidence, control narratives, and audit-supporting records into a reusable delivery workspace.',
    status: 'Available',
    primaryJob: 'Turn validation and exception activity into evidence outputs that are easy to review and export.',
    modules: ['Evidence timeline', 'Control narrative', 'Export packets'],
    shortcuts: [{ label: 'Open Evidence Pack', path: '/evidence-pack' }],
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    eyebrow: 'Operational insight',
    description: 'Host cross-run trends, readiness analytics, and executive reporting for the new workflow experience.',
    status: 'Preview',
    placeholder: true,
    primaryJob: 'Translate workflow activity into trends that leaders can use for prioritization and governance.',
    modules: ['Trend snapshots', 'Entity risk views', 'Program performance'],
    shortcuts: [{ label: 'Open Controls Dashboard', path: '/controls' }],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    eyebrow: 'Workspace configuration',
    description: 'Centralize environment controls, workflow preferences, and future shell-level configuration in one place.',
    status: 'Preview',
    placeholder: true,
    primaryJob: 'Provide a single configuration home for shell behavior, preferences, and governed workspace options.',
    modules: ['Environment settings', 'Workflow preferences', 'Access and policy'],
    shortcuts: [{ label: 'Open Controls Dashboard', path: '/controls' }],
  },
];

export function getWorkflowSection(pathname: string): WorkflowSection | undefined {
  return WORKFLOW_SECTIONS.find(
    (section) => pathname === section.path || pathname.startsWith(`${section.path}/`)
  );
}
