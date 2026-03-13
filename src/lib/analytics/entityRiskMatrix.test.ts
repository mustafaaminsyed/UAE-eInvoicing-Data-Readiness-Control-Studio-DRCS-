import { describe, expect, it } from 'vitest';
import {
  applyEntityRiskMatrixFilters,
  buildEntityRiskMatrixResult,
} from '@/lib/analytics/entityRiskMatrix';
import type { ComplianceRadarDimension } from '@/lib/analytics/complianceRadar';

const portfolioDimensions: ComplianceRadarDimension[] = [
  {
    key: 'mandatory_coverage',
    label: 'Mandatory Field Coverage',
    score: 88,
    explanation: 'baseline',
  },
  {
    key: 'pint_structure_readiness',
    label: 'PINT Structure Readiness',
    score: 84,
    explanation: 'baseline',
  },
  {
    key: 'tax_logic_integrity',
    label: 'Tax Logic Integrity',
    score: 82,
    explanation: 'baseline',
  },
  {
    key: 'codelist_conformance',
    label: 'Code List Conformance',
    score: 80,
    explanation: 'baseline',
  },
  {
    key: 'master_data_quality',
    label: 'Master Data Quality',
    score: 79,
    explanation: 'baseline',
  },
  {
    key: 'exception_control_health',
    label: 'Exception Control Health',
    score: 77,
    explanation: 'baseline',
  },
];

