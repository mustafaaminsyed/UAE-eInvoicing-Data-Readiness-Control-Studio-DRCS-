import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MappingCoveragePanel } from '@/components/mapping/MappingCoveragePanel';
import type { FieldMapping } from '@/types/fieldMapping';

const mapping: FieldMapping = {
  id: 'mapping-1',
  erpColumn: 'invoice_number',
  erpColumnIndex: 0,
  targetField: {
    id: 'invoice_number',
    name: 'Invoice Number',
    description: 'Unique invoice identifier',
    ibtReference: 'IBT-001',
    category: 'header',
    isMandatory: true,
    dataType: 'string',
  },
  confidence: 1,
  isConfirmed: true,
  transformations: [],
  sampleValues: ['INV-001'],
};

describe('MappingCoveragePanel UX', () => {
  it('separates uploaded file fit from broader dataset coverage', () => {
    render(<MappingCoveragePanel mappings={[mapping]} datasetType="header" totalSourceColumns={25} />);

    expect(screen.getByText('Uploaded File Fit')).toBeInTheDocument();
    expect(screen.getByText('Supported Dataset Coverage')).toBeInTheDocument();
    expect(screen.getByText('Registry Coverage')).toBeInTheDocument();
    expect(screen.getByText(/This measures how completely the uploaded file mapped/i)).toBeInTheDocument();
    expect(screen.getByText(/This shows how much of the selected dataset model is covered/i)).toBeInTheDocument();
  });
});
