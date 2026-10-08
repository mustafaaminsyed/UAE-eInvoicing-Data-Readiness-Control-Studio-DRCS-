import type { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type {
  CanonicalDataset, CanonicalFieldMapping, CanonicalKeyRule, CanonicalSourceAttribution,
  CanonicalizationDiagnostic, CanonicalizationInput, CanonicalizationResult, CanonicalValueOrigin,
} from '@/types/canonicalIngestion';
import { applyTransformationsStrict } from '@/lib/mapping/transformationEngine';

type CanonicalRecord = Record<string, string | number | boolean | undefined>;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildKey(rule: CanonicalKeyRule, row: Record<string, string>, scope: string, defaultPrefix: string) {
  if (rule.sourceColumns.length === 0) return { origin: 'missing' as const, error: 'At least one source column is required for a key rule.' };
  if (rule.mode === 'source' && rule.sourceColumns.length !== 1) return { origin: 'missing' as const, error: 'A source key rule must select exactly one source column.' };
  const parts = rule.sourceColumns.map((column) => String(row[column] ?? '').trim());
  if (parts.some((part) => part === '')) return { origin: 'missing' as const, sourceValue: parts.join('|'), error: `Key source is blank: ${rule.sourceColumns.join(', ')}` };
  if (rule.mode === 'source') return { value: parts[0], sourceValue: parts[0], origin: 'direct' as const };
  const prefix = (rule.prefix || defaultPrefix).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') || defaultPrefix;
  const normalized = parts.map(normalizeKeyPart).join('|');
  return { value: `${prefix}-${stableHash(`${scope}|${normalized}`)}`, sourceValue: parts.join('|'), origin: 'generated' as const };
}

function mappingOrigin(mapping: CanonicalFieldMapping, sourceValue: string): CanonicalValueOrigin {
  if (mapping.transformations.some((item) => item.type === 'static_value')) return 'static';
  if (mapping.transformations.some((item) => item.type !== 'none')) return 'transformed';
  return sourceValue === '' ? 'missing' : 'direct';
}

function coerceValue(value: string, mapping: CanonicalFieldMapping, diagnostics: CanonicalizationDiagnostic[], sourceRow: number) {
  if (value === '') return undefined;
  if (mapping.targetDataType === 'number') {
    const numeric = Number(value.replace(/,/g, ''));
    if (!Number.isFinite(numeric)) {
      diagnostics.push({ severity: 'error', code: 'invalid_number', sourceRow, dataset: mapping.targetDataset, targetField: mapping.targetField, message: `Value "${value}" is not a valid number for ${mapping.targetField}.` });
      return undefined;
    }
    return numeric;
  }
  if (mapping.targetDataType === 'boolean') {
    const normalized = value.toLowerCase();
    if (!['true', 'false', '1', '0', 'yes', 'no'].includes(normalized)) {
      diagnostics.push({ severity: 'error', code: 'invalid_boolean', sourceRow, dataset: mapping.targetDataset, targetField: mapping.targetField, message: `Value "${value}" is not a valid boolean for ${mapping.targetField}.` });
      return undefined;
    }
    return ['true', '1', 'yes'].includes(normalized);
  }
  return value;
}

function mergeRecord(existing: CanonicalRecord | undefined, incoming: CanonicalRecord, dataset: CanonicalDataset, recordId: string, sourceRow: number, diagnostics: CanonicalizationDiagnostic[]) {
  if (!existing) return incoming;
  const merged = { ...existing };
  for (const [field, incomingValue] of Object.entries(incoming)) {
    if (incomingValue === undefined || incomingValue === '') continue;
    const existingValue = merged[field];
    if (existingValue === undefined || existingValue === '') merged[field] = incomingValue;
    else if (field !== 'source_row_number' && String(existingValue) !== String(incomingValue)) diagnostics.push({ severity: 'error', code: 'conflicting_record', sourceRow, dataset, recordId, targetField: field, message: `${dataset} record ${recordId} has conflicting values for ${field}: "${existingValue}" and "${incomingValue}".` });
  }
  return merged;
}

export function canonicalizeSourceRows(input: CanonicalizationInput): CanonicalizationResult {
  const diagnostics: CanonicalizationDiagnostic[] = [];
  const provenance: CanonicalSourceAttribution[] = [];
  const buyerRecords = new Map<string, CanonicalRecord>();
  const headerRecords = new Map<string, CanonicalRecord>();
  const lineRecords = new Map<string, CanonicalRecord>();
  const lineSequenceByInvoice = new Map<string, number>();

  input.rows.forEach((row, rowIndex) => {
    const sourceRow = rowIndex + 2;
    const keyScope = input.keyScope?.trim() || 'UNSCOPED-DIAGNOSTIC';
    const buyerKey = buildKey(input.relationships.buyerKey, row, `${keyScope}|BUYER`, 'BUYER');
    const invoiceKey = buildKey(input.relationships.invoiceKey, row, `${keyScope}|INVOICE`, 'INVOICE');
    const lineKey = buildKey(input.relationships.lineKey, row, `${keyScope}|LINE`, 'LINE');
    const keys = [
      { dataset: 'buyers' as const, field: 'buyer_id', key: buyerKey, rule: input.relationships.buyerKey },
      { dataset: 'headers' as const, field: 'invoice_id', key: invoiceKey, rule: input.relationships.invoiceKey },
      { dataset: 'lines' as const, field: 'line_id', key: lineKey, rule: input.relationships.lineKey },
    ];
    keys.forEach(({ dataset, field, key, rule }) => {
      if (!key.error) return;
      diagnostics.push({ severity: 'error', code: rule.sourceColumns.length === 0 || (rule.mode === 'source' && rule.sourceColumns.length !== 1) ? 'invalid_key_rule' : 'missing_key_source', sourceRow, dataset, targetField: field, message: key.error });
    });
    if (!buyerKey.value || !invoiceKey.value || !lineKey.value) return;

    const records: Record<CanonicalDataset, CanonicalRecord> = {
      buyers: { buyer_id: buyerKey.value, source_row_number: sourceRow },
      headers: { invoice_id: invoiceKey.value, buyer_id: buyerKey.value, source_row_number: sourceRow },
      lines: { line_id: lineKey.value, invoice_id: invoiceKey.value, source_row_number: sourceRow },
    };
    [
      { dataset: 'buyers' as const, recordId: buyerKey.value, targetField: 'buyer_id', key: buyerKey, rule: input.relationships.buyerKey },
      { dataset: 'headers' as const, recordId: invoiceKey.value, targetField: 'invoice_id', key: invoiceKey, rule: input.relationships.invoiceKey },
      { dataset: 'headers' as const, recordId: invoiceKey.value, targetField: 'buyer_id', key: buyerKey, rule: input.relationships.buyerKey },
      { dataset: 'lines' as const, recordId: lineKey.value, targetField: 'line_id', key: lineKey, rule: input.relationships.lineKey },
      { dataset: 'lines' as const, recordId: lineKey.value, targetField: 'invoice_id', key: invoiceKey, rule: input.relationships.invoiceKey },
    ].forEach(({ dataset, recordId, targetField, key, rule }) => provenance.push({ dataset, recordId, targetField, sourceFile: input.sourceFile, sourceSheet: input.sourceSheet, sourceRow, sourceColumn: rule.sourceColumns.join(' + '), sourceValue: key.sourceValue, outputValue: key.value, origin: key.origin }));

    for (const mapping of input.mappings) {
      const relationshipControlled =
        (mapping.targetDataset === 'buyers' && mapping.targetField === 'buyer_id') ||
        (mapping.targetDataset === 'headers' && ['buyer_id', 'invoice_id'].includes(mapping.targetField)) ||
        (mapping.targetDataset === 'lines' && ['invoice_id', 'line_id', 'line_number'].includes(mapping.targetField));
      if (relationshipControlled) {
        diagnostics.push({
          severity: 'error', code: 'reserved_relationship_field', sourceRow,
          dataset: mapping.targetDataset, targetField: mapping.targetField,
          message: `${mapping.targetDataset}.${mapping.targetField} is controlled by relationship rules and cannot be overwritten by a field mapping.`,
        });
        continue;
      }
      const sourceValue = String(row[mapping.sourceColumn] ?? '');
      const transformed = applyTransformationsStrict(sourceValue, mapping.transformations, row);
      if (transformed.ok === false) {
        diagnostics.push({ severity: 'error', code: 'transformation_failed', sourceRow, dataset: mapping.targetDataset, targetField: mapping.targetField, message: `${mapping.sourceColumn} could not be transformed for ${mapping.targetField}: ${transformed.error}` });
        continue;
      }
      const outputValue = coerceValue(transformed.value, mapping, diagnostics, sourceRow);
      if (outputValue !== undefined) records[mapping.targetDataset][mapping.targetField] = outputValue;
      const recordId = mapping.targetDataset === 'buyers' ? buyerKey.value : mapping.targetDataset === 'headers' ? invoiceKey.value : lineKey.value;
      provenance.push({ dataset: mapping.targetDataset, recordId, targetField: mapping.targetField, sourceFile: input.sourceFile, sourceSheet: input.sourceSheet, sourceRow, sourceColumn: mapping.sourceColumn, sourceValue, outputValue: transformed.value, origin: mappingOrigin(mapping, sourceValue), mappingId: mapping.id });
    }

    const lineNumberColumn = input.relationships.lineNumberColumn;
    const rawLineNumber = lineNumberColumn ? String(row[lineNumberColumn] ?? '').trim() : '';
    const configuredLineNumber = rawLineNumber === '' ? undefined : Number(rawLineNumber.replace(/,/g, ''));
    const nextSequence = (lineSequenceByInvoice.get(invoiceKey.value) ?? 0) + 1;
    lineSequenceByInvoice.set(invoiceKey.value, nextSequence);
    const hasValidConfiguredLineNumber = configuredLineNumber !== undefined && Number.isFinite(configuredLineNumber);
    if (configuredLineNumber !== undefined && !hasValidConfiguredLineNumber) {
      diagnostics.push({
        severity: 'error', code: 'invalid_number', sourceRow, dataset: 'lines',
        recordId: lineKey.value, targetField: 'line_number',
        message: `Value "${rawLineNumber}" is not a valid number for line_number.`,
      });
    }
    const lineNumber = hasValidConfiguredLineNumber ? configuredLineNumber : nextSequence;
    records.lines.line_number = lineNumber;
    provenance.push({
      dataset: 'lines', recordId: lineKey.value, targetField: 'line_number',
      sourceFile: input.sourceFile, sourceSheet: input.sourceSheet, sourceRow,
      sourceColumn: lineNumberColumn, sourceValue: lineNumberColumn ? rawLineNumber : undefined,
      outputValue: String(lineNumber), origin: hasValidConfiguredLineNumber ? 'direct' : 'generated',
    });

    buyerRecords.set(buyerKey.value, mergeRecord(buyerRecords.get(buyerKey.value), records.buyers, 'buyers', buyerKey.value, sourceRow, diagnostics));
    headerRecords.set(invoiceKey.value, mergeRecord(headerRecords.get(invoiceKey.value), records.headers, 'headers', invoiceKey.value, sourceRow, diagnostics));
    if (lineRecords.has(lineKey.value)) diagnostics.push({ severity: 'error', code: 'duplicate_line_id', sourceRow, dataset: 'lines', recordId: lineKey.value, message: `Line identifier ${lineKey.value} is duplicated.` });
    else lineRecords.set(lineKey.value, records.lines);
  });

  for (const [invoiceId, header] of headerRecords) if (!buyerRecords.has(String(header.buyer_id))) diagnostics.push({ severity: 'error', code: 'orphan_header', dataset: 'headers', recordId: invoiceId, message: `Header ${invoiceId} references missing buyer ${header.buyer_id}.` });
  for (const [lineId, line] of lineRecords) if (!headerRecords.has(String(line.invoice_id))) diagnostics.push({ severity: 'error', code: 'orphan_line', dataset: 'lines', recordId: lineId, message: `Line ${lineId} references missing invoice ${line.invoice_id}.` });
  const hasErrors = diagnostics.some((item) => item.severity === 'error');
  return { buyers: [...buyerRecords.values()] as unknown as Buyer[], headers: [...headerRecords.values()] as unknown as InvoiceHeader[], lines: [...lineRecords.values()] as unknown as InvoiceLine[], diagnostics, provenance, canExport: !hasErrors, canLoadDiagnosticDataset: !hasErrors };
}
