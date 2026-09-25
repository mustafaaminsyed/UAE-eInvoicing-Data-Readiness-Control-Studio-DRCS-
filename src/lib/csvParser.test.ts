import { describe, expect, it } from 'vitest';
import { parseCSV, parseHeadersFile, parseLinesFile, parsePartiesFile } from './csvParser';
import { getSampleData } from './sampleData';

const file = (text: string) => ({ text: async () => text }) as File;
const lineColumns = 'line_id,invoice_id,line_number,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount';

describe('CSV ingestion integrity', () => {
  it('preserves raw cells while normalizing canonical identifiers', async () => {
    const text = 'invoice_id,buyer_id,currency\n I1 , B1 , AED ';
    expect(parseCSV(text)[0].invoice_id).toBe(' I1 ');
    expect((await parseHeadersFile(file(text)))[0]).toMatchObject({ invoice_id: 'I1', buyer_id: 'B1', currency: 'AED' });
  });
  it.each(['AR', 'AP'] as const)('loads the existing %s sample without changing amounts or party links', async (direction) => {
    const buyers = await parsePartiesFile(file(getSampleData('buyers', 'positive', direction).content), { direction });
    const headers = await parseHeadersFile(file(getSampleData('headers', 'positive', direction).content), { direction });
    const lines = await parseLinesFile(file(getSampleData('lines', 'positive', direction).content), { direction });
    expect(headers).toHaveLength(3);
    expect(lines).toHaveLength(3);
    expect(headers.map(header => header.total_incl_vat)).toEqual([1050, 2100, 525]);
    expect(headers.every(header => buyers.some(buyer => buyer.buyer_id === header.buyer_id))).toBe(true);
    expect(headers.every(header => header.direction === direction)).toBe(true);
  });
  it('supports BOM, CRLF, quoted commas, escaped quotes and multiline cells', () => {
    expect(parseCSV('\uFEFFid,note\r\n1,"A, ""B""\r\nC"\r\n')).toEqual([
      { id: '1', note: 'A, "B"\r\nC' },
    ]);
  });

  it.each(['id,name\n1,A\n2', 'id,name\n1,A,extra', 'id,name\n1,"unfinished', 'id,id\n1,2', 'id,\n1,2'])('rejects malformed CSV instead of losing data: %s', (text) => {
    expect(() => parseCSV(text)).toThrow();
  });

  it.each(['100abc', 'Infinity', '1e3', '1,000'])('rejects invalid decimal %s', async (value) => {
    await expect(parseHeadersFile(file(`invoice_id,total_excl_vat\nI1,"${value}"`))).rejects.toThrow(/total_excl_vat/);
  });

  it('rejects missing required numeric values instead of inventing zero', async () => {
    await expect(parseLinesFile(file(`${lineColumns}\nL1,I1,1,,10,0,5,0`))).rejects.toThrow(/quantity/);
  });

  it('preserves genuine zero values', async () => {
    const [line] = await parseLinesFile(file(`${lineColumns}\nL1,I1,1,0,10,0,5,0`));
    expect(line.quantity).toBe(0);
    expect(line.vat_amount).toBe(0);
  });

  it('retains the physical source row after multiline records and blank lines', async () => {
    const rows = await parseHeadersFile(file('invoice_id,note\nI1,"a\nb"\n\nI2,end'));
    expect(rows.map(row => row.source_row_number)).toEqual([2, 5]);
  });
});
