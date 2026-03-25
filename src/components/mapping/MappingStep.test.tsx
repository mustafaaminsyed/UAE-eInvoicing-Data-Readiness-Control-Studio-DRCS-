import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MappingStep } from '@/components/mapping/MappingStep';
import type { ERPPreviewData, FieldMapping } from '@/types/fieldMapping';
import { getPintFieldById } from '@/types/fieldMapping';

describe('MappingStep', () => {
  it('highlights the exact focused field row from the Digital Twin context', () => {
    const previewData: ERPPreviewData = {
      fileName: 'headers.csv',
      columns: ['seller_trn', 'seller_name'],
      detectedColumns: [],
      rows: [{ seller_trn: '100000000000001', seller_name: 'Dariba Live LLC' }],
      totalRows: 1,
      datasetType: 'header',
    };

    const mappings: FieldMapping[] = [
      {
        id: 'mapping-seller-trn',
        erpColumn: 'seller_trn',
        erpColumnIndex: 0,
        targetField: getPintFieldById('seller_trn')!,
        confidence: 0.98,
        isConfirmed: true,
        transformations: [],
        sampleValues: ['100000000000001'],
      },
      {
        id: 'mapping-seller-name',
        erpColumn: 'seller_name',
        erpColumnIndex: 1,
        targetField: getPintFieldById('seller_name')!,
        confidence: 0.95,
        isConfirmed: true,
        transformations: [],
        sampleValues: ['Dariba Live LLC'],
      },
    ];

    const { container } = render(
      <MappingStep
        previewData={previewData}
        mappings={mappings}
        onMappingsChange={vi.fn()}
        focusedField="seller_trn"
      />
    );

    expect(screen.getByDisplayValue('seller_trn')).toBeInTheDocument();
    expect(screen.getByText(/focused from digital twin on/i)).toBeInTheDocument();

    const focusedRow = container.querySelector('tr[data-focused-match="true"]');
    expect(focusedRow).toHaveAttribute('data-focused-match', 'true');
    expect(focusedRow).toHaveTextContent('seller_trn');
    expect(screen.queryByText('seller_name')).not.toBeInTheDocument();
  });
});
