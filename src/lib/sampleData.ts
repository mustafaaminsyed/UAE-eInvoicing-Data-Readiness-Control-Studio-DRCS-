export type SampleScenario = 'positive' | 'negative';
export type SampleDataset = 'buyers' | 'headers' | 'lines';
export type SampleDirection = 'AR' | 'AP';

export const buyersSample = `buyer_id,buyer_name,buyer_trn,buyer_address,buyer_country,buyer_city,buyer_subdivision,buyer_electronic_address
B001,Acme Corporation LLC,100000000000003,Office 42 Business Bay Tower,AE,Dubai,AE-DU,acme@peppol.ae
B002,Global Traders FZ-LLC,200000000000003,Unit 7 JAFZA South,AE,Dubai,AE-DU,global.traders@peppol.ae
B003,Tech Solutions DMCC,300000000000003,Floor 12 Almas Tower JLT,AE,Dubai,AE-DU,tech.solutions@peppol.ae`;

export const headersSample = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate
INV001,UAE-2025-0001,2025-01-15,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,2025-02-14,30,1.000000,1000.00,50.00,1050.00,1050.00,S,5.00
INV002,UAE-2025-0002,2025-01-16,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B002,AED,01000000,2025-02-15,30,1.000000,2000.00,100.00,2100.00,2100.00,S,5.00
INV003,UAE-2025-0003,2025-01-17,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B003,AED,01000000,2025-02-16,30,1.000000,500.00,25.00,525.00,525.00,S,5.00`;

export const linesSample = `line_id,invoice_id,line_number,description,quantity,unit_of_measure,unit_price,line_discount,line_total_excl_vat,vat_rate,vat_amount,tax_category_code
L001,INV001,1,Consulting Services - Tax Advisory,10,EA,100.00,0.00,1000.00,5.00,50.00,S
L002,INV002,1,E-Invoicing Integration Package,1,EA,2000.00,0.00,2000.00,5.00,100.00,S
L003,INV003,1,Compliance Readiness Assessment,5,EA,100.00,0.00,500.00,5.00,25.00,S`;

export const buyersNegativeSample = `buyer_id,buyer_name,buyer_trn,buyer_address,buyer_country,buyer_city,buyer_subdivision,buyer_electronic_address
B001,Acme Corporation LLC,100000000000003,Office 42 Business Bay Tower,AE,Dubai,AE-DU,acme@peppol.ae
B002,Global Traders FZ-LLC,INVALIDTRN,Unit 7 JAFZA South,AE,Dubai,AE-DU,global.traders@peppol.ae
B003,Tech Solutions DMCC,300000000000003,Floor 12 Almas Tower JLT,AE,Dubai,AE-DU,`;

export const headersNegativeSample = `invoice_id,invoice_number,issue_date,invoice_type,seller_trn,seller_name,seller_address,seller_city,seller_country,seller_subdivision,seller_electronic_address,seller_legal_reg_id,seller_legal_reg_id_type,buyer_id,currency,transaction_type_code,payment_due_date,payment_means_code,fx_rate,total_excl_vat,vat_total,total_incl_vat,amount_due,tax_category_code,tax_category_rate
INV001,UAE-2025-0001,2025-01-15,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B001,AED,01000000,2025-02-14,30,1.000000,1000.00,50.00,1050.00,1050.00,S,5.00
INV002,UAE-2025-0002,2025-01-16,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-XX,dariba@peppol.ae,TL-123456,TL,B002,AED,01000000,,30,1.000000,2000.00,100.00,2100.00,2100.00,S,5.00
INV003,UAE-2025-0003,2025-01-17,380,100000000000001,Dariba Tax Technologies LLC,Al Sila Tower ADGM,Abu Dhabi,AE,AE-AZ,dariba@peppol.ae,TL-123456,TL,B003,AED,01000000,2025-02-16,30,1.000000,500.00,20.00,525.00,525.00,S,5.00`;

export const linesNegativeSample = `line_id,invoice_id,line_number,description,quantity,unit_of_measure,unit_price,line_discount,line_total_excl_vat,vat_rate,vat_amount,tax_category_code
L001,INV001,1,Consulting Services - Tax Advisory,10,EA,100.00,0.00,1000.00,5.00,50.00,S
L002,INV002,1,E-Invoicing Integration Package,1,EA,2000.00,0.00,2000.00,5.00,140.00,S
L003,INV003,1,Compliance Readiness Assessment,5,EA,100.00,0.00,500.00,5.00,25.00,S`;

const apPartiesSample = buyersSample
  .replace(/buyer_id/g, 'supplier_id')
  .replace(/buyer_name/g, 'supplier_name')
  .replace(/buyer_trn/g, 'supplier_trn')
  .replace(/buyer_address/g, 'supplier_address')
  .replace(/buyer_country/g, 'supplier_country')
  .replace(/buyer_city/g, 'supplier_city')
  .replace(/buyer_subdivision/g, 'supplier_subdivision')
  .replace(/buyer_electronic_address/g, 'supplier_electronic_address')
  .replace(/B001/g, 'S001')
  .replace(/B002/g, 'S002')
  .replace(/B003/g, 'S003');

const apPartiesNegativeSample = buyersNegativeSample
  .replace(/buyer_id/g, 'supplier_id')
  .replace(/buyer_name/g, 'supplier_name')
  .replace(/buyer_trn/g, 'supplier_trn')
  .replace(/buyer_address/g, 'supplier_address')
  .replace(/buyer_country/g, 'supplier_country')
  .replace(/buyer_city/g, 'supplier_city')
  .replace(/buyer_subdivision/g, 'supplier_subdivision')
  .replace(/buyer_electronic_address/g, 'supplier_electronic_address')
  .replace(/B001/g, 'S001')
  .replace(/B002/g, 'S002')
  .replace(/B003/g, 'S003');

const apHeadersSample = headersSample
  .replace(/buyer_id/g, 'supplier_id')
  .replace(/,B001,/g, ',S001,')
  .replace(/,B002,/g, ',S002,')
  .replace(/,B003,/g, ',S003,');

const apHeadersNegativeSample = headersNegativeSample
  .replace(/buyer_id/g, 'supplier_id')
  .replace(/,B001,/g, ',S001,')
  .replace(/,B002,/g, ',S002,')
  .replace(/,B003,/g, ',S003,');

const SAMPLE_BY_SCENARIO: Record<SampleScenario, Record<SampleDirection, Record<SampleDataset, { content: string; filename: string }>>> = {
  positive: {
    AR: {
      buyers: { content: buyersSample, filename: 'buyers_template.csv' },
      headers: { content: headersSample, filename: 'invoice_headers_template.csv' },
      lines: { content: linesSample, filename: 'invoice_lines_template.csv' },
    },
    AP: {
      buyers: { content: apPartiesSample, filename: 'suppliers_template.csv' },
      headers: { content: apHeadersSample, filename: 'invoice_headers_ap_template.csv' },
      lines: { content: linesSample, filename: 'invoice_lines_template.csv' },
    },
  },
  negative: {
    AR: {
      buyers: { content: buyersNegativeSample, filename: 'buyers_template_negative.csv' },
      headers: { content: headersNegativeSample, filename: 'invoice_headers_template_negative.csv' },
      lines: { content: linesNegativeSample, filename: 'invoice_lines_template_negative.csv' },
    },
    AP: {
      buyers: { content: apPartiesNegativeSample, filename: 'suppliers_template_negative.csv' },
      headers: { content: apHeadersNegativeSample, filename: 'invoice_headers_ap_template_negative.csv' },
      lines: { content: linesNegativeSample, filename: 'invoice_lines_template_negative.csv' },
    },
  },
};

export function getSampleData(dataset: SampleDataset, scenario: SampleScenario = 'positive', direction: SampleDirection = 'AR') {
  return SAMPLE_BY_SCENARIO[scenario][direction][dataset];
}

export function downloadSampleCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadAllTemplatesAsZip(scenario: SampleScenario = 'positive', direction: SampleDirection = 'AR') {
  const sampleBuyers = getSampleData('buyers', scenario, direction);
  const sampleHeaders = getSampleData('headers', scenario, direction);
  const sampleLines = getSampleData('lines', scenario, direction);
  downloadSampleCSV(sampleBuyers.filename, sampleBuyers.content);
  setTimeout(() => downloadSampleCSV(sampleHeaders.filename, sampleHeaders.content), 200);
  setTimeout(() => downloadSampleCSV(sampleLines.filename, sampleLines.content), 400);
}

export const TEMPLATE_MANIFEST = {
  spec_version: 'PINT-AE 2025-Q2',
  dr_version: 'UAE DR v1.0.1',
  use_case: 'UAE B2B Standard Invoice (UC1)',
  generated_timestamp: '2025-06-01T00:00:00Z',
  schema_hash: 'sha256:b3f8c2a1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
  templates: [
    { file: 'buyers_template.csv', dataset: 'Buyers', columns: 8 },
    { file: 'invoice_headers_template.csv', dataset: 'Invoice Headers', columns: 25 },
    { file: 'invoice_lines_template.csv', dataset: 'Invoice Lines', columns: 12 },
  ],
};
