import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  BookCheck,
  Briefcase,
  Database,
  FileClock,
  FileDown,
  FileOutput,
  FileUp,
  Inbox,
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Wand2,
  XCircle,
} from 'lucide-react';

export type NavigationGroup =
  | 'Overview'
  | 'Data Preparation'
  | 'Assessment'
  | 'Results & Evidence'
  | 'Settings & More';

export interface OperationalNavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  group: NavigationGroup;
  placeholder?: boolean;
  featureFlag?: 'casesMenu';
}

export const NAVIGATION_GROUP_ORDER: NavigationGroup[] = [
  'Overview',
  'Data Preparation',
  'Assessment',
  'Results & Evidence',
  'Settings & More',
];

export const OPERATIONAL_NAVIGATION: OperationalNavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'Overview' },
  { label: 'Submissions', path: '/submissions', icon: Inbox, group: 'Data Preparation' },
  { label: 'Upload data', path: '/upload', icon: FileUp, group: 'Data Preparation' },
  { label: 'Mapping studio', path: '/mapping', icon: Wand2, group: 'Data Preparation' },
  { label: 'Upload audit', path: '/upload-audit', icon: FileClock, group: 'Data Preparation' },
  { label: 'Data Twin', path: '/data-twin', icon: Database, group: 'Data Preparation' },
  { label: 'AP Explorer', path: '/ap-explorer', icon: Search, group: 'Data Preparation' },
  { label: 'Run checks', path: '/run', icon: PlayCircle, group: 'Assessment' },
  { label: 'Validation', path: '/validation', icon: ListChecks, group: 'Assessment' },
  { label: 'Check registry', path: '/check-registry', icon: BookCheck, group: 'Assessment' },
  { label: 'Check builder', path: '/check-builder', icon: SlidersHorizontal, group: 'Assessment' },
  { label: 'Exceptions', path: '/exceptions', icon: AlertTriangle, group: 'Results & Evidence' },
  { label: 'Cases', path: '/cases', icon: Briefcase, group: 'Results & Evidence', featureFlag: 'casesMenu' },
  { label: 'Rejections', path: '/rejections', icon: XCircle, group: 'Results & Evidence' },
  { label: 'Traceability', path: '/traceability', icon: Shield, group: 'Results & Evidence' },
  { label: 'Evidence', path: '/evidence', icon: FileDown, group: 'Results & Evidence' },
  { label: 'Evidence pack', path: '/evidence-pack', icon: FileOutput, group: 'Results & Evidence' },
  { label: 'Controls dashboard', path: '/controls', icon: BarChart3, group: 'Settings & More' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, group: 'Settings & More', placeholder: true },
  { label: 'Settings', path: '/settings', icon: Settings, group: 'Settings & More', placeholder: true },
];

export function getVisibleOperationalNavigation(casesEnabled: boolean): OperationalNavigationItem[] {
  return OPERATIONAL_NAVIGATION.filter((item) => item.featureFlag !== 'casesMenu' || casesEnabled);
}

export function isNavigationRestricted(path: string, isDataLoaded: boolean, isChecksRun: boolean): boolean {
  if (path === '/run' && !isDataLoaded) return true;
  return (path === '/dashboard' || path === '/exceptions') && !isChecksRun;
}
