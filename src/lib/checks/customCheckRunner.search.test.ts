import { describe, expect, it } from 'vitest';
import { runSearchCheck } from '@/lib/checks/customCheckRunner';
import { CustomCheckConfig } from '@/types/customChecks';
import { DataContext } from '@/types/compliance';

function buildDataContext(): DataContext {
  const buyers = [];
  const headers = [
    {
      invoice_id: 'AP-1',
      invoice_number: 'INV-1001',
      issue_date: '2026-02-01',
      seller_trn: '100200300',
      seller_name: 'Acme Trading LLC',
      buyer_id: 'B-1',
      currency: 'AED',
      total_incl_vat: 1050,
      total_excl_vat: 1000,
      vat_total: 50,
    },
    {
      invoice_id: 'AP-2',
      invoice_number: 'INV 1001',
      issue_date: '2026-02-03',
      seller_trn: '100-200-300',
      seller_name: 'Acme Trading L.L.C.',
      buyer_id: 'B-1',
      currency: 'AED',
      total_incl_vat: 1050,
      total_excl_vat: 1000,
      vat_total: 50,
    },
  ];
  const lines = [];
  return {
    buyers,
    headers,
    lines,
    buyerMap: new Map(),
    headerMap: new Map(headers.map((header) => [header.invoice_id, header])),
    linesByInvoice: new Map(),
  };
}

const duplicateCheck: CustomCheckConfig = {
  id: 'search-1',
  name: 'Possible Duplicate',
  description: 'test',
  severity: 'Low',
  check_type: 'SEARCH_CHECK',
  dataset_scope: 'header',
  rule_type: 'fuzzy_duplicate',
  parameters: {
    vendor_similarity_threshold: 0.8,
    amount_tolerance: 0.01,
    date_window_days: 3,
  },
  message_template: 'x',
  is_active: true,
};

describe('runSearchCheck', () => {
  it('produces AP investigation flags for fuzzy duplicates', () => {
    const flags = runSearchCheck(duplicateCheck, buildDataContext(), 'AP');
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].datasetType).toBe('AP');
  });

  it('does not produce flags for AR context', () => {
    const flags = runSearchCheck(duplicateCheck, buildDataContext(), 'AR');
    expect(flags).toHaveLength(0);
  });
});
