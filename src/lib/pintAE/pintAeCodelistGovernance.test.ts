import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCSV } from '@/lib/csvParser';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { PINT_AE_CODELISTS } from '@/lib/pintAE/generated/codelists';

type GovernanceRow = {
  index_no: string;
  codelist_name: string;
  source_type: 'packaged_gc' | 'derived_standard' | 'policy_derived';
  document_context: 'invoice' | 'credit_note' | 'both';
  uc1_applicable: 'yes' | 'no' | 'conditional';
  runtime_enforceable_now: 'yes' | 'no' | 'conditional';
  bound_field: string;
  bound_pint_element: string;
  bound_mof_field: string;
  bound_check_id: string;
  reason_if_not_enforceable: string;
  target_phase: 'UC1' | 'UC2' | 'UC3' | 'future';
  notes: string;
};

const governancePath = 'docs/reconciliation/pint-ae-codelist-governance.v0.1.csv';

function loadGovernanceRows(): GovernanceRow[] {
  const csv = readFileSync(governancePath, 'utf8');
  return parseCSV(csv) as GovernanceRow[];
}

function splitPipeValues(value: string | undefined): string[] {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '-');
}

describe('PINT-AE codelist governance artifact', () => {
  it('covers all generated PINT-AE codelists and preserves source-type denominator split', () => {
    const rows = loadGovernanceRows();
    const governed = new Set(rows.map((row) => row.codelist_name));
    const generated = new Set(Object.keys(PINT_AE_CODELISTS));

    expect(rows).toHaveLength(22);
    expect(rows.filter((row) => row.source_type === 'packaged_gc')).toHaveLength(21);
    expect(rows.filter((row) => row.source_type === 'derived_standard')).toHaveLength(1);

    generated.forEach((codelist) => {
      expect(governed.has(codelist)).toBe(true);
    });
  });

  it('fails governance if a non-enforced codelist is not explicitly deferred/observed', () => {
    const rows = loadGovernanceRows();
    const checkMap = new Map(UAE_UC1_CHECK_PACK.map((check) => [check.check_id, check]));
    const explicitlyNonRuntimeStates = new Set([
      'Deferred - not in UC1 scope',
      'Deferred - missing source field',
      'Deferred - missing transformation logic',
      'Deferred - scenario dependent',
      'Deferred - policy derived',
      'Observed only',
      'Governed but non-runtime',
    ]);

    for (const row of rows) {
      const runtime = row.runtime_enforceable_now;
      const checkIds = splitPipeValues(row.bound_check_id);
      const reason = String(row.reason_if_not_enforceable || '').trim();

      if (runtime === 'yes') {
        expect(checkIds.length).toBeGreaterThan(0);
        checkIds.forEach((checkId) => {
          const check = checkMap.get(checkId);
          expect(check).toBeDefined();
          expect(check?.rule_type).toBe('CodeList');
          expect(check?.parameters?.codelist).toBe(row.codelist_name);
        });
        continue;
      }

      if (runtime === 'conditional' && checkIds.length > 0) {
        checkIds.forEach((checkId) => {
          const check = checkMap.get(checkId);
          expect(check).toBeDefined();
          expect(check?.rule_type).toBe('CodeList');
          expect(check?.parameters?.codelist).toBe(row.codelist_name);
        });
        continue;
      }

      expect(explicitlyNonRuntimeStates.has(reason)).toBe(true);
    }
  });
});
