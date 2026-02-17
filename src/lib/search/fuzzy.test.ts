import { describe, expect, it } from 'vitest';
import {
  normalizeInvoiceSearchValue,
  normalizeNameSearchValue,
  normalizeTrnSearchValue,
  rankFuzzyCandidates,
} from '@/lib/search/fuzzy';

describe('fuzzy search normalization', () => {
  it('normalizes invoice numbers by removing separators', () => {
    expect(normalizeInvoiceSearchValue('INV- 2026/001')).toBe('inv2026001');
  });

  it('normalizes names and trn fields', () => {
    expect(normalizeNameSearchValue('  Acme   LLC  ')).toBe('acme llc');
    expect(normalizeTrnSearchValue('TRN 100-200-300')).toBe('100200300');
  });
});

describe('rankFuzzyCandidates', () => {
  const candidates = [
    { id: '1', vendorName: 'Acme Trading LLC', invoiceNumber: 'INV-1001', trn: '100200300' },
    { id: '2', vendorName: 'Globex', invoiceNumber: 'ABC-778', trn: '999888777' },
  ];

  it('returns strong match in strict mode', () => {
    const ranked = rankFuzzyCandidates('INV1001', candidates, 'strict');
    expect(ranked[0]?.item.id).toBe('1');
  });

  it('filters weaker matches in strict mode', () => {
    const strict = rankFuzzyCandidates('Acm Tradin', candidates, 'strict');
    const loose = rankFuzzyCandidates('Acm Tradin', candidates, 'loose');
    expect(strict.length).toBeLessThanOrEqual(loose.length);
  });
});