describe('buildEntityRiskMatrixResult', () => {
  it('builds seller rows with per-dimension cells, row banding, and approximation flags', () => {
    const result = buildEntityRiskMatrixResult({
      portfolio: { dimensions: portfolioDimensions },
      entities: {
        sellers: [
          {
            id: 'seller-a',
            run_id: 'run-1',
            entity_type: 'seller',
            entity_id: 'TRN-A',
            entity_name: 'Seller A',
            score: 72,
            total_exceptions: 5,
            critical_count: 1,
            high_count: 2,
            medium_count: 1,
            low_count: 1,
            created_at: '2026-03-13T00:00:00.000Z',
          },
          {
            id: 'seller-b',
            run_id: 'run-1',
            entity_type: 'seller',
            entity_id: 'TRN-B',
            entity_name: 'Seller B',
            score: 95,
            total_exceptions: 0,
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            low_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
          },
        ],
        clientHealth: [
          {
            id: 'health-a',
            seller_trn: 'TRN-A',
            client_name: 'Seller A Health',
            score: 68,
            rejection_rate: 0,
            critical_issues: 1,
            sla_breaches: 0,
            total_invoices: 3,
            total_rejections: 5,
            calculated_at: '2026-03-13T00:00:00.000Z',
          },
        ],
      },
      operational: {
        headers: [
          { invoice_id: '1', invoice_number: 'INV-1', issue_date: '2026-03-01', seller_trn: 'TRN-A', buyer_id: 'B1', currency: 'AED' },
          { invoice_id: '2', invoice_number: 'INV-2', issue_date: '2026-03-02', seller_trn: 'TRN-A', buyer_id: 'B2', currency: 'AED' },
          { invoice_id: '3', invoice_number: 'INV-3', issue_date: '2026-03-03', seller_trn: 'TRN-A', buyer_id: 'B3', currency: 'AED' },
          { invoice_id: '4', invoice_number: 'INV-4', issue_date: '2026-03-04', seller_trn: 'TRN-B', buyer_id: 'B4', currency: 'AED' },
          { invoice_id: '5', invoice_number: 'INV-5', issue_date: '2026-03-05', seller_trn: 'TRN-B', buyer_id: 'B5', currency: 'AED' },
          { invoice_id: '6', invoice_number: 'INV-6', issue_date: '2026-03-06', seller_trn: 'TRN-B', buyer_id: 'B6', currency: 'AED' },
          { invoice_id: '7', invoice_number: 'INV-7', issue_date: '2026-03-07', seller_trn: 'TRN-B', buyer_id: 'B7', currency: 'AED' },
          { invoice_id: '8', invoice_number: 'INV-8', issue_date: '2026-03-08', seller_trn: 'TRN-B', buyer_id: 'B8', currency: 'AED' },
          { invoice_id: '9', invoice_number: 'INV-9', issue_date: '2026-03-09', seller_trn: 'TRN-B', buyer_id: 'B9', currency: 'AED' },
        ],
        exceptions: [
          {
            id: 'ex-1',
            checkId: 'missing_mandatory_fields',
            checkName: 'Missing Mandatory Header Fields',
            severity: 'Critical',
            message: 'Mandatory seller field missing',
            sellerTrn: 'TRN-A',
            invoiceId: '1',
          },
          {
            id: 'ex-2',
            checkId: 'vat_calc_mismatch',
            checkName: 'VAT Calculation Mismatch',
            severity: 'High',
            message: 'VAT total mismatch',
            sellerTrn: 'TRN-A',
            invoiceId: '2',
          },
          {
            id: 'ex-3',
            checkId: 'buyer_trn_invalid_format',
            checkName: 'Buyer TRN Invalid Format',
            severity: 'Medium',
            message: 'Buyer TRN format invalid',
            sellerTrn: 'TRN-A',
            invoiceId: '3',
          },
        ],
      },
    });

    expect(result.rows).toHaveLength(2);

    const sellerA = result.rows.find((row) => row.entityId === 'TRN-A');
    expect(sellerA).toBeTruthy();
    expect(sellerA?.overallBand).toBe('watch');
    expect(sellerA?.sampleSizeWarning).toBe(true);

    const mandatoryCell = sellerA?.cells.find((cell) => cell.dimension === 'mandatory_coverage');
    expect(mandatoryCell?.isApproximation).toBe(true);
    expect(mandatoryCell?.sampleSizeWarning).toBe(true);
    expect(mandatoryCell?.drillDownMode).toBe('precise');

    const exceptionHealthCell = sellerA?.cells.find(
      (cell) => cell.dimension === 'exception_control_health'
    );
    expect(exceptionHealthCell?.isApproximation).toBe(false);
    expect(exceptionHealthCell?.drillDownMode).toBe('contextual');
  });

  it('filters and sorts rows using the shared helper', () => {
    const result = buildEntityRiskMatrixResult({
      portfolio: { dimensions: portfolioDimensions },
      entities: {
        sellers: [
          {
            id: 'seller-a',
            run_id: 'run-1',
            entity_type: 'seller',
            entity_id: 'TRN-A',
            entity_name: 'Seller A',
            score: 50,
            total_exceptions: 4,
            critical_count: 1,
            high_count: 1,
            medium_count: 1,
            low_count: 1,
            created_at: '2026-03-13T00:00:00.000Z',
          },
          {
            id: 'seller-b',
            run_id: 'run-1',
            entity_type: 'seller',
            entity_id: 'TRN-B',
            entity_name: 'Seller B',
            score: 92,
            total_exceptions: 0,
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            low_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
          },
        ],
        clientHealth: [],
      },
      operational: {
        headers: [
          { invoice_id: '1', invoice_number: 'INV-1', issue_date: '2026-03-01', seller_trn: 'TRN-A', buyer_id: 'B1', currency: 'AED' },
          { invoice_id: '2', invoice_number: 'INV-2', issue_date: '2026-03-02', seller_trn: 'TRN-B', buyer_id: 'B2', currency: 'AED' },
          { invoice_id: '3', invoice_number: 'INV-3', issue_date: '2026-03-03', seller_trn: 'TRN-B', buyer_id: 'B3', currency: 'AED' },
          { invoice_id: '4', invoice_number: 'INV-4', issue_date: '2026-03-04', seller_trn: 'TRN-B', buyer_id: 'B4', currency: 'AED' },
          { invoice_id: '5', invoice_number: 'INV-5', issue_date: '2026-03-05', seller_trn: 'TRN-B', buyer_id: 'B5', currency: 'AED' },
        ],
        exceptions: [
          {
            id: 'ex-1',
            checkId: 'missing_mandatory_fields',
            checkName: 'Missing Mandatory Header Fields',
            severity: 'Critical',
            message: 'Mandatory field missing',
            sellerTrn: 'TRN-A',
          },
        ],
      },
    });

    const filtered = applyEntityRiskMatrixFilters(result.rows, {
      search: 'seller',
      sortBy: 'lowest_score',
      rowLimit: 10,
      elevatedRiskOnly: true,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].entityId).toBe('TRN-A');
  });
});
