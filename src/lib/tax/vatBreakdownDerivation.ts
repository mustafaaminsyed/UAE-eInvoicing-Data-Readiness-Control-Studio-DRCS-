import { DocumentLevelAdjustment, InvoiceHeader, InvoiceLine } from '@/types/compliance';

export type VatBreakdownEvaluationStatus = 'evaluated' | 'not_evaluated' | 'failed';

export interface VatBreakdownLineage {
  formula: string;
  rounding: 'two decimals, half away from zero at the breakdown result';
  comparisonTolerance: number;
  rules: string[];
  specVersion: 'PINT-AE 1.0.4';
}

export interface DerivedVatBreakdown {
  groupingKey: string;
  category: string;
  rate: number | null;
  taxableAmount: number;
  taxAmount: number;
  currency: string;
  contributingLineIds: string[];
  contributingAdjustmentIds: string[];
  normalizations: string[];
  status: 'evaluated';
  lineage: VatBreakdownLineage;
}

export interface VatBreakdownDerivationResult {
  invoiceId: string;
  currency: string;
  status: VatBreakdownEvaluationStatus;
  breakdowns: DerivedVatBreakdown[];
  dependencyReason?: string;
  failureReason?: string;
}

interface DecimalValue {
  coefficient: bigint;
  scale: number;
}

function parseDecimal(value: number): DecimalValue {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error(`Invalid decimal value: ${value}`);
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? 0);
  let coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

function addDecimal(left: DecimalValue, right: DecimalValue): DecimalValue {
  const scale = Math.max(left.scale, right.scale);
  return {
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  };
}

function multiplyDecimal(left: DecimalValue, right: DecimalValue): DecimalValue {
  return { coefficient: left.coefficient * right.coefficient, scale: left.scale + right.scale };
}

function percentDecimal(rate: number): DecimalValue {
  const decimal = parseDecimal(rate);
  return { coefficient: decimal.coefficient, scale: decimal.scale + 2 };
}

export function roundVatBreakdownMoney(value: DecimalValue): number {
  const targetScale = 2;
  if (value.scale <= targetScale) {
    return Number(value.coefficient * 10n ** BigInt(targetScale - value.scale)) / 100;
  }
  const divisor = 10n ** BigInt(value.scale - targetScale);
  let rounded = value.coefficient / divisor;
  const remainder = value.coefficient % divisor;
  if ((remainder < 0n ? -remainder : remainder) * 2n >= divisor) {
    rounded += value.coefficient < 0n ? -1n : 1n;
  }
  return Number(rounded) / 100;
}

