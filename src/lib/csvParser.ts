import { Buyer, DocumentLevelAdjustment, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import { Direction } from '@/types/direction';

export function normalizeCSVText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function parseCSV(text: string): Record<string, string>[] {
  const normalizedText = normalizeCSVText(text);
  const lines = normalizedText.split('\n');
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

function requiredNum(record: Record<string, string>, ...keys: string[]): number {
  return num(record, ...keys) ?? Number.NaN;
}

function buildInvoicingPeriod(
  startDate?: string,
  endDate?: string
): InvoiceHeader['invoicing_period'] {
  if (!startDate && !endDate) return undefined;
  return {
    start_date: startDate,
    end_date: endDate,
  };
}

function buildDeliveryInformation(
  addressLine1?: string,
  city?: string,
  countrySubdivision?: string,
  countryCode?: string
): InvoiceHeader['delivery_information'] {
  if (!addressLine1 && !city && !countrySubdivision && !countryCode) return undefined;
  return {
    address_line_1: addressLine1,
    city,
    country_subdivision: countrySubdivision,
    country_code: countryCode,
  };
}

type ParseOptions = {
  direction?: Direction;
  uploadSessionId?: string;
  uploadManifestId?: string;
  /** Explicit opt-in for previously saved mappings that relied on symmetric item-field fallback. */
  itemFieldCompatibility?: 'canonical_independent' | 'legacy_symmetric_fallback';
};

export async function parseBuyersFile(file: File, options: ParseOptions = {}): Promise<Buyer[]> {
  return parsePartiesFile(file, options);
}

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
  const legalRegistrationIdKeys = direction === 'AP'
    ? ['supplier_legal_reg_id', 'vendor_legal_reg_id', 'buyer_legal_reg_id']
    : ['buyer_legal_reg_id', 'customer_legal_reg_id', 'party_legal_reg_id'];
  const legalRegistrationTypeKeys = direction === 'AP'
    ? ['supplier_legal_reg_id_type', 'vendor_legal_reg_id_type', 'buyer_legal_reg_id_type']
    : ['buyer_legal_reg_id_type', 'customer_legal_reg_id_type', 'party_legal_reg_id_type'];
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
    buyer_legal_reg_id: getValue(record, legalRegistrationIdKeys),
    buyer_legal_reg_id_type: getValue(record, legalRegistrationTypeKeys),
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

  return records.map((record, index) => {
    const invoicingPeriodStartDate = str(
      record,
      'invoicing_period_start_date',
      'invoice_period_start_date',
      'period_start_date'
    );
    const invoicingPeriodEndDate = str(
      record,
      'invoicing_period_end_date',
      'invoice_period_end_date',
      'period_end_date'
    );
    const deliverToAddressLine1 = str(
      record,
      'deliver_to_address_line_1',
      'deliver_to_address',
      'delivery_address_line_1'
    );
    const deliverToCity = str(record, 'deliver_to_city', 'delivery_city');
    const deliverToCountrySubdivision = str(
      record,
      'deliver_to_country_subdivision',
      'deliver_to_subdivision',
      'delivery_country_subdivision'
    );
    const deliverToCountryCode = str(
      record,
      'deliver_to_country_code',
      'deliver_to_country',
      'delivery_country_code'
    );

    return {
      invoice_id: record.invoice_id || '',
      invoice_number: record.invoice_number || '',
      issue_date: record.issue_date || '',
      seller_trn: record.seller_trn || '',
      buyer_id: getValue(record, counterpartyIdKeys) || '',
      buyer_trn: str(record, 'buyer_trn'),
      currency: record.currency || '',
      direction,
      invoice_type: str(record, 'invoice_type_code', 'invoice_type'),
      credit_note_reason_code: str(record, 'credit_note_reason_code'),
      credit_note_reason_text: str(
        record,
        'credit_note_reason_text',
        'credit_note_reason_description',
        'credit_note_reason_desc'
      ),
      preceding_invoice_reference: str(record, 'preceding_invoice_reference'),
      preceding_invoice_issue_date: str(record, 'preceding_invoice_issue_date'),
      total_excl_vat: num(record, 'total_excl_vat'),
      sum_line_net_amount: num(record, 'sum_line_net_amount', 'invoice_line_net_total'),
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
      principal_id: str(record, 'principal_id', 'principle_id', 'principal_identifier'),
      invoicing_period_start_date: invoicingPeriodStartDate,
      invoicing_period_end_date: invoicingPeriodEndDate,
      invoicing_period: buildInvoicingPeriod(invoicingPeriodStartDate, invoicingPeriodEndDate),
      deliver_to_address_line_1: deliverToAddressLine1,
      deliver_to_city: deliverToCity,
      deliver_to_country_subdivision: deliverToCountrySubdivision,
      deliver_to_country_code: deliverToCountryCode,
      delivery_information: buildDeliveryInformation(
        deliverToAddressLine1,
        deliverToCity,
        deliverToCountrySubdivision,
        deliverToCountryCode
      ),
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
    };
  });
}

export async function parseDocumentAdjustmentsFile(file: File): Promise<Array<DocumentLevelAdjustment & { invoice_id: string }>> {
  const records = parseCSV(await file.text());
  const seenIds = new Set<string>();
  return records.map((record, index) => {
    const sourceRow = index + 2;
    const adjustmentId = str(record, 'adjustment_id');
    const invoiceId = str(record, 'invoice_id');
    const kind = str(record, 'kind')?.toLowerCase();
    const amount = num(record, 'amount');
    const category = str(record, 'tax_category_code')?.toUpperCase();
    const rate = num(record, 'vat_rate');
    const baseAmount = num(record, 'base_amount');
    const percentage = num(record, 'percentage');
    const reasonCode = str(record, 'reason_code');
    const reasonText = str(record, 'reason_text');
    if (!adjustmentId || !invoiceId || !['allowance', 'charge'].includes(kind ?? '') || amount === undefined || amount < 0 || !category) {
      throw new Error(`Document adjustment row ${sourceRow} is missing a valid ID, invoice ID, kind, non-negative amount, or VAT category.`);
    }
    if (seenIds.has(adjustmentId)) throw new Error(`Document adjustment ID ${adjustmentId} is duplicated at row ${sourceRow}.`);
    seenIds.add(adjustmentId);
    if (!reasonCode && !reasonText) throw new Error(`Document adjustment ${adjustmentId} requires a reason code or reason text.`);
    if ((baseAmount === undefined) !== (percentage === undefined)) throw new Error(`Document adjustment ${adjustmentId} must provide both base_amount and percentage, or neither.`);
    if (!['E', 'O'].includes(category) && rate === undefined) throw new Error(`Document adjustment ${adjustmentId} requires a VAT rate for category ${category}.`);
    if (['E', 'O'].includes(category) && rate !== undefined && rate !== 0) throw new Error(`Document adjustment ${adjustmentId} must not provide a non-zero VAT rate for category ${category}.`);
    return {
      adjustment_id: adjustmentId,
      invoice_id: invoiceId,
      kind: kind as DocumentLevelAdjustment['kind'],
      amount,
      tax_category_code: category,
      vat_rate: rate,
      base_amount: baseAmount,
      percentage,
      reason_code: reasonCode,
      reason_text: reasonText,
      exemption_reason_code: str(record, 'exemption_reason_code'),
      exemption_reason_text: str(record, 'exemption_reason_text'),
      source_row_number: sourceRow,
    };
  });
}

export function attachDocumentAdjustments(
  headers: InvoiceHeader[],
  adjustments: Array<DocumentLevelAdjustment & { invoice_id: string }>,
): InvoiceHeader[] {
  const byInvoice = new Map<string, DocumentLevelAdjustment[]>();
  const headerIds = new Set(headers.map((header) => header.invoice_id));
  for (const { invoice_id: invoiceId, ...adjustment } of adjustments) {
    if (!headerIds.has(invoiceId)) throw new Error(`Document adjustment ${adjustment.adjustment_id} references missing invoice ${invoiceId}.`);
    byInvoice.set(invoiceId, [...(byInvoice.get(invoiceId) ?? []), adjustment]);
  }
  return headers.map((header) => ({ ...header, document_level_adjustments: byInvoice.get(header.invoice_id) ?? [] }));
}

export async function parseLinesFile(file: File, options: ParseOptions = {}): Promise<InvoiceLine[]> {
  const text = await file.text();
  const records = parseCSV(text);

  return records.map((record, index) => {
    const lineAllowanceAmount = num(record, 'line_allowance_amount', 'line_discount');
    const lineDiscount = num(record, 'line_discount', 'line_allowance_amount');

    return {
      line_id: record.line_id || '',
      invoice_id: record.invoice_id || '',
      line_number: parseInt(record.line_number) || 0,
      description: options.itemFieldCompatibility === 'legacy_symmetric_fallback'
        ? str(record, 'description', 'item_name')
        : str(record, 'description'),
      item_name: options.itemFieldCompatibility === 'legacy_symmetric_fallback'
        ? str(record, 'item_name', 'description')
        : str(record, 'item_name'),
      quantity: parseFloat(record.quantity) || 0,
      unit_price: requiredNum(record, 'unit_price'),
      item_price_discount: num(record, 'item_price_discount', 'price_discount', 'unit_price_discount'),
      line_discount: lineDiscount,
      line_total_excl_vat: requiredNum(record, 'line_total_excl_vat', 'line_net_amount'),
      vat_rate: requiredNum(record, 'vat_rate'),
      vat_amount: requiredNum(record, 'vat_amount'),
      unit_of_measure: str(record, 'unit_of_measure', 'unit_code'),
      price_base_quantity: num(
        record,
        'price_base_quantity',
        'line_base_quantity',
        'item_price_base_quantity',
        'base_quantity'
      ),
      price_base_quantity_uom: str(
        record,
        'price_base_quantity_uom',
        'line_base_quantity_uom',
        'item_price_base_quantity_uom',
        'base_quantity_uom',
        'base_quantity_unit'
      ),
      tax_category_code: str(record, 'tax_category_code'),
      exemption_reason_code: str(record, 'exemption_reason_code', 'vat_exemption_reason_code'),
      exemption_reason_text: str(record, 'exemption_reason_text', 'vat_exemption_reason_text'),
      goods_service_type: str(record, 'goods_service_type', 'reverse_charge_goods_type'),
      line_allowance_amount: lineAllowanceAmount,
      line_charge_amount: num(record, 'line_charge_amount'),
      source_row_number: index + 2,
      upload_session_id: options.uploadSessionId,
      upload_manifest_id: options.uploadManifestId,
    };
  });
}
