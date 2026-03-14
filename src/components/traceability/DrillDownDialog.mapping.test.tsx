import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DrillDownDialog } from '@/components/traceability/DrillDownDialog';

describe('DrillDownDialog DR exception attribution', () => {
  it('filters exceptions by authoritative rule-to-DR linkage instead of pint reference terms', async () => {
    render(
      <MemoryRouter>
        <DrillDownDialog
          open
          onOpenChange={() => {}}
          row={{
            dr_id: 'IBT-003',
            business_term: 'Invoice type',
            mandatory: true,
            coverageStatus: 'COVERED',
            dataset_file: 'headers',
            internal_columns: ['invoice_type'],
            populationPct: 100,
            dataResponsibility: 'Seller',
            ruleIds: ['UAE-UC1-CHK-004'],
            ruleNames: ['Invoice type presence'],
            controlIds: [],
            controlNames: [],
            vatLawStatus: 'Legacy',
            isNewPintField: false,
            inTemplate: true,
            ingestible: true,
            lastRunPassRate: 100,
            category: 'Header',
            systemDefaultAllowed: false,
            exceptionCount: 1,
          }}
          exceptions={[
            {
              id: 'exc-mapped',
              check_id: 'UAE-UC1-CHK-004',
              check_name: 'Invoice type presence',
              severity: 'High',
              scope: 'Header',
              rule_type: 'structural_rule',
              execution_layer: 'schema',
              failure_class: 'structural_failure',
              pint_reference_terms: ['BTUAE-02'],
              message: 'Mapped through rule traceability',
              timestamp: '2026-03-14T10:00:00Z',
            },
            {
              id: 'exc-wrong-ref',
              check_id: 'UAE-UC1-CHK-014',
              check_name: 'Seller endpoint present',
              severity: 'High',
              scope: 'Header',
              rule_type: 'structural_rule',
              execution_layer: 'schema',
              failure_class: 'structural_failure',
              pint_reference_terms: ['IBT-003'],
              message: 'Metadata reference only',
              timestamp: '2026-03-14T10:00:01Z',
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText('Open Exceptions (1)')).toBeInTheDocument();
    expect(screen.getByText('Mapped through rule traceability')).toBeInTheDocument();
    expect(screen.queryByText('Metadata reference only')).not.toBeInTheDocument();
  });
});
