import { 
  PintAEField, 
  MappingSuggestion, 
  FieldMapping,
  PINT_AE_UC1_FIELDS 
} from '@/types/fieldMapping';

// Common ERP column name patterns mapped to PINT-AE fields
const COLUMN_PATTERNS: Record<string, string[]> = {
  invoice_number: ['invoice_number', 'invoice_no', 'inv_no', 'invoice_id', 'inv_num', 'document_number', 'doc_no', 'bill_no', 'invoice#'],
  issue_date: ['issue_date', 'invoice_date', 'inv_date', 'document_date', 'doc_date', 'billing_date', 'date'],
  invoice_type: ['invoice_type', 'document_type', 'doc_type', 'type', 'inv_type', 'transaction_type'],
  currency: ['currency', 'currency_code', 'curr', 'ccy', 'invoice_currency', 'doc_currency'],
  fx_rate: ['fx_rate', 'exchange_rate', 'rate', 'exch_rate', 'currency_rate'],
  payment_due_date: ['due_date', 'payment_due', 'pay_date', 'payment_date', 'due'],
  
  seller_name: ['seller_name', 'vendor_name', 'supplier_name', 'company_name', 'seller', 'vendor', 'supplier'],
  seller_trn: ['seller_trn', 'vendor_trn', 'supplier_trn', 'tax_id', 'trn', 'vat_number', 'tax_number', 'seller_vat'],
  seller_street: ['seller_address', 'seller_street', 'vendor_address', 'supplier_address', 'company_address', 'address1'],
  seller_city: ['seller_city', 'vendor_city', 'supplier_city', 'city'],
  seller_country: ['seller_country', 'vendor_country', 'supplier_country', 'country', 'country_code'],
  
  buyer_name: ['buyer_name', 'customer_name', 'client_name', 'cust_name', 'buyer', 'customer', 'client', 'bill_to_name'],
  buyer_trn: ['buyer_trn', 'customer_trn', 'client_trn', 'customer_tax_id', 'buyer_vat', 'cust_trn'],
  buyer_address: ['buyer_address', 'customer_address', 'client_address', 'bill_to_address', 'ship_to_address'],
  buyer_country: ['buyer_country', 'customer_country', 'client_country', 'bill_to_country'],
  
  line_id: ['line_id', 'line_number', 'line_no', 'item_id', 'seq', 'line_num', 'row_number'],
  line_quantity: ['quantity', 'qty', 'line_qty', 'units', 'amount', 'line_quantity'],
  line_unit_price: ['unit_price', 'price', 'rate', 'item_price', 'unit_rate', 'net_price'],
  line_net_amount: ['line_total', 'line_amount', 'net_amount', 'line_net', 'extended_amount', 'line_value'],
  line_description: ['description', 'item_description', 'product_name', 'item_name', 'line_desc', 'product', 'item'],
  line_vat_rate: ['vat_rate', 'tax_rate', 'tax_percent', 'tax_pct', 'vat_percent', 'tax_%'],
  line_vat_amount: ['vat_amount', 'tax_amount', 'line_tax', 'line_vat', 'tax'],
  
  total_excl_vat: ['total_excl_vat', 'net_total', 'subtotal', 'total_net', 'invoice_net', 'amount_excl_tax', 'net_amount'],
  vat_total: ['vat_total', 'tax_total', 'total_vat', 'total_tax', 'invoice_tax', 'tax_amount'],
  total_incl_vat: ['total_incl_vat', 'gross_total', 'invoice_total', 'total', 'grand_total', 'amount_incl_tax', 'total_amount'],
  amount_due: ['amount_due', 'balance_due', 'outstanding', 'remaining', 'payable'],
};

// Calculate string similarity (Levenshtein distance based)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[_\-\s]/g, '');
  const s2 = str2.toLowerCase().replace(/[_\-\s]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1);
      }
    }
  }
  
  return dp[m][n];
}

// Detect data type from sample values
function detectDataType(values: string[]): 'string' | 'number' | 'date' | 'boolean' {
  const nonEmptyValues = values.filter(v => v && v.trim());
  if (nonEmptyValues.length === 0) return 'string';
  
  // Check for dates
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YY or MM/DD/YYYY
  ];
  
  const dateMatches = nonEmptyValues.filter(v => 
    datePatterns.some(p => p.test(v.trim()))
  );
  if (dateMatches.length >= nonEmptyValues.length * 0.8) return 'date';
  
  // Check for numbers
  const numericValues = nonEmptyValues.filter(v => 
    !isNaN(parseFloat(v.replace(/[,\s]/g, '')))
  );
  if (numericValues.length >= nonEmptyValues.length * 0.8) return 'number';
  
  // Check for booleans
  const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
  const boolMatches = nonEmptyValues.filter(v => 
    booleanValues.includes(v.toLowerCase().trim())
  );
  if (boolMatches.length >= nonEmptyValues.length * 0.8) return 'boolean';
  
  return 'string';
}

