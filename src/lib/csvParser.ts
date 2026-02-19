import { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { Direction } from '@/types/direction';

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header.trim()] = values[index];
      });
      records.push(record);
    }
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function str(record: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (v !== undefined && v !== null && v.trim() !== '') return v.trim();
  }
  return undefined;
}

function num(record: Record<string, string>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = record[key];
    if (v !== undefined && v !== null && v.trim() !== '') {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

export async function parseBuyersFile(file: File): Promise<Buyer[]> {
  return parsePartiesFile(file, { direction: 'AR' });
}

type ParseOptions = {
  direction?: Direction;
  uploadSessionId?: string;
  uploadManifestId?: string;
};

function getValue(record: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export async function parsePartiesFile(file: File, options: ParseOptions = {}): Promise<Buyer[]> {
  const text = await file.text();
  const records = parseCSV(text);
  const direction = options.direction || 'AR';

  const idKeys = direction === 'AP' ? ['supplier_id', 'vendor_id', 'buyer_id'] : ['buyer_id', 'customer_id', 'party_id'];
  const nameKeys = direction === 'AP' ? ['supplier_name', 'vendor_name', 'buyer_name'] : ['buyer_name', 'customer_name', 'party_name'];
  const trnKeys = direction === 'AP' ? ['supplier_trn', 'vendor_trn', 'buyer_trn'] : ['buyer_trn', 'customer_trn', 'party_trn'];
  const addressKeys = direction === 'AP' ? ['supplier_address', 'vendor_address', 'buyer_address'] : ['buyer_address', 'customer_address', 'party_address'];
  const countryKeys = direction === 'AP' ? ['supplier_country', 'vendor_country', 'buyer_country'] : ['buyer_country', 'customer_country', 'party_country'];
  const cityKeys = direction === 'AP' ? ['supplier_city', 'vendor_city', 'buyer_city'] : ['buyer_city', 'customer_city', 'party_city'];
  const subdivisionKeys = direction === 'AP' ? ['supplier_subdivision', 'vendor_subdivision', 'buyer_subdivision'] : ['buyer_subdivision', 'customer_subdivision', 'party_subdivision'];
  const electronicAddressKeys =
    direction === 'AP'
      ? ['supplier_electronic_address', 'vendor_electronic_address', 'buyer_electronic_address']
      : ['buyer_electronic_address', 'customer_electronic_address', 'party_electronic_address'];

  return records.map((record, index) => ({
    buyer_id: getValue(record, idKeys) || '',
    buyer_name: getValue(record, nameKeys) || '',
    buyer_trn: getValue(record, trnKeys),
    buyer_address: getValue(record, addressKeys),
    buyer_country: getValue(record, countryKeys),
    buyer_city: getValue(record, cityKeys),
    buyer_postcode: str(record, 'buyer_postcode', 'supplier_postcode', 'vendor_postcode'),
    buyer_subdivision: getValue(record, subdivisionKeys),
    buyer_electronic_address: getValue(record, electronicAddressKeys),
    source_row_number: index + 2,
    upload_session_id: options.uploadSessionId,
    upload_manifest_id: options.uploadManifestId,
  }));
}

export async function parseHeadersFile(file: File, options: ParseOptions = {}): Promise<InvoiceHeader[]> {
  const text = await file.text();
  const records = parseCSV(text);
  const direction = options.direction || 'AR';
  const counterpartyIdKeys = direction === 'AP' ? ['supplier_id', 'vendor_id', 'buyer_id'] : ['buyer_id', 'customer_id', 'party_id'];

  return records.map((record, index) => ({
    invoice_id: record.invoice_id || '',
    invoice_number: record.invoice_number || '',
    issue_date: record.issue_date || '',
    seller_trn: record.seller_trn || '',
    buyer_id: getValue(record, counterpartyIdKeys) || '',
    buyer_trn: str(record, 'buyer_trn'),
    currency: record.currency || '',
    direction,
    invoice_type: str(record, 'invoice_type_code', 'invoice_type'),
    total_excl_vat: num(record, 'total_excl_vat'),
    vat_total: num(record, 'vat_total'),
    total_incl_vat: num(record, 'total_incl_vat'),
    seller_name: str(record, 'seller_name'),
    seller_address: str(record, 'seller_address'),
    seller_city: str(record, 'seller_city'),
    seller_country: str(record, 'seller_country'),
    seller_subdivision: str(record, 'seller_subdivision'),
    seller_electronic_address: str(record, 'seller_electronic_address'),
    seller_legal_reg_id: str(record, 'seller_legal_reg_id'),
    seller_legal_reg_id_type: str(record, 'seller_legal_reg_id_type'),
    transaction_type_code: str(record, 'transaction_type_code'),
    payment_due_date: str(record, 'payment_due_date', 'due_date'),
    payment_means_code: str(record, 'payment_means_code'),
    fx_rate: num(record, 'fx_rate'),
    amount_due: num(record, 'amount_due'),
    tax_category_code: str(record, 'tax_category_code'),
    tax_category_rate: num(record, 'tax_category_rate'),
    note: str(record, 'note'),
    supply_date: str(record, 'supply_date'),
    tax_currency: str(record, 'tax_currency'),
    document_level_allowance_total: num(record, 'document_level_allowance_total'),
    document_level_charge_total: num(record, 'document_level_charge_total'),
    rounding_amount: num(record, 'rounding_amount'),
    spec_id: str(record, 'spec_id', 'specification_id'),
    business_process: str(record, 'business_process', 'business_process_type'),
    source_row_number: index + 2,
    upload_session_id: options.uploadSessionId,
    upload_manifest_id: options.uploadManifestId,
  }));
}

export async function parseLinesFile(file: File, options: ParseOptions = {}): Promise<InvoiceLine[]> {
  const text = await file.text();
  const records = parseCSV(text);

  return records.map((record, index) => ({
    line_id: record.line_id || '',
    invoice_id: record.invoice_id || '',
    line_number: parseInt(record.line_number) || 0,
    description: str(record, 'description', 'item_name'),
    item_name: str(record, 'item_name', 'description'),
    quantity: parseFloat(record.quantity) || 0,
    unit_price: parseFloat(record.unit_price) || 0,
    line_discount: record.line_discount ? parseFloat(record.line_discount) : undefined,
    line_total_excl_vat: num(record, 'line_total_excl_vat', 'line_net_amount') || 0,
    vat_rate: parseFloat(record.vat_rate) || 0,
    vat_amount: parseFloat(record.vat_amount) || 0,
    unit_of_measure: str(record, 'unit_of_measure', 'unit_code'),
    tax_category_code: str(record, 'tax_category_code'),
    line_allowance_amount: num(record, 'line_allowance_amount'),
    line_charge_amount: num(record, 'line_charge_amount'),
    source_row_number: index + 2,
    upload_session_id: options.uploadSessionId,
    upload_manifest_id: options.uploadManifestId,
  }));
}
