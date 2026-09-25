import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { generateEvidencePackZip } from './evidenceExporter';
import { buildEvidencePackData } from './evidenceDataBuilder';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { RuleExecution } from '@/types/executionLedger';

describe('exported execution ledger', () => {
  it('writes recorded outcomes and unavailable rules into the Excel ZIP', async () => {
    const headers = [{ invoice_id: 'I1', invoice_number: '1', issue_date: '', seller_trn: '', buyer_id: '', currency: 'AED' }];
    const ledger: RuleExecution[] = [];
    const check = UAE_UC1_CHECK_PACK.find(check => check.check_id.endsWith('015'))!;
    const exceptions = runAllPintAEChecks([check], { buyers: [], headers, lines: [], buyerMap: new Map(), headerMap: new Map(), linesByInvoice: new Map() }, { onExecution: row => ledger.push(row) });
    const evidence = buildEvidencePackData('run', '2026-01-01', [], headers, [], exceptions, [], ledger);
    const blob = await generateEvidencePackZip(evidence);
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob);
    });
    const zip = await JSZip.loadAsync(bytes);
    const recorded = JSON.parse(await zip.file('07_execution_ledger.json')!.async('string'));
    expect(recorded).toMatchObject({ ledgerVersion: 1, runId: 'run', executions: [expect.objectContaining({ engineVersion: 'uc1-execution-v3', check: expect.objectContaining({ check_id: check.check_id }) })] });
    const workbook = XLSX.read(await zip.file('03_rule_execution.xlsx')!.async('uint8array'), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['Rule Execution']);
    expect(rows.find(row => row['Rule ID'] === check.check_id)).toMatchObject({ 'Execution Count': 1, 'Failure Count': 1, 'Exception Findings': 3, 'Status': 'fail', 'Execution Count Source': 'recorded' });
    expect(rows.find(row => row['Rule ID'] === 'UAE-UC1-CHK-001')).toMatchObject({ 'Execution Count': 0, 'Status': 'not_evaluated', 'Execution Count Source': 'unavailable' });
  });
});
