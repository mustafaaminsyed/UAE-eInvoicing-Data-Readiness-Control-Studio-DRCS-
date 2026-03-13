import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EntityRiskMatrixHeatmap from '@/components/dashboard/EntityRiskMatrixHeatmap';
import type { EntityRiskMatrixResult, EntityRiskMatrixRow } from '@/types/entityRiskMatrix';

const result: EntityRiskMatrixResult = {
  dimensions: [
    { key: 'mandatory_coverage', label: 'Mandatory Field Coverage', description: 'desc' },
    { key: 'pint_structure_readiness', label: 'PINT Structure Readiness', description: 'desc' },
    { key: 'tax_logic_integrity', label: 'Tax Logic Integrity', description: 'desc' },
    { key: 'codelist_conformance', label: 'Code List Conformance', description: 'desc' },
    { key: 'master_data_quality', label: 'Master Data Quality', description: 'desc' },
    { key: 'exception_control_health', label: 'Exception Control Health', description: 'desc' },
  ],
  rows: [],
  approximationNotes: [],
};

const rows: EntityRiskMatrixRow[] = [
  {
    entityId: 'TRN-001',
    entityName: 'Seller A',
    entityType: 'seller',
    invoiceCount: 3,
    totalExceptions: 4,
    criticalCount: 1,
    averageScore: 72,
    lowestScore: 58,
    overallBand: 'exposed',
    hasElevatedRisk: true,
    sampleSizeWarning: true,
    cells: [
      {
        entityId: 'TRN-001',
        dimension: 'mandatory_coverage',
        score: 58,
        band: 'critical',
        invoiceCount: 3,
        exceptionCount: 2,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        explanation: 'Estimated',
        isApproximation: true,
        sampleSizeWarning: true,
        drillDownMode: 'precise',
      },
      {
        entityId: 'TRN-001',
        dimension: 'pint_structure_readiness',
        score: 74,
        band: 'exposed',
        invoiceCount: 3,
        exceptionCount: 1,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        explanation: 'Estimated',
        isApproximation: true,
        sampleSizeWarning: true,
        drillDownMode: 'precise',
      },
      {
        entityId: 'TRN-001',
        dimension: 'tax_logic_integrity',
        score: 70,
        band: 'exposed',
        invoiceCount: 3,
        exceptionCount: 1,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        explanation: 'Direct',
        isApproximation: false,
        sampleSizeWarning: true,
        drillDownMode: 'precise',
      },
      {
        entityId: 'TRN-001',
        dimension: 'codelist_conformance',
        score: 81,
        band: 'watch',
        invoiceCount: 3,
        exceptionCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        explanation: 'Estimated',
        isApproximation: true,
        sampleSizeWarning: true,
        drillDownMode: 'precise',
      },
      {
        entityId: 'TRN-001',
        dimension: 'master_data_quality',
        score: 79,
        band: 'watch',
        invoiceCount: 3,
        exceptionCount: 1,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 1,
        lowCount: 0,
        explanation: 'Direct',
        isApproximation: false,
        sampleSizeWarning: true,
        drillDownMode: 'precise',
      },
      {
        entityId: 'TRN-001',
        dimension: 'exception_control_health',
        score: 68,
        band: 'exposed',
        invoiceCount: 3,
        exceptionCount: 4,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 1,
        lowCount: 1,
        explanation: 'Direct',
        isApproximation: false,
        sampleSizeWarning: true,
        drillDownMode: 'contextual',
      },
    ],
  },
];

describe('EntityRiskMatrixHeatmap', () => {
  it('renders compact controls and routes cell clicks through the callback', () => {
    const onFiltersChange = vi.fn();
    const onCellClick = vi.fn();

    render(
      <EntityRiskMatrixHeatmap
        result={{ ...result, rows }}
        rows={rows}
        filters={{
          search: '',
          sortBy: 'lowest_score',
          rowLimit: 25,
          elevatedRiskOnly: false,
        }}
        onFiltersChange={onFiltersChange}
        onCellClick={onCellClick}
      />
    );

    expect(screen.getByText('Entity Risk Matrix')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search seller or TRN')).toBeInTheDocument();
    expect(screen.getByText('Seller A')).toBeInTheDocument();
    expect(screen.getByText('~ estimated seller signal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /58 .*critical/i }));

    expect(onCellClick).toHaveBeenCalledWith({
      entityId: 'TRN-001',
      entityName: 'Seller A',
      dimension: 'mandatory_coverage',
      drillDownMode: 'precise',
    });
  });
});