function canonicalDecimal(value: number): string {
  const decimal = parseDecimal(value);
  if (decimal.coefficient === 0n) return '0';
  let coefficient = decimal.coefficient;
  let scale = decimal.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale--;
  }
  const sign = coefficient < 0n ? '-' : '';
  const digits = (coefficient < 0n ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  return scale === 0 ? `${sign}${digits}` : `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function normalizeVatCategory(value: unknown): { category: string; normalization?: string } {
  const source = String(value ?? '').trim().toUpperCase();
  if (source === 'RC' || source === 'REVERSE_CHARGE') {
    return { category: 'AE', normalization: `${source}->AE` };
  }
  const aliases: Record<string, string> = {
    STANDARD_RATE: 'S',
    ZERO_RATED: 'Z',
    ZERO_RATED_SUPPLY: 'Z',
    EXEMPT: 'E',
    EXEMPT_FROM_VAT: 'E',
    OUT_OF_SCOPE: 'O',
  };
  const category = aliases[source] ?? source;
  return { category, normalization: category !== source ? `${source}->${category}` : undefined };
}

function rateForLine(line: InvoiceLine, category: string): number | null {
  if (category === 'E' || category === 'O') return null;
  return line.vat_rate === undefined || line.vat_rate === null || !Number.isFinite(Number(line.vat_rate))
    ? null
    : Number(line.vat_rate);
}

function adjustmentRate(adjustment: DocumentLevelAdjustment, category: string): number | null {
  if (category === 'E' || category === 'O') return null;
  return adjustment.vat_rate === undefined || adjustment.vat_rate === null || !Number.isFinite(Number(adjustment.vat_rate))
    ? null
    : Number(adjustment.vat_rate);
}

function sumAdjustments(adjustments: DocumentLevelAdjustment[], kind: DocumentLevelAdjustment['kind']): number {
  const exact = adjustments
    .filter((adjustment) => adjustment.kind === kind)
    .reduce((sum, adjustment) => addDecimal(sum, parseDecimal(Number(adjustment.amount))), { coefficient: 0n, scale: 0 });
  return roundVatBreakdownMoney(exact);
}

export function deriveVatBreakdowns(
  header: InvoiceHeader,
  lines: InvoiceLine[]
): VatBreakdownDerivationResult {
  const base = { invoiceId: header.invoice_id, currency: header.currency, breakdowns: [] as DerivedVatBreakdown[] };

  const allowanceTotal = header.document_level_allowance_total;
  const chargeTotal = header.document_level_charge_total;
  if (allowanceTotal === undefined || chargeTotal === undefined) {
    return {
      ...base,
      status: 'not_evaluated',
      dependencyReason: 'Document-adjustment dependency: absence of document-level adjustments is not positively established.',
    };
  }

  const adjustments = header.document_level_adjustments ?? [];
  const adjustmentIds = adjustments.map((adjustment) => adjustment.adjustment_id);
  const hasAdjustmentTotals = Number(allowanceTotal) !== 0 || Number(chargeTotal) !== 0;
  if (hasAdjustmentTotals && adjustments.length === 0) {
    return {
      ...base,
      status: 'not_evaluated',
      dependencyReason: 'Document-adjustment dependency: adjustments exist as totals without category/rate allocation details.',
    };
  }
  if (adjustments.some((adjustment) => !adjustment.adjustment_id || !adjustment.kind || !adjustment.tax_category_code ||
    !Number.isFinite(Number(adjustment.amount)) || Number(adjustment.amount) < 0) ||
    new Set(adjustmentIds).size !== adjustmentIds.length) {
    return {
      ...base,
      status: 'not_evaluated',
      dependencyReason: 'Document-adjustment dependency: allocation details are incomplete or invalid.',
    };
  }
  const allocatedAllowanceTotal = sumAdjustments(adjustments, 'allowance');
  const allocatedChargeTotal = sumAdjustments(adjustments, 'charge');
  if (allocatedAllowanceTotal !== roundVatBreakdownMoney(parseDecimal(Number(allowanceTotal))) ||
    allocatedChargeTotal !== roundVatBreakdownMoney(parseDecimal(Number(chargeTotal)))) {
    return {
      ...base,
      status: 'not_evaluated',
      dependencyReason: `Document-adjustment dependency: allocated adjustments do not reconcile to header totals (allowance ${allocatedAllowanceTotal}/${allowanceTotal}, charge ${allocatedChargeTotal}/${chargeTotal}).`,
    };
  }

  const groups = new Map<string, {
    category: string;
    rate: number | null;
    amount: DecimalValue;
    lineIds: string[];
    adjustmentIds: string[];
    normalizations: Set<string>;
  }>();

  for (const line of lines) {
    const normalized = normalizeVatCategory(line.tax_category_code);
    if (!normalized.category) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} is missing its VAT category.` };
    }
    if (!['S', 'Z', 'E', 'O', 'AE', 'N'].includes(normalized.category)) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} uses unsupported VAT category ${normalized.category}.` };
    }
    const rate = rateForLine(line, normalized.category);
    if (!['E', 'O'].includes(normalized.category) && rate === null) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} is missing an applicable VAT rate.` };
    }
    if ((normalized.category === 'S' || normalized.category === 'AE' || normalized.category === 'N') && Number(rate) <= 0) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} requires a positive VAT rate for category ${normalized.category}.` };
    }
    if (normalized.category === 'Z' && rate !== 0) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} requires a zero VAT rate for category Z.` };
    }
    if ((normalized.category === 'E' || normalized.category === 'O') && Number(line.vat_rate ?? 0) !== 0) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} must not supply a non-zero VAT rate for category ${normalized.category}.` };
    }
    if (!Number.isFinite(Number(line.line_total_excl_vat))) {
      return { ...base, status: 'failed', failureReason: `Line ${line.line_id} has an invalid IBT-131 amount.` };
    }
    const rateKey = rate === null ? 'NA' : canonicalDecimal(rate);
    const groupingKey = `${normalized.category}|${rateKey}`;
    const group = groups.get(groupingKey) ?? {
      category: normalized.category,
      rate,
      amount: { coefficient: 0n, scale: 0 },
      lineIds: [],
      adjustmentIds: [],
      normalizations: new Set<string>(),
    };
    group.amount = addDecimal(group.amount, parseDecimal(Number(line.line_total_excl_vat)));
    group.lineIds.push(line.line_id);
    if (normalized.normalization) group.normalizations.add(normalized.normalization);
    groups.set(groupingKey, group);
  }


  for (const adjustment of adjustments) {
    const normalized = normalizeVatCategory(adjustment.tax_category_code);
    const rate = adjustmentRate(adjustment, normalized.category);
    if (!['S', 'Z', 'E', 'O', 'AE', 'N'].includes(normalized.category) ||
      (!['E', 'O'].includes(normalized.category) && rate === null) ||
      ((normalized.category === 'S' || normalized.category === 'AE' || normalized.category === 'N') && Number(rate) <= 0) ||
      (normalized.category === 'Z' && rate !== 0) ||
      (['E', 'O'].includes(normalized.category) && Number(adjustment.vat_rate ?? 0) !== 0)) {
      return {
        ...base,
        status: 'not_evaluated',
        dependencyReason: `Document-adjustment dependency: adjustment ${adjustment.adjustment_id} has an invalid VAT category/rate allocation.`,
      };
    }
    const rateKey = rate === null ? 'NA' : canonicalDecimal(rate);
    const groupingKey = `${normalized.category}|${rateKey}`;
    const group = groups.get(groupingKey) ?? {
      category: normalized.category,
      rate,
      amount: { coefficient: 0n, scale: 0 },
      lineIds: [],
      adjustmentIds: [],
      normalizations: new Set<string>(),
    };
    const signedAmount = adjustment.kind === 'allowance' ? -Number(adjustment.amount) : Number(adjustment.amount);
    group.amount = addDecimal(group.amount, parseDecimal(signedAmount));
    group.adjustmentIds.push(adjustment.adjustment_id);
    if (normalized.normalization) group.normalizations.add(normalized.normalization);
    groups.set(groupingKey, group);
  }

  const breakdowns = [...groups.entries()].map(([groupingKey, group]): DerivedVatBreakdown => {
    const taxableAmount = roundVatBreakdownMoney(group.amount);
    const taxAmount = group.category === 'S'
      ? roundVatBreakdownMoney(multiplyDecimal(group.amount, percentDecimal(group.rate ?? 0)))
      : 0;
    const formula = group.category === 'S'
      ? 'IBT-116 = sum(IBT-131); IBT-117 = round(IBT-116 x IBT-119 / 100, 2)'
      : 'IBT-116 = sum(IBT-131); IBT-117 = 0 under category-specific PINT-AE treatment';
    return {
      groupingKey,
      category: group.category,
      rate: group.rate,
      taxableAmount,
      taxAmount,
      currency: header.currency,
      contributingLineIds: group.lineIds,
      contributingAdjustmentIds: group.adjustmentIds,
      normalizations: [...group.normalizations],
      status: 'evaluated',
      lineage: {
        formula: group.adjustmentIds.length > 0
          ? formula.replace('sum(IBT-131)', 'sum(IBT-131) - document allowances + document charges')
          : formula,
        rounding: 'two decimals, half away from zero at the breakdown result',
        comparisonTolerance: group.category === 'S' ? 0.02 : 0,
        rules: group.category === 'S'
          ? ['ALIGNED-IBRP-S-08', 'ALIGNED-IBRP-S-09']
          : [`ALIGNED-IBRP-${group.category}-08`, `ALIGNED-IBRP-${group.category}-09`],
        specVersion: 'PINT-AE 1.0.4',
      },
    };
  }).sort((left, right) => left.groupingKey.localeCompare(right.groupingKey));

  return { ...base, status: 'evaluated', breakdowns };
}

export function sumVatBreakdownTax(breakdowns: DerivedVatBreakdown[]): number {
  const exact = breakdowns.reduce(
    (sum, breakdown) => addDecimal(sum, parseDecimal(breakdown.taxAmount)),
    { coefficient: 0n, scale: 0 }
  );
  return roundVatBreakdownMoney(exact);
}
