import { DataContext } from '@/types/compliance';
import { AdaptedRulebookCheck, MofRulebook } from '@/lib/rulebook/types';
import { getInternalFieldByMofFieldNumber } from '@/lib/rulebook/adapter';

export interface RulebookShadowException {
  ruleId: string;
  exceptionCode: string;
  invoiceId?: string;
  lineId?: string;
  field?: string;
  message: string;
}

export interface RulebookShadowRunResult {
  exceptions: RulebookShadowException[];
  executedRules: number;
  skippedRules: number;
}

type InvoiceBundle = {
  invoiceId: string;
  header: Record<string, unknown>;
  buyer: Record<string, unknown> | null;
  lines: Record<string, unknown>[];
  invoiceType: 'tax_invoice' | 'commercial_xml';
};

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferInvoiceType(header: Record<string, unknown>): 'tax_invoice' | 'commercial_xml' {
  const raw = String(header.invoice_type || '').toLowerCase();
  if (raw.includes('commercial')) return 'commercial_xml';
  return 'tax_invoice';
}

function buildInvoiceBundles(data: DataContext): InvoiceBundle[] {
  return data.headers.map((header) => {
    const buyer = header.buyer_id ? data.buyerMap.get(String(header.buyer_id)) : null;
    const lines = data.linesByInvoice.get(String(header.invoice_id)) || [];
    return {
      invoiceId: String(header.invoice_id),
      header: header as unknown as Record<string, unknown>,
      buyer: (buyer as unknown as Record<string, unknown>) || null,
      lines: lines as unknown as Record<string, unknown>[],
      invoiceType: inferInvoiceType(header as unknown as Record<string, unknown>),
    };
  });
}

function readField(bundle: InvoiceBundle, field: string): unknown {
  if (field.startsWith('buyer_')) return bundle.buyer?.[field];
  if (
    field.startsWith('line_') ||
    field === 'quantity' ||
    field === 'unit_price' ||
    field === 'item_gross_price' ||
    field === 'vat_rate' ||
    field === 'vat_amount' ||
    field === 'line_vat_amount_aed' ||
    field === 'unit_of_measure' ||
    field === 'description' ||
    field === 'item_name'
  ) {
    const firstLine = bundle.lines[0];
    return firstLine ? firstLine[field] : undefined;
  }
  return bundle.header[field];
}

function lineFieldValues(bundle: InvoiceBundle, field: string): Array<{ lineId?: string; value: unknown }> {
  return bundle.lines.map((line) => ({ lineId: String(line.line_id || ''), value: line[field] }));
}

function isLineField(field: string): boolean {
  return (
    field.startsWith('line_') ||
    field === 'quantity' ||
    field === 'unit_price' ||
    field === 'item_gross_price' ||
    field === 'vat_rate' ||
    field === 'vat_amount' ||
    field === 'line_vat_amount_aed' ||
    field === 'unit_of_measure' ||
    field === 'description' ||
    field === 'item_name'
  );
}

