import { RunArtifact, LayerResult, Finding } from '@/engine/contracts';
import { mapLegacyExceptionsToFindings, mapPintExceptionsToFindings } from '@/engine/normalization';
import { defaultCoreRunner } from '@/engine/runners/core';
import { defaultPintRunner } from '@/engine/runners/pint';
import { defaultOrgProfileRunner } from '@/engine/runners/orgProfile';
import { DataContext, Exception, Severity, CheckResult, Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { Direction, OrganizationProfile } from '@/types/direction';
import { PintAECheck, PintAEException } from '@/types/pintAE';
import { resolveDirection } from '@/lib/direction/directionUtils';
import { EvidenceRuleExecutionTelemetryRow } from '@/types/evidence';

type OrchestratorOptions = {
  direction: Direction;
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  organizationProfile: OrganizationProfile;
  uploadSessionId?: string;
  uploadManifestId?: string;
  mappingProfileId?: string;
  rulesetVersion: string;
};

export interface RunChecksOrchestrationResult {
  dataContext: DataContext;
  builtInResults: CheckResult[];
  coreTelemetry: EvidenceRuleExecutionTelemetryRow[];
  pintAEChecks: PintAECheck[];
  pintExceptions: PintAEException[];
  pintTelemetry: EvidenceRuleExecutionTelemetryRow[];
  legacyPintExceptions: Exception[];
  orgProfileExceptions: Exception[];
  orgProfileTelemetry: EvidenceRuleExecutionTelemetryRow[];
  allExceptions: Exception[];
  runArtifact: RunArtifact;
}

function buildDataContext(buyers: Buyer[], headers: InvoiceHeader[], lines: InvoiceLine[]): DataContext {
  const buyerMap = new Map(buyers.map((buyer) => [buyer.buyer_id, buyer]));
  const headerMap = new Map(headers.map((header) => [header.invoice_id, header]));
  const linesByInvoice = new Map<string, InvoiceLine[]>();

  lines.forEach((line) => {
    if (!linesByInvoice.has(line.invoice_id)) {
      linesByInvoice.set(line.invoice_id, []);
    }
    linesByInvoice.get(line.invoice_id)!.push(line);
  });

  return { buyers, headers, lines, buyerMap, headerMap, linesByInvoice };
}

function mapPintExceptionsToLegacyExceptions(pintExceptions: PintAEException[]): Exception[] {
  return pintExceptions.map((exception) => ({
    id: exception.id,
    checkId: exception.check_id,
    checkName: exception.check_name,
    severity: exception.severity,
    message: exception.message,
    invoiceId: exception.invoice_id,
    invoiceNumber: exception.invoice_number,
    sellerTrn: exception.seller_trn,
    buyerId: exception.buyer_id,
    lineId: exception.line_id,
    field: exception.field_name,
    expectedValue: exception.expected_value_or_rule,
    actualValue: exception.observed_value,
  }));
}

function enrichLegacyExceptions(
  exceptions: Exception[],
  options: {
    direction: Direction;
    uploadSessionId?: string;
    uploadManifestId?: string;
    mappingProfileId?: string;
    rulesetVersion: string;
  }
): Exception[] {
  return exceptions.map((exception) => ({
    ...exception,
    datasetType: options.direction,
    direction: resolveDirection(exception.direction || options.direction),
    ruleId: exception.ruleId || exception.checkId,
    uploadSessionId: exception.uploadSessionId || options.uploadSessionId || undefined,
    uploadManifestId: exception.uploadManifestId || options.uploadManifestId || undefined,
    mappingProfileId: exception.mappingProfileId || options.mappingProfileId || undefined,
    rulesetVersion: exception.rulesetVersion || options.rulesetVersion,
    status: exception.status || 'Open',
  }));
}

function buildSeverityTotals(findings: Finding[]): Record<Severity, number> {
  const totals: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  findings.forEach((finding) => {
    totals[finding.severity]++;
  });
  return totals;
}

function buildLayerResult(layer: LayerResult['layer'], findings: Finding[]): LayerResult {
  return {
    layer,
    findings,
    totals: {
      findings: findings.length,
      bySeverity: buildSeverityTotals(findings),
    },
  };
}

export async function runChecksOrchestrator(
  options: OrchestratorOptions
): Promise<RunChecksOrchestrationResult> {
  const startedAt = new Date().toISOString();

  const dataContext = buildDataContext(options.buyers, options.headers, options.lines);

  // Keep execution order identical to current active flow.
  const {
    checkResults: builtInResults,
    telemetry: coreTelemetry,
  } = defaultCoreRunner.run({ dataContext });
  await defaultPintRunner.seedCheckPack(false);
  const {
    checks: pintAEChecks,
    exceptions: pintExceptions,
    telemetry: pintTelemetry,
  } = await defaultPintRunner.run({ dataContext });
  const legacyPintExceptions = mapPintExceptionsToLegacyExceptions(pintExceptions);
  const { exceptions: orgProfileExceptions, telemetry: orgProfileTelemetry } = defaultOrgProfileRunner.run({
    organizationProfile: options.organizationProfile,
    direction: options.direction,
    headers: options.headers,
    buyerMap: dataContext.buyerMap,
    uploadSessionId: options.uploadSessionId || undefined,
    uploadManifestId: options.uploadManifestId || undefined,
    mappingProfileId: options.mappingProfileId,
    rulesetVersion: options.rulesetVersion,
  });

  const allExceptions = enrichLegacyExceptions(
    [
      ...builtInResults.flatMap((result) => result.exceptions),
      ...legacyPintExceptions,
      ...orgProfileExceptions,
    ],
    {
      direction: options.direction,
      uploadSessionId: options.uploadSessionId,
      uploadManifestId: options.uploadManifestId,
      mappingProfileId: options.mappingProfileId,
      rulesetVersion: options.rulesetVersion,
    }
  );

  const coreFindings = mapLegacyExceptionsToFindings(
    builtInResults.flatMap((result) => result.exceptions),
    { layer: 'core' }
  );
  const pintFindings = mapPintExceptionsToFindings(pintExceptions);
  const orgFindings = mapLegacyExceptionsToFindings(orgProfileExceptions, { layer: 'custom' });

  const layerResults: LayerResult[] = [
    buildLayerResult('core', coreFindings),
    buildLayerResult('pint_ae', pintFindings),
    buildLayerResult('custom', orgFindings),
  ];
  const findings = [...coreFindings, ...pintFindings, ...orgFindings];

  const runArtifact: RunArtifact = {
    startedAt,
    endedAt: new Date().toISOString(),
    scope: options.direction,
    layerResults,
    findings,
    metadata: {
      builtInResults: builtInResults.length,
      coreTelemetryRules: coreTelemetry.length,
      pintChecks: pintAEChecks.length,
      pintExceptions: pintExceptions.length,
      pintTelemetryRules: pintTelemetry.length,
      orgProfileExceptions: orgProfileExceptions.length,
      orgProfileTelemetryRules: orgProfileTelemetry.length,
      allExceptions: allExceptions.length,
    },
  };

  return {
    dataContext,
    builtInResults,
    coreTelemetry,
    pintAEChecks,
    pintExceptions,
    pintTelemetry,
    legacyPintExceptions,
    orgProfileExceptions,
    orgProfileTelemetry,
    allExceptions,
    runArtifact,
  };
}
