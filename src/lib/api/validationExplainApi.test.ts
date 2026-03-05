import { describe, expect, it } from 'vitest';
import { __testables, buildHeuristicExplanation } from '@/lib/api/validationExplainApi';
import { Exception } from '@/types/compliance';

const sampleException: Exception = {
  id: 'exc-1',
  checkId: 'buyer_trn_invalid_format',
  checkName: 'Buyer TRN Invalid Format',
  severity: 'High',
  message: 'Buyer has invalid TRN format',
  datasetType: 'AR',
  invoiceId: 'INV-1',
  invoiceNumber: 'INV-001',
  buyerId: 'B-001',
  field: 'buyer_trn',
  expectedValue: '15-digit number',
  actualValue: '123-ABC',
};

describe('validationExplainApi heuristic pack', () => {
  it('normalizes root-cause probabilities to approximately 1.0', () => {
    const normalized = __testables.normalizeRootCauseProbabilities([
      { cause: 'a', probability: 5, evidence: [] },
      { cause: 'b', probability: 3, evidence: [] },
      { cause: 'c', probability: 2, evidence: [] },
    ]);

    const sum = normalized.reduce((acc, item) => acc + item.probability, 0);
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01);
    expect(normalized.every((item) => item.probability >= 0 && item.probability <= 1)).toBe(true);
  });

  it('builds deterministic explanation pack with backward-compatible fields', async () => {
    const explanation = await buildHeuristicExplanation(sampleException, {
      mappingProvider: {
        async getMappingContext() {
          return {
            mapping_path: 'Template A -> buyer_trn_raw -> buyer_trn',
            sample_source_value: '123-ABC',
            dataset_type: 'AR',
            field_name: 'buyer_trn',
          };
        },
      },
    });

    expect(explanation.explanationPack).toBeDefined();
    expect(explanation.explanation).toBeTruthy();
    expect(explanation.recommendedFix).toBeTruthy();
    expect(explanation.sourceContext?.explanation_pack).toBeDefined();

    const pack = explanation.explanationPack!;
    const probabilitySum = pack.likelyRootCauses.reduce((acc, item) => acc + item.probability, 0);
    expect(Math.abs(probabilitySum - 1)).toBeLessThanOrEqual(0.01);
    expect(pack.confidence).toBeGreaterThanOrEqual(0);
    expect(pack.confidence).toBeLessThanOrEqual(1);
    expect(pack.engine.version).toBe('heuristic_v1');
  });
});

