import { describe, expect, it } from 'vitest';

import { parseCSV } from '@/lib/csvParser';
import { analyzeCoverage, analyzeRegistryCoverage } from '@/lib/mapping/coverageAnalyzer';
import { generateMappingSuggestions, suggestionsToMappings } from '@/lib/mapping/mappingSuggester';
import { getDatasetTargetFields } from '@/lib/mapping/datasetFieldCatalog';
import { getSampleData } from '@/lib/sampleData';

describe('mapping dataset scoping', () => {
  it('treats the shipped header template as an exact canonical match set', () => {
    const sample = getSampleData('headers', 'negative', 'AR');
    const rows = parseCSV(sample.content);
    const columns = Object.keys(rows[0] ?? {});

    const suggestions = generateMappingSuggestions(columns, rows, 'header');

    expect(suggestions).toHaveLength(columns.length);
    expect(suggestions.every((suggestion) => suggestion.confidence === 1)).toBe(true);

    const mappedIds = new Set(suggestions.map((suggestion) => suggestion.targetField.id));
    expect(mappedIds.has('invoice_id')).toBe(true);
    expect(mappedIds.has('buyer_id')).toBe(true);
    expect(mappedIds.has('buyer_name')).toBe(false);
  });

  it('scopes header coverage to the header dataset instead of the full cross-file model', () => {
    const sample = getSampleData('headers', 'negative', 'AR');
    const rows = parseCSV(sample.content);
    const columns = Object.keys(rows[0] ?? {});
    const mappings = suggestionsToMappings(generateMappingSuggestions(columns, rows, 'header'));

    const coverage = analyzeCoverage(mappings, 'header');
    const registryCoverage = analyzeRegistryCoverage(mappings, 'header');

    expect(coverage.unmappedMandatory).toHaveLength(0);
    expect(registryCoverage.totalRegistryFields).toBeLessThan(50);
    expect(registryCoverage.mandatoryRegistryFields).toBeLessThan(42);
    expect(registryCoverage.mappedMandatory.length).toBeGreaterThan(10);
  });

  it('limits header target fields to header-runtime columns and join keys', () => {
    const headerFieldIds = new Set(getDatasetTargetFields('header').map((field) => field.id));

    expect(headerFieldIds.has('invoice_id')).toBe(true);
    expect(headerFieldIds.has('buyer_id')).toBe(true);
    expect(headerFieldIds.has('buyer_name')).toBe(false);
    expect(headerFieldIds.has('line_id')).toBe(false);
  });
});
