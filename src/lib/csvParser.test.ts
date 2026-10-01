import { describe, expect, it } from 'vitest';
import { analyzeFile } from '@/components/upload/FileAnalysis';
import { parseBuyersFile, parseCSV, parseHeadersFile, parseLinesFile } from '@/lib/csvParser';
import { headersNegativeSample } from '@/lib/sampleData';

describe('negative headers template upload path', () => {
  it('maps AP supplier aliases when the AP direction is supplied', async () => {
    const csv = [
      'supplier_id,supplier_name,supplier_trn',
      'SUP-001,Example Supplier,100000000000003',
    ].join('\n');

    const file = { text: async () => csv } as File;
    const [buyer] = await parseBuyersFile(file, { direction: 'AP' });

    expect(buyer.buyer_id).toBe('SUP-001');
    expect(buyer.buyer_name).toBe('Example Supplier');
    expect(buyer.buyer_trn).toBe('100000000000003');
  });

  it('parses rows and columns for the downloadable negative headers template', () => {
    const rows = parseCSV(headersNegativeSample);
    const file = new File([headersNegativeSample], 'invoice_headers_template_negative.csv', { type: 'text/csv' });
    const analysis = analyzeFile(rows, file, 'headers', 'AR', headersNegativeSample);

    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0] ?? {})).toHaveLength(37);
    expect(analysis.rowCount).toBe(3);
    expect(analysis.columnCount).toBe(37);
    expect(analysis.columns).toContain('invoice_id');
    expect(analysis.columns).toContain('buyer_id');
  });

  it('maps credit note header fields when present', async () => {
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,seller_trn,buyer_id,currency,credit_note_reason_code,credit_note_reason_text,preceding_invoice_reference,preceding_invoice_issue_date',
      'INV-CN-001,CN-001,2026-06-10,381,100000000000003,BUY-001,AED,ADJ,Price adjustment,INV-0001,2026-05-31',
    ].join('\n');

    const file = {
      text: async () => csv,
    } as File;
    const [header] = await parseHeadersFile(file);

    expect(header.credit_note_reason_code).toBe('ADJ');
    expect(header.credit_note_reason_text).toBe('Price adjustment');
    expect(header.preceding_invoice_reference).toBe('INV-0001');
    expect(header.preceding_invoice_issue_date).toBe('2026-05-31');
  });

  it('preserves IBT-106 independently from IBT-109 and leaves missing IBT-106 undefined', async () => {
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,seller_trn,buyer_id,currency,sum_line_net_amount,total_excl_vat',
      'INV-106-001,INV-106-001,2026-06-10,380,100000000000003,BUY-001,AED,350,330',
      'INV-106-002,INV-106-002,2026-06-10,380,100000000000003,BUY-001,AED,,330',
    ].join('\n');
    const file = { text: async () => csv } as File;
    const headers = await parseHeadersFile(file);

    expect(headers[0].sum_line_net_amount).toBe(350);
    expect(headers[0].total_excl_vat).toBe(330);
    expect(headers[1].sum_line_net_amount).toBeUndefined();
    expect(headers[1].total_excl_vat).toBe(330);
  });

  it('maps credit note reason text aliases when description is used as the header name', async () => {
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,seller_trn,buyer_id,currency,credit_note_reason_code,credit_note_reason_description',
      'INV-CN-002,CN-002,2026-06-10,381,100000000000003,BUY-001,AED,ADJ,Commercial adjustment narrative',
    ].join('\n');

    const file = {
      text: async () => csv,
    } as File;
    const [header] = await parseHeadersFile(file);

    expect(header.credit_note_reason_text).toBe('Commercial adjustment narrative');
  });

  it('prefers line_allowance_amount and backfills the legacy line_discount helper when parsing lines', async () => {
    const csv = [
      'line_id,invoice_id,line_number,description,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount,line_allowance_amount',
      'L-001,INV-001,1,Advisory service,2,100,190,5,9.5,10',
    ].join('\n');

    const file = {
      text: async () => csv,
    } as File;
    const [line] = await parseLinesFile(file);

    expect(line.line_allowance_amount).toBe(10);
    expect(line.line_discount).toBe(10);
  });

  it('keeps blank mandatory monetary values distinct from genuine zero values', async () => {
    const csv = [
      'line_id,invoice_id,line_number,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount',
      'L-001,INV-001,1,1,,,,',
      'L-002,INV-001,2,1,0,0,0,0',
    ].join('\n');

    const file = { text: async () => csv } as File;
    const lines = await parseLinesFile(file);

    expect(Number.isNaN(lines[0].unit_price)).toBe(true);
    expect(Number.isNaN(lines[0].line_total_excl_vat)).toBe(true);
    expect(Number.isNaN(lines[0].vat_rate)).toBe(true);
    expect(Number.isNaN(lines[0].vat_amount)).toBe(true);
    expect(lines[1]).toMatchObject({ unit_price: 0, line_total_excl_vat: 0, vat_rate: 0, vat_amount: 0 });
  });

  it('preserves typed IBT-149 and IBT-150 source fields without changing IBT-130', async () => {
    const csv = [
      'line_id,invoice_id,line_number,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount,unit_of_measure,price_base_quantity,price_base_quantity_uom',
      'L-001,INV-001,1,2,100,200,5,10,KGM,100,C62',
    ].join('\n');

    const file = { text: async () => csv } as File;
    const [line] = await parseLinesFile(file);

    expect(line.price_base_quantity).toBe(100);
    expect(line.price_base_quantity_uom).toBe('C62');
    expect(line.unit_of_measure).toBe('KGM');
  });

  it('preserves source one while keeping missing base quantity distinct from the runtime default', async () => {
    const csv = [
      'line_id,invoice_id,line_number,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount,price_base_quantity',
      'L-001,INV-001,1,1,100,100,5,5,1',
      'L-002,INV-001,2,1,100,100,5,5,',
    ].join('\n');

    const file = { text: async () => csv } as File;
    const lines = await parseLinesFile(file);

    expect(lines[0].price_base_quantity).toBe(1);
    expect(lines[1].price_base_quantity).toBeUndefined();
  });

  it('preserves legacy base quantity aliases and leaves blank IBT-150 absent', async () => {
    const csv = [
      'line_id,invoice_id,line_number,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount,line_base_quantity,item_price_base_quantity_uom',
      'L-001,INV-001,1,1,100,100,5,5,100,',
    ].join('\n');

    const file = { text: async () => csv } as File;
    const [line] = await parseLinesFile(file);

    expect(line.price_base_quantity).toBe(100);
    expect(line.price_base_quantity_uom).toBeUndefined();
  });

  it('does not turn invalid nonblank base quantity input into one', async () => {
    const csv = [
      'line_id,invoice_id,line_number,quantity,unit_price,line_total_excl_vat,vat_rate,vat_amount,price_base_quantity',
      'L-001,INV-001,1,1,100,100,5,5,not-a-number',
    ].join('\n');

    const file = { text: async () => csv } as File;
    const [line] = await parseLinesFile(file);

    expect(line.price_base_quantity).toBeUndefined();
    expect(line.price_base_quantity).not.toBe(1);
  });
});
