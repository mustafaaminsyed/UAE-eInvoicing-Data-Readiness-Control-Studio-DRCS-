import { describe, expect, it } from 'vitest';

import { parseHeadersFile } from '@/lib/csvParser';

function buildFile(content: string, name: string): File {
  return {
    name,
    size: content.length,
    type: 'text/csv',
    text: async () => content,
  } as unknown as File;
}

describe('overlay field plumbing', () => {
  it('parses principal, invoicing-period, and delivery-information fields into the canonical header model', async () => {
    const csv = [
      'invoice_id,invoice_number,issue_date,invoice_type,seller_trn,buyer_id,currency,transaction_type_code,principal_id,invoicing_period_start_date,invoicing_period_end_date,deliver_to_address_line_1,deliver_to_city,deliver_to_country_subdivision,deliver_to_country_code,total_excl_vat,vat_total,total_incl_vat',
      'INV-OVERLAY-1,AE-001,2026-03-16,380,100000000000001,B001,AED,00010101,100000000000099,2026-03-01,2026-03-15,Warehouse 7,Jebel Ali,DU,SA,100.00,5.00,105.00',
    ].join('\n');

    const [header] = await parseHeadersFile(buildFile(csv, 'headers-overlay.csv'));

    expect(header).toBeDefined();
    expect(header.principal_id).toBe('100000000000099');
    expect(header.invoicing_period_start_date).toBe('2026-03-01');
    expect(header.invoicing_period_end_date).toBe('2026-03-15');
    expect(header.invoicing_period).toEqual({
      start_date: '2026-03-01',
      end_date: '2026-03-15',
    });
    expect(header.deliver_to_address_line_1).toBe('Warehouse 7');
    expect(header.deliver_to_city).toBe('Jebel Ali');
    expect(header.deliver_to_country_subdivision).toBe('DU');
    expect(header.deliver_to_country_code).toBe('SA');
    expect(header.delivery_information).toEqual({
      address_line_1: 'Warehouse 7',
      city: 'Jebel Ali',
      country_subdivision: 'DU',
      country_code: 'SA',
    });
  });
});
