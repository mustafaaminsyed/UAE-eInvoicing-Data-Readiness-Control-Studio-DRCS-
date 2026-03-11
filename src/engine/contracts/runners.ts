import { Buyer, DataContext, CheckResult, Exception, InvoiceHeader } from '@/types/compliance';
import { MoFCoverageResult, MoFMappedColumnsInput } from '@/lib/coverage/mofCoverageEngine';
import { PintAECheck, PintAEException } from '@/types/pintAE';
import { Direction, OrganizationProfile } from '@/types/direction';

export interface CoreRunnerInput {
  dataContext: DataContext;
}

export interface CoreRunnerOutput {
  checkResults: CheckResult[];
}

export interface CoreRunner {
  run(input: CoreRunnerInput): CoreRunnerOutput;
}

export interface PintRunnerInput {
  dataContext: DataContext;
}

export interface PintRunnerOutput {
  checks: PintAECheck[];
  exceptions: PintAEException[];
}

export interface PintRunner {
  seedCheckPack(forceUpsert?: boolean): Promise<{ success: boolean; message: string }>;
  run(input: PintRunnerInput): Promise<PintRunnerOutput>;
}

export interface MoFReadinessRunnerInput {
  enabled: boolean;
  documentType: 'tax_invoice' | 'commercial_xml';
  threshold: number;
  strictNoBridge: boolean;
  mappedColumns: MoFMappedColumnsInput;
}

export interface MoFReadinessRunnerOutput {
  enabled: boolean;
  passed: boolean;
  reasons: string[];
  coverage: MoFCoverageResult | null;
}

export interface MoFReadinessRunner {
  evaluate(input: MoFReadinessRunnerInput): MoFReadinessRunnerOutput;
}

export interface OrgProfileRunnerInput {
  organizationProfile: OrganizationProfile;
  direction: Direction;
  headers: InvoiceHeader[];
  buyerMap: Map<string, Buyer>;
  uploadSessionId?: string;
  uploadManifestId?: string;
  mappingProfileId?: string;
  rulesetVersion?: string;
}

export interface OrgProfileRunnerOutput {
  exceptions: Exception[];
}

export interface OrgProfileRunner {
  run(input: OrgProfileRunnerInput): OrgProfileRunnerOutput;
}
