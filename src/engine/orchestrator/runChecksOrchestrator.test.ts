import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runChecksOrchestrator } from '@/engine/orchestrator';
import { runAllChecksWithTelemetry } from '@/lib/checks/checksRegistry';
import { runAllPintAEChecksWithTelemetry } from '@/lib/checks/pintAECheckRunner';
import { buildOrganizationProfileExceptions } from '@/lib/validation/rulesetRouter';
import { fetchEnabledPintAEChecks, seedUC1CheckPack } from '@/lib/api/pintAEApi';
import { CheckResult, Exception, ParsedData } from '@/types/compliance';
import { PintAECheck, PintAEException } from '@/types/pintAE';
import { OrganizationProfile } from '@/types/direction';

vi.mock('@/lib/checks/checksRegistry', () => ({
  runAllChecksWithTelemetry: vi.fn(),
}));

vi.mock('@/lib/checks/pintAECheckRunner', () => ({
  runAllPintAEChecksWithTelemetry: vi.fn(),
}));

vi.mock('@/lib/validation/rulesetRouter', () => ({
  buildOrganizationProfileExceptions: vi.fn(),
}));

vi.mock('@/lib/api/pintAEApi', () => ({
  fetchEnabledPintAEChecks: vi.fn(),
  seedUC1CheckPack: vi.fn(),
}));