export function runRulebookShadowChecks(
  data: DataContext,
  rulebook: MofRulebook,
  adaptedChecks: AdaptedRulebookCheck[]
): RulebookShadowRunResult {
  const exceptions: RulebookShadowException[] = [];
  const bundles = buildInvoiceBundles(data);
  const rulesById = new Map(rulebook.validation_rules.map((r) => [r.rule_id, r]));

  let executedRules = 0;
  let skippedRules = 0;

  for (const check of adaptedChecks) {
    if (!check.executable) {
      skippedRules++;
      continue;
    }

    const rule = rulesById.get(check.id);
    if (!rule) {
      skippedRules++;
      continue;
    }

    executedRules++;

    for (const bundle of bundles) {
      if (!check.invoiceTypes.includes(bundle.invoiceType)) continue;

      if (rule.type === 'presence' && Array.isArray(rule.required_field_numbers)) {
        for (const fieldNumber of rule.required_field_numbers) {
          const internalField = getInternalFieldByMofFieldNumber(fieldNumber);
          if (!internalField) continue;

          if (isLineField(internalField)) {
            if (bundle.lines.length === 0) {
              exceptions.push({
                ruleId: rule.rule_id,
                exceptionCode: rule.exception_code,
                invoiceId: bundle.invoiceId,
                field: internalField,
                message: `Missing mandatory line field ${internalField}: no lines present`,
              });
              continue;
            }
            lineFieldValues(bundle, internalField).forEach((entry) => {
              if (isEmpty(entry.value)) {
                exceptions.push({
                  ruleId: rule.rule_id,
                  exceptionCode: rule.exception_code,
                  invoiceId: bundle.invoiceId,
                  lineId: entry.lineId,
                  field: internalField,
                  message: `Missing mandatory line field ${internalField}`,
                });
              }
            });
          } else {
            const value = readField(bundle, internalField);
            if (isEmpty(value)) {
              exceptions.push({
                ruleId: rule.rule_id,
                exceptionCode: rule.exception_code,
                invoiceId: bundle.invoiceId,
                field: internalField,
                message: `Missing mandatory field ${internalField}`,
              });
            }
          }
        }
        continue;
      }

      if (!check.internalField) continue;

      if (isLineField(check.internalField)) {
        lineFieldValues(bundle, check.internalField).forEach((entry) => {
          const value = entry.value;
          if (rule.type === 'equals' && !isEmpty(value) && String(value) !== String(rule.expected_value ?? '')) {
            exceptions.push({
              ruleId: rule.rule_id,
              exceptionCode: rule.exception_code,
              invoiceId: bundle.invoiceId,
              lineId: entry.lineId,
              field: check.internalField,
              message: `Expected ${rule.expected_value}, got ${String(value)}`,
            });
          }
          if (rule.type === 'regex' && !isEmpty(value) && rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
            exceptions.push({
              ruleId: rule.rule_id,
              exceptionCode: rule.exception_code,
              invoiceId: bundle.invoiceId,
              lineId: entry.lineId,
              field: check.internalField,
              message: `Value does not match pattern ${rule.pattern}`,
            });
          }
          if (rule.type === 'fx_consistency' && !isEmpty(value)) {
            const line = bundle.lines.find((x) => String(x.line_id || '') === entry.lineId) || {};
            const amountAed = asNumber(value);
            const fxRate = asNumber(bundle.header.fx_rate);
            const currency = String(bundle.header.currency || '').toUpperCase();
            if (amountAed === null) return;

            const sourceAmount =
              rule.field_number === 48
                ? asNumber(line.vat_amount)
                : asNumber(line.line_total_excl_vat);

            if (sourceAmount === null) return;

            const expectedAed = currency === 'AED'
              ? sourceAmount
              : fxRate !== null && fxRate > 0
                ? sourceAmount * fxRate
                : null;

            if (expectedAed === null) {
              exceptions.push({
                ruleId: rule.rule_id,
                exceptionCode: rule.exception_code,
                invoiceId: bundle.invoiceId,
                lineId: entry.lineId,
                field: check.internalField,
                message: 'Cannot validate AED consistency: missing/invalid fx_rate for non-AED currency',
              });
              return;
            }

            if (Math.abs(amountAed - expectedAed) > 0.01) {
              exceptions.push({
                ruleId: rule.rule_id,
                exceptionCode: rule.exception_code,
                invoiceId: bundle.invoiceId,
                lineId: entry.lineId,
                field: check.internalField,
                message: `AED consistency mismatch. Expected ${expectedAed.toFixed(2)}, got ${amountAed.toFixed(2)}`,
              });
            }
          }
          if (rule.type === 'gross_price_consistency' && !isEmpty(value)) {
            const line = bundle.lines.find((x) => String(x.line_id || '') === entry.lineId) || {};
            const grossPrice = asNumber(value);
            const netUnitPrice = asNumber(line.unit_price);
            const quantity = asNumber(line.quantity);
            const lineDiscount = asNumber(line.line_discount);
            if (grossPrice === null || netUnitPrice === null) return;

            let expectedGrossPrice = netUnitPrice;
            if (
              lineDiscount !== null &&
              quantity !== null &&
              quantity > 0 &&
              Number.isFinite(lineDiscount)
            ) {
              expectedGrossPrice = netUnitPrice + lineDiscount / quantity;
            }

            if (Math.abs(grossPrice - expectedGrossPrice) > 0.01) {
              exceptions.push({
                ruleId: rule.rule_id,
                exceptionCode: rule.exception_code,
                invoiceId: bundle.invoiceId,
                lineId: entry.lineId,
                field: check.internalField,
                message: `Gross price mismatch. Expected ${expectedGrossPrice.toFixed(2)}, got ${grossPrice.toFixed(2)}`,
              });
            }
          }
        });
        continue;
      }

      const value = readField(bundle, check.internalField);
      if (rule.type === 'equals' && !isEmpty(value) && String(value) !== String(rule.expected_value ?? '')) {
        exceptions.push({
          ruleId: rule.rule_id,
          exceptionCode: rule.exception_code,
          invoiceId: bundle.invoiceId,
          field: check.internalField,
          message: `Expected ${rule.expected_value}, got ${String(value)}`,
        });
      }
      if (rule.type === 'regex' && !isEmpty(value) && rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
        exceptions.push({
          ruleId: rule.rule_id,
          exceptionCode: rule.exception_code,
          invoiceId: bundle.invoiceId,
          field: check.internalField,
          message: `Value does not match pattern ${rule.pattern}`,
        });
      }
      if (rule.type === 'conditional_format' && Array.isArray(rule.cases) && !isEmpty(value)) {
        const sellerTrn = String(bundle.header.seller_trn || '');
        const isVatRegistered = /^\d{15}$/.test(sellerTrn);
        const selectedCase = rule.cases.find((c) =>
          isVatRegistered
            ? String(c.when || '').includes('== true')
            : String(c.when || '').includes('== false')
        );
        const pattern = selectedCase?.pattern ? String(selectedCase.pattern) : '';
        if (pattern && !new RegExp(pattern).test(String(value))) {
          exceptions.push({
            ruleId: rule.rule_id,
            exceptionCode: rule.exception_code,
            invoiceId: bundle.invoiceId,
            field: check.internalField,
            message: `Conditional format mismatch. Pattern: ${pattern}`,
          });
        }
      }
      if (rule.type === 'default_if_missing' && isEmpty(value)) {
        exceptions.push({
          ruleId: rule.rule_id,
          exceptionCode: rule.exception_code,
          invoiceId: bundle.invoiceId,
          field: check.internalField,
          message: `Missing value; default would be applied: ${String(rule.default_value ?? '')}`,
        });
      }
    }
  }

  return {
    exceptions,
    executedRules,
    skippedRules,
  };
}
