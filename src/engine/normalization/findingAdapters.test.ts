import { describe, expect, it } from 'vitest';
import {
  mapLegacyExceptionToFinding,
  mapLegacyExceptionsToFindings,
  mapMoFReadinessOutputToFindings,
  mapPintExceptionToFinding,
  mapPintExceptionsToFindings,
} from '@/engine/normalization';
import { Exception } from '@/types/compliance';
import { MoFCoverageResult } from '@/lib/coverage/mofCoverageEngine';
import { PintAEException } from '@/types/pintAE';

describe('findingAdapters', () => {
  it('maps legacy Exception into canonical Finding and preserves key fields', () => {
    const legacy: Exception = {
      id: 'legacy-1',
      checkId: 'buyer_trn_missing',
      checkName: 'Buyer TRN Missing',
      severity: 'Critical',
      message: 'Buyer is missing TRN',
      datasetType: 'AR',
      direction: 'AR',
      invoiceId: 'INV-1',
      invoiceNumber: 'INV-1',
      sellerTrn: '100000000000001',
      buyerId: 'BUY-1',
      field: 'buyer_trn',
      expectedValue: '15-digit TRN',
      actualValue: '(empty)',
      validationRunId: 'run-1',
      mappingProfileId: 'map-1',
      ruleId: 'RULE-1',
      rulesetVersion: 'v1.0.0',
      status: 'Open',
    };

    const finding = mapLegacyExceptionToFinding(legacy);

    expect(finding.findingId).toBe('legacy-1');
    expect(finding.layer).toBe('core');
    expect(finding.kind).toBe('exception');
    expect(finding.checkId).toBe('buyer_trn_missing');
    expect(finding.severity).toBe('Critical');
    expect(finding.message).toBe('Buyer is missing TRN');
    expect(finding.observedValue).toBe('(empty)');
    expect(finding.references).toEqual(['RULE:RULE-1', 'MAPPING:map-1']);
    expect(finding.metadata?.rulesetVersion).toBe('v1.0.0');
  });

  it('infers PINT layer for legacy UAE-UC1 checks and supports batch mapping', () => {
    const legacyPint: Exception = {
      id: 'legacy-pint-1',
      checkId: 'UAE-UC1-CHK-001',
      checkName: 'Invoice Number Present',
      severity: 'Critical',
      message: 'Missing invoice number',
    };

    const [finding] = mapLegacyExceptionsToFindings([legacyPint]);
    expect(finding.layer).toBe('pint_ae');
  });

  it('maps PintAEException into canonical Finding and preserves semantic metadata', () => {
    const pintException: PintAEException = {
      id: 'pint-1',
      run_id: 'run-99',
      timestamp: '2026-03-10T10:00:00.000Z',
      dataset_type: 'AR',
      check_id: 'UAE-UC1-CHK-003',
      check_name: 'Invoice Issue Date Format',
      severity: 'High',
      scope: 'Header',
      rule_type: 'Format',
      use_case: 'UC1 Standard Tax Invoice',
      pint_reference_terms: ['IBT-002'],
      invoice_id: 'INV-2',
      invoice_number: 'INV-2',
      seller_trn: '100000000000002',
      buyer_id: 'BUY-2',
      field_name: 'issue_date',
      observed_value: '10-03-2026',
      expected_value_or_rule: '^\\d{4}-\\d{2}-\\d{2}$',
      message: 'Issue date format invalid',
      suggested_fix: 'Use YYYY-MM-DD',
      root_cause_category: 'Format Non-Compliance',
      owner_team: 'Client IT',
      sla_target_hours: 24,
      case_status: 'Open',
    };

    const finding = mapPintExceptionToFinding(pintException);
    const batch = mapPintExceptionsToFindings([pintException]);

    expect(finding.layer).toBe('pint_ae');
    expect(finding.checkId).toBe('UAE-UC1-CHK-003');
    expect(finding.references).toEqual(['IBT-002']);
    expect(finding.field).toBe('issue_date');
    expect(finding.metadata?.scope).toBe('Header');
    expect(batch).toHaveLength(1);
    expect(batch[0].findingId).toBe('pint-1');
  });

  it('maps MoF readiness output into canonical findings with default gap-only behavior', () => {
    const mofResult: MoFCoverageResult = {
      sourceSchema: 'UAE_eInvoice_MoF_Source_Schema_v1',
      sourceVersion: '1.0.0',
      documentType: 'tax_invoice',
      totalFields: 2,
      mandatoryFields: 2,
      coveredMandatory: 1,
      mandatoryNotInTemplate: 1,
      mandatoryNotIngestible: 0,
      mandatoryNoBridge: 0,
      mandatoryCoveragePct: 50,
      mappableMandatoryFields: 2,
      mappableCoveredMandatory: 1,
      mappableMandatoryCoveragePct: 50,
      rows: [
        {
          documentType: 'tax_invoice',
          fieldId: 1,
          fieldName: 'Invoice number',
          sectionId: '4.1',
          mandatory: true,
          sourceStatus: 'source_literal',
          dataset: 'headers',
          columns: ['invoice_number'],
          inTemplate: false,
          ingestible: true,
          status: 'NOT_IN_TEMPLATE',
        },
        {
          documentType: 'tax_invoice',
          fieldId: 2,
          fieldName: 'Issue date',
          sectionId: '4.1',
          mandatory: true,
          sourceStatus: 'source_literal',
          dataset: 'headers',
          columns: ['issue_date'],
          inTemplate: true,
          ingestible: true,
          status: 'COVERED',
        },
      ],
    };

    const gapOnly = mapMoFReadinessOutputToFindings(mofResult);
    const includeCovered = mapMoFReadinessOutputToFindings(mofResult, { includeCovered: true });

    expect(gapOnly).toHaveLength(1);
    expect(gapOnly[0].layer).toBe('mof_readiness');
    expect(gapOnly[0].kind).toBe('readiness');
    expect(gapOnly[0].severity).toBe('Critical');
    expect(gapOnly[0].checkId).toBe('MOF-tax_invoice-FIELD-1');
    expect(gapOnly[0].message).toContain('not mapped in template columns');

    expect(includeCovered).toHaveLength(2);
    expect(includeCovered[1].observedValue).toBe('COVERED');
    expect(includeCovered[1].severity).toBe('Low');
  });
});
