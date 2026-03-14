import { describe, expect, it } from 'vitest';

import { buildEvidencePackData } from '@/lib/evidence/evidenceDataBuilder';
import { computeAllDatasetPopulations } from '@/lib/coverage/populationCoverage';
import { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { PintAEException } from '@/types/pintAE';

function toRawRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((item) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      row[key] = value != null ? String(value) : '';
    }
    return row;
  });
}

describe('buildEvidencePackData telemetry', () => {
  it('prefers runtime telemetry over estimated execution counts when provided', () => {
    const buyers: Buyer[] = [
      { buyer_id: 'B-1', buyer_name: 'Buyer One' },
    ];
    const headers: InvoiceHeader[] = [
      {
        invoice_id: 'INV-1',
        invoice_number: 'INV-001',
        issue_date: '2026-03-14',
        seller_trn: '123456789012345',
        buyer_id: 'B-1',
        currency: 'AED',
      },
    ];
    const lines: InvoiceLine[] = [
      {
        line_id: 'L-1',
        invoice_id: 'INV-1',
        line_number: 1,
        quantity: 1,
        unit_price: 100,
        line_total_excl_vat: 100,
        vat_rate: 5,
        vat_amount: 5,
      },
    ];
    const exceptions: PintAEException[] = [
      {
        id: 'exc-1',
        timestamp: '2026-03-14T10:00:00.000Z',
        check_id: 'UAE-UC1-CHK-001',
        check_name: 'Invoice Number Present',
        severity: 'Critical',
        scope: 'Header',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        pint_reference_terms: ['IBT-001'],
        invoice_id: 'INV-1',
        invoice_number: 'INV-001',
        message: 'Invoice number missing',
        root_cause_category: 'Unclassified',
        owner_team: 'Client Finance',
        sla_target_hours: 4,
        case_status: 'Open',
      },
    ];

    const populations = computeAllDatasetPopulations({
      buyers: toRawRows(buyers as unknown as Record<string, unknown>[]),
      headers: toRawRows(headers as unknown as Record<string, unknown>[]),
      lines: toRawRows(lines as unknown as Record<string, unknown>[]),
    });

    const evidence = buildEvidencePackData(
      'run-1',
      '2026-03-14T10:00:00.000Z',
      buyers,
      headers,
      lines,
      exceptions,
      populations,
      {
        executionTelemetry: [
          {
            rule_id: 'UAE-UC1-CHK-001',
            execution_count: 7,
            failure_count: 3,
            execution_source: 'runtime',
          },
        ],
      }
    );

    const invoiceNumberRule = evidence.ruleExecution.find((row) => row.rule_id === 'UAE-UC1-CHK-001');
    expect(invoiceNumberRule).toMatchObject({
      execution_count: 7,
      failure_count: 3,
      execution_source: 'runtime',
    });
  });

  it('includes explicit execution rows for core and org-profile telemetry', () => {
    const evidence = buildEvidencePackData(
      'run-2',
      '2026-03-14T10:00:00.000Z',
      [],
      [],
      [],
      [],
      [],
      {
        executionTelemetry: [
          {
            rule_id: 'missing_mandatory_fields',
            execution_count: 12,
            failure_count: 2,
            execution_source: 'runtime',
          },
          {
            rule_id: 'org_profile_our_entity_alignment',
            execution_count: 12,
            failure_count: 1,
            execution_source: 'runtime',
          },
        ],
      }
    );

    expect(evidence.ruleExecution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: 'missing_mandatory_fields',
          rule_name: 'Missing Mandatory Header Fields',
          execution_layer: 'schema',
          execution_count: 12,
          failure_count: 2,
          execution_source: 'runtime',
        }),
        expect.objectContaining({
          rule_id: 'org_profile_our_entity_alignment',
          rule_name: 'Our-side TRN Alignment',
          execution_layer: 'national_rule',
          execution_count: 12,
          failure_count: 1,
          execution_source: 'runtime',
        }),
      ])
    );
  });
});
