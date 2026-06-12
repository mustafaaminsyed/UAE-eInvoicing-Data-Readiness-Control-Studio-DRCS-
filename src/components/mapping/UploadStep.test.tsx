import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UploadStep } from '@/components/mapping/UploadStep';
import type { ERPPreviewData } from '@/types/fieldMapping';

const previewData: ERPPreviewData = {
  fileName: 'invoice_headers_template_negative.csv',
  columns: ['invoice_id', 'invoice_number'],
  detectedColumns: [
    {
      name: 'invoice_id',
      index: 0,
      detectedType: 'string',
      sampleValues: ['INV001'],
      nullCount: 0,
      uniqueCount: 1,
    },
    {
      name: 'invoice_number',
      index: 1,
      detectedType: 'string',
      sampleValues: ['UAE-2025-0001'],
      nullCount: 0,
      uniqueCount: 1,
    },
  ],
  rows: [{ invoice_id: 'INV001', invoice_number: 'UAE-2025-0001' }],
  totalRows: 1,
  datasetType: 'header',
};

describe('UploadStep', () => {
  it('shows a re-upload control and resets wizard state before selecting another file', () => {
    const onDataLoaded = vi.fn();
    const onReset = vi.fn();

    render(<UploadStep previewData={previewData} onDataLoaded={onDataLoaded} onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: /re-upload file/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('loads a built-in template into the wizard preview', () => {
    const onDataLoaded = vi.fn();

    render(<UploadStep previewData={null} onDataLoaded={onDataLoaded} />);

    fireEvent.click(screen.getByRole('button', { name: /load invoice headers template/i }));

    expect(onDataLoaded).toHaveBeenCalledTimes(1);
    expect(onDataLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'invoice_headers_template.csv',
        datasetType: 'header',
      })
    );
  });

  it('auto-detects header template uploads when the wizard is still on the default dataset type', async () => {
    const onDataLoaded = vi.fn();
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,currency,buyer_id,total_excl_vat,vat_total,total_incl_vat',
      'INV001,UAE-2025-0001,2025-01-01,380,AED,BUY001,100,5,105',
    ].join('\n');
    const file = new File([csv], 'headers.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csv),
    });

    render(<UploadStep previewData={null} onDataLoaded={onDataLoaded} />);

    const input = document.querySelector('#erp-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataLoaded).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'headers.csv',
          datasetType: 'header',
        })
      );
    });
  });
});