// Generate mapping suggestions
export function generateMappingSuggestions(
  erpColumns: string[],
  sampleData: Record<string, string>[]
): MappingSuggestion[] {
  const suggestions: MappingSuggestion[] = [];
  const usedTargetFields = new Set<string>();
  
  // First pass: exact pattern matches
  for (let colIndex = 0; colIndex < erpColumns.length; colIndex++) {
    const column = erpColumns[colIndex];
    const normalizedColumn = column.toLowerCase().replace(/[_\-\s]/g, '');
    const sampleValues = sampleData.slice(0, 5).map(row => row[column] || '');
    
    let bestMatch: { fieldId: string; confidence: number; reason: string } | null = null;
    
    for (const [fieldId, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (usedTargetFields.has(fieldId)) continue;
      
      for (const pattern of patterns) {
        const normalizedPattern = pattern.toLowerCase().replace(/[_\-\s]/g, '');
        
        // Exact match
        if (normalizedColumn === normalizedPattern) {
          bestMatch = { fieldId, confidence: 0.95, reason: `Exact pattern match: "${pattern}"` };
          break;
        }
        
        // Contains match
        if (normalizedColumn.includes(normalizedPattern) || normalizedPattern.includes(normalizedColumn)) {
          const similarity = stringSimilarity(column, pattern);
          if (!bestMatch || similarity > bestMatch.confidence) {
            bestMatch = { fieldId, confidence: Math.min(0.85, similarity + 0.1), reason: `Pattern contains: "${pattern}"` };
          }
        }
      }
      
      if (bestMatch?.confidence >= 0.95) break;
    }
    
    // If no pattern match, try similarity with field names
    if (!bestMatch || bestMatch.confidence < 0.7) {
      for (const field of PINT_AE_UC1_FIELDS) {
        if (usedTargetFields.has(field.id)) continue;
        
        const nameSimilarity = stringSimilarity(column, field.name);
        const idSimilarity = stringSimilarity(column, field.id);
        const maxSimilarity = Math.max(nameSimilarity, idSimilarity);
        
        if (maxSimilarity > 0.6 && (!bestMatch || maxSimilarity > bestMatch.confidence)) {
          bestMatch = { 
            fieldId: field.id, 
            confidence: maxSimilarity * 0.9, 
            reason: `Name similarity: ${Math.round(maxSimilarity * 100)}%` 
          };
        }
      }
    }
    
    // Data type validation boost
    if (bestMatch) {
      const targetField = PINT_AE_UC1_FIELDS.find(f => f.id === bestMatch!.fieldId);
      if (targetField) {
        const detectedType = detectDataType(sampleValues);
        if (detectedType === targetField.dataType) {
          bestMatch.confidence = Math.min(0.98, bestMatch.confidence + 0.05);
          bestMatch.reason += ` + matching data type`;
        }
        
        usedTargetFields.add(bestMatch.fieldId);
        suggestions.push({
          erpColumn: column,
          erpColumnIndex: colIndex,
          targetField,
          confidence: bestMatch.confidence,
          reason: bestMatch.reason,
          sampleValues,
        });
      }
    }
  }
  
  // Sort by confidence descending
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// Convert suggestions to mappings
export function suggestionsToMappings(suggestions: MappingSuggestion[]): FieldMapping[] {
  return suggestions.map((s, index) => ({
    id: `mapping-${index}`,
    erpColumn: s.erpColumn,
    erpColumnIndex: s.erpColumnIndex,
    targetField: s.targetField,
    confidence: s.confidence,
    isConfirmed: s.confidence >= 0.9,
    transformations: [],
    sampleValues: s.sampleValues,
  }));
}

// Get unmapped mandatory fields
export function getUnmappedMandatoryFields(mappings: FieldMapping[]): PintAEField[] {
  const mappedFieldIds = new Set(mappings.map(m => m.targetField.id));
  return PINT_AE_UC1_FIELDS.filter(f => f.isMandatory && !mappedFieldIds.has(f.id));
}

// Get all available target fields not yet mapped
export function getAvailableTargetFields(mappings: FieldMapping[]): PintAEField[] {
  const mappedFieldIds = new Set(mappings.map(m => m.targetField.id));
  return PINT_AE_UC1_FIELDS.filter(f => !mappedFieldIds.has(f.id));
}
