import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FileSummaryCard, type FileStats } from '@/components/upload/FileAnalysis';

function makeStats(overrides: Partial<FileStats> = {}): FileStats {
  return {
    fileName: 'buyers.csv',
    fileSize: 256,
    rowCount: 1,
    columnCount: 3,
    columns: ['buyer_id', 'buyer_name', 'buyer_trn'],
    inferredPK: 'buyer_id',
    detectedDelimiter: 'comma',
    detectedEncoding: 'UTF-8',
    previewRows: [{ buyer_id: 'B1', buyer_name: 'Buyer One', buyer_trn: '100000000000003' }],
    requiredPresent: ['buyer_id', 'buyer_name', 'buyer_trn'],
    requiredMissing: [],
    nullWarnings: [],
    ...overrides,
  };
}

describe('FileSummaryCard structural validation presentation', () => {
  it('distinguishes missing required columns from non-required template columns', () => {
    render(
      <FileSummaryCard
        stats={makeStats({
          columns: ['buyer_id', 'buyer_trn'],
          requiredPresent: ['buyer_id', 'buyer_trn'],
          requiredMissing: ['buyer_name'],
        })}
        type="buyers"
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByLabelText('buyer_name: required column missing')).toHaveClass('text-destructive');
    expect(screen.getByLabelText('buyer_legal_reg_id: Not supplied')).toHaveClass('text-muted-foreground');
    expect(screen.getByLabelText('buyer_legal_reg_id: Not supplied')).not.toHaveClass('text-destructive');
  });

  it('labels null-rate findings as non-blocking warnings', () => {
    render(
      <FileSummaryCard
        stats={makeStats({ nullWarnings: [{ column: 'buyer_trn', nullRate: 0.25 }] })}
        type="buyers"
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Non-blocking null-rate warning')).toBeInTheDocument();
    expect(screen.getByText('buyer_trn: 25% null rate')).toBeInTheDocument();
  });
});