describe('runChecksOrchestrator', () => {
  const mockedRunAllChecksWithTelemetry = vi.mocked(runAllChecksWithTelemetry);
  const mockedRunAllPintAEChecksWithTelemetry = vi.mocked(runAllPintAEChecksWithTelemetry);
  const mockedBuildOrganizationProfileExceptions = vi.mocked(buildOrganizationProfileExceptions);
  const mockedFetchEnabledPintAEChecks = vi.mocked(fetchEnabledPintAEChecks);
  const mockedSeedUC1CheckPack = vi.mocked(seedUC1CheckPack);

  const parsedData: ParsedData = {
    buyers: [{ buyer_id: 'B-1', buyer_name: 'Buyer One', buyer_trn: '100000000000001' }],
    headers: [
      {
        invoice_id: 'INV-1',
        invoice_number: 'A-1001',
        issue_date: '2026-03-11',
        seller_trn: '123456789012345',
        buyer_id: 'B-1',
        currency: 'AED',
      },
    ],
    lines: [
      {
        line_id: 'LINE-1',
        invoice_id: 'INV-1',
        line_number: 1,
        quantity: 1,
        unit_price: 100,
        line_total_excl_vat: 100,
        vat_rate: 5,
        vat_amount: 5,
      },
    ],
  };

  const orgProfile: OrganizationProfile = {
    ourEntityTRNs: ['123456789012345'],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockedSeedUC1CheckPack.mockResolvedValue({ success: true, message: 'ok' });
    mockedFetchEnabledPintAEChecks.mockResolvedValue([]);
    mockedRunAllChecksWithTelemetry.mockReturnValue({ checkResults: [], telemetry: [] });
    mockedRunAllPintAEChecksWithTelemetry.mockReturnValue({ exceptions: [], telemetry: [] });
    mockedBuildOrganizationProfileExceptions.mockReturnValue([]);
  });

  it('preserves total exception count and execution order', async () => {
    const builtInExceptions: Exception[] = [
      {
        id: 'core-1',
        checkId: 'buyer_trn_missing',
        checkName: 'Buyer TRN Missing',
        severity: 'Critical',
        message: 'Missing TRN',
        buyerId: 'B-1',
      },
      {
        id: 'core-2',
        checkId: 'duplicate_invoice_number',
        checkName: 'Duplicate Invoice Number',
        severity: 'High',
        message: 'Duplicate invoice',
        invoiceId: 'INV-1',
      },
    ];
    const builtInResults: CheckResult[] = [
      {
        checkId: 'buyer_trn_missing',
        checkName: 'Buyer TRN Missing',
        severity: 'Critical',
        passed: 0,
        failed: 1,
        exceptions: [builtInExceptions[0]],
      },
      {
        checkId: 'duplicate_invoice_number',
        checkName: 'Duplicate Invoice Number',
        severity: 'High',
        passed: 0,
        failed: 1,
        exceptions: [builtInExceptions[1]],
      },
    ];

    const pintChecks: PintAECheck[] = [
      {
        check_id: 'UAE-UC1-CHK-001',
        check_name: 'Invoice Number Present',
        scope: 'Header',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        severity: 'Critical',
        pint_reference_terms: ['IBT-001'],
        owner_team_default: 'Client Finance',
        is_enabled: true,
        parameters: { field: 'invoice_number' },
      },
    ];
    const pintExceptions: PintAEException[] = [
      {
        id: 'pint-1',
        timestamp: '2026-03-11T01:00:00.000Z',
        check_id: 'UAE-UC1-CHK-001',
        check_name: 'Invoice Number Present',
        severity: 'Critical',
        scope: 'Header',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        pint_reference_terms: ['IBT-001'],
        invoice_id: 'INV-1',
        invoice_number: 'A-1001',
        seller_trn: '123456789012345',
        buyer_id: 'B-1',
        field_name: 'invoice_number',
        observed_value: '(empty)',
        expected_value_or_rule: 'Required value',
        message: 'Invoice number missing',
        root_cause_category: 'Unclassified',
        owner_team: 'Client Finance',
        sla_target_hours: 4,
        case_status: 'Open',
      },
    ];

    const orgExceptions: Exception[] = [
      {
        id: 'org-1',
        checkId: 'org_profile_our_entity_alignment',
        checkName: 'Our-side TRN Alignment',
        severity: 'Critical',
        message: 'TRN not aligned',
      },
    ];

    mockedRunAllChecksWithTelemetry.mockReturnValue({
      checkResults: builtInResults,
      telemetry: [
        {
          rule_id: 'buyer_trn_missing',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
        {
          rule_id: 'duplicate_invoice_number',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
    });
    mockedFetchEnabledPintAEChecks.mockResolvedValue(pintChecks);
    mockedRunAllPintAEChecksWithTelemetry.mockReturnValue({
      exceptions: pintExceptions,
      telemetry: [
        {
          rule_id: 'UAE-UC1-CHK-001',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
    });
    mockedBuildOrganizationProfileExceptions.mockReturnValue(orgExceptions);

    const result = await runChecksOrchestrator({
      direction: 'AR',
      buyers: parsedData.buyers,
      headers: parsedData.headers,
      lines: parsedData.lines,
      organizationProfile: orgProfile,
      mappingProfileId: 'map-1',
      rulesetVersion: 'v1.0.0',
    });

    expect(result.allExceptions).toHaveLength(4);
    expect(result.allExceptions.map((e) => e.checkId)).toEqual([
      'buyer_trn_missing',
      'duplicate_invoice_number',
      'UAE-UC1-CHK-001',
      'org_profile_our_entity_alignment',
    ]);

    const runAllChecksOrder = mockedRunAllChecksWithTelemetry.mock.invocationCallOrder[0];
    const seedOrder = mockedSeedUC1CheckPack.mock.invocationCallOrder[0];
    const fetchChecksOrder = mockedFetchEnabledPintAEChecks.mock.invocationCallOrder[0];
    const runPintOrder = mockedRunAllPintAEChecksWithTelemetry.mock.invocationCallOrder[0];
    const orgProfileOrder = mockedBuildOrganizationProfileExceptions.mock.invocationCallOrder[0];
    expect(runAllChecksOrder).toBeLessThan(seedOrder);
    expect(seedOrder).toBeLessThan(fetchChecksOrder);
    expect(fetchChecksOrder).toBeLessThan(runPintOrder);
    expect(runPintOrder).toBeLessThan(orgProfileOrder);
  });

  it('preserves built-in, PINT, and org-profile raw outputs', async () => {
    const builtInResults: CheckResult[] = [
      {
        checkId: 'missing_mandatory_fields',
        checkName: 'Missing Mandatory Header Fields',
        severity: 'Critical',
        passed: 0,
        failed: 1,
        exceptions: [
          {
            id: 'core-raw-1',
            checkId: 'missing_mandatory_fields',
            checkName: 'Missing Mandatory Header Fields',
            severity: 'Critical',
            message: 'Missing invoice_id',
          },
        ],
      },
    ];
    const pintExceptions: PintAEException[] = [
      {
        id: 'pint-raw-1',
        timestamp: '2026-03-11T01:00:00.000Z',
        check_id: 'UAE-UC1-CHK-010',
        check_name: 'Specification Identifier',
        severity: 'High',
        scope: 'Header',
        rule_type: 'structural_rule',
        execution_layer: 'national_rule',
        pint_reference_terms: ['IBT-024'],
        message: 'Invalid specification identifier',
        root_cause_category: 'Unclassified',
        owner_team: 'Client IT',
        sla_target_hours: 24,
        case_status: 'Open',
      },
    ];
    const orgExceptions: Exception[] = [
      {
        id: 'org-raw-1',
        checkId: 'org_profile_our_entity_alignment',
        checkName: 'Our-side TRN Alignment',
        severity: 'Critical',
        message: 'AR seller TRN mismatch',
      },
    ];

    mockedRunAllChecksWithTelemetry.mockReturnValue({
      checkResults: builtInResults,
      telemetry: [
        {
          rule_id: 'missing_mandatory_fields',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
    });
    mockedRunAllPintAEChecksWithTelemetry.mockReturnValue({
      exceptions: pintExceptions,
      telemetry: [
        {
          rule_id: 'UAE-UC1-CHK-010',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
    });
    mockedBuildOrganizationProfileExceptions.mockReturnValue(orgExceptions);

    const result = await runChecksOrchestrator({
      direction: 'AR',
      buyers: parsedData.buyers,
      headers: parsedData.headers,
      lines: parsedData.lines,
      organizationProfile: orgProfile,
      rulesetVersion: 'v1.0.0',
    });

    expect(result.builtInResults).toEqual(builtInResults);
    expect(result.coreTelemetry).toEqual([
      {
        rule_id: 'missing_mandatory_fields',
        execution_count: 1,
        failure_count: 1,
        execution_source: 'runtime',
      },
    ]);
    expect(result.pintExceptions).toEqual(pintExceptions);
    expect(result.pintTelemetry).toEqual([
      {
        rule_id: 'UAE-UC1-CHK-010',
        execution_count: 1,
        failure_count: 1,
        execution_source: 'runtime',
      },
    ]);
    expect(result.orgProfileExceptions).toEqual(orgExceptions);
    expect(result.legacyPintExceptions).toEqual([
      {
        id: 'pint-raw-1',
        checkId: 'UAE-UC1-CHK-010',
        checkName: 'Specification Identifier',
        severity: 'High',
        message: 'Invalid specification identifier',
        invoiceId: undefined,
        invoiceNumber: undefined,
        sellerTrn: undefined,
        buyerId: undefined,
        lineId: undefined,
        field: undefined,
        expectedValue: undefined,
        actualValue: undefined,
      },
    ]);
  });

  it('produces canonical findings that map back to existing outputs', async () => {
    mockedRunAllChecksWithTelemetry.mockReturnValue({
      checkResults: [
        {
          checkId: 'buyer_trn_missing',
          checkName: 'Buyer TRN Missing',
          severity: 'Critical',
          passed: 0,
          failed: 1,
          exceptions: [
            {
              id: 'core-find-1',
              checkId: 'buyer_trn_missing',
              checkName: 'Buyer TRN Missing',
              severity: 'Critical',
              message: 'Buyer missing TRN',
            },
          ],
        },
      ],
      telemetry: [
        {
          rule_id: 'buyer_trn_missing',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
    });
    mockedRunAllPintAEChecksWithTelemetry.mockReturnValue({
      exceptions: [
        {
          id: 'pint-find-1',
          timestamp: '2026-03-11T01:00:00.000Z',
          check_id: 'UAE-UC1-CHK-001',
          check_name: 'Invoice Number Present',
          severity: 'Critical',
          scope: 'Header',
          rule_type: 'structural_rule',
          execution_layer: 'schema',
          pint_reference_terms: ['IBT-001'],
          message: 'Invoice number missing',
          root_cause_category: 'Unclassified',
          owner_team: 'Client Finance',
          sla_target_hours: 4,
          case_status: 'Open',
        },
      ],
      telemetry: [
        {
          rule_id: 'UAE-UC1-CHK-001',
          execution_count: 1,
          failure_count: 1,
          execution_source: 'runtime',
        },
      ],
    });
    mockedBuildOrganizationProfileExceptions.mockReturnValue([
      {
        id: 'org-find-1',
        checkId: 'org_profile_our_entity_alignment',
        checkName: 'Our-side TRN Alignment',
        severity: 'Critical',
        message: 'TRN alignment issue',
      },
    ]);

    const result = await runChecksOrchestrator({
      direction: 'AR',
      buyers: parsedData.buyers,
      headers: parsedData.headers,
      lines: parsedData.lines,
      organizationProfile: orgProfile,
      rulesetVersion: 'v1.0.0',
    });

    expect(result.runArtifact.findings).toHaveLength(3);
    const layers = result.runArtifact.layerResults.map((layer) => ({
      layer: layer.layer,
      findings: layer.totals.findings,
    }));
    expect(layers).toEqual([
      { layer: 'core', findings: 1 },
      { layer: 'pint_ae', findings: 1 },
      { layer: 'custom', findings: 1 },
    ]);
    expect(result.runArtifact.findings.map((finding) => finding.findingId)).toEqual([
      'core-find-1',
      'pint-find-1',
      'org-find-1',
    ]);
    expect(result.runArtifact.findings.map((finding) => finding.checkId)).toEqual([
      'buyer_trn_missing',
      'UAE-UC1-CHK-001',
      'org_profile_our_entity_alignment',
    ]);
  });
});
