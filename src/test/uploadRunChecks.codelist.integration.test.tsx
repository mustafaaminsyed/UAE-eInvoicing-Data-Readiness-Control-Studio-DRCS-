import { describe, expect, it, vi } from 'vitest';
import { parseBuyersFile, parseHeadersFile, parseLinesFile } from '@/lib/csvParser';
import { buyersSample, headersSample, linesSample } from '@/lib/sampleData';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { runChecksOrchestrator } from '@/engine/orchestrator';

vi.mock('@/lib/api/pintAEApi', async () => {
  const actual = await vi.importActual<any>('@/lib/api/pintAEApi');
  return {
    ...actual,
    fetchEnabledPintAEChecks: vi.fn(async () => UAE_UC1_CHECK_PACK),
    seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'ok' })),
  };
});

function buildFile(content: string, name: string): File {
  return {
    name,
    size: content.length,
    type: 'text/csv',
    text: async () => content,
  } as unknown as File;
}

describe('CSV ingestion to orchestrator codelist integration', () => {
  it('runs codelist checks against parsed upload data', async () => {
    const headersWithCodelistViolations = headersSample
      .replace(',Abu Dhabi,AE,AE-AZ,', ',Abu Dhabi,ZZ,AE-AZ,')
      .replace(',2025-02-14,30,1.000000,1000.00,50.00,1050.00,1050.00,S,5.00', ',2025-02-14,XXX,1.000000,1000.00,50.00,1050.00,1050.00,S,5.00');
    const linesWithCodelistViolations = linesSample.replace(',10,EA,100.00,', ',10,BAD,100.00,');

    const buyers = await parseBuyersFile(buildFile(buyersSample, 'buyers.csv'));
    const headers = await parseHeadersFile(buildFile(headersWithCodelistViolations, 'headers.csv'));
    const lines = await parseLinesFile(buildFile(linesWithCodelistViolations, 'lines.csv'));

    expect(buyers).toHaveLength(3);
    expect(headers).toHaveLength(3);
    expect(lines).toHaveLength(3);

    const result = await runChecksOrchestrator({
      direction: 'AR',
      buyers,
      headers,
      lines,
      organizationProfile: { ourEntityTRNs: [] },
      rulesetVersion: 'test-ruleset',
    });

    const checkIds = new Set(result.allExceptions.map((exception) => exception.checkId));

    expect(checkIds.has('UAE-UC1-CHK-043')).toBe(true);
    expect(checkIds.has('UAE-UC1-CHK-047')).toBe(true);
    expect(checkIds.has('UAE-UC1-CHK-048')).toBe(true);

    const canonicalFindingCheckIds = new Set(
      result.runArtifact.findings.map((finding) => finding.checkId)
    );
    expect(canonicalFindingCheckIds.has('UAE-UC1-CHK-043')).toBe(true);
    expect(canonicalFindingCheckIds.has('UAE-UC1-CHK-047')).toBe(true);
    expect(canonicalFindingCheckIds.has('UAE-UC1-CHK-048')).toBe(true);
  });
});
