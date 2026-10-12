export type VatRateContext = 'line' | 'adjustment' | 'breakdown';

export interface VatCategoryRateValidation {
  category: string;
  rate: number | null;
  normalization?: string;
  valid: boolean;
  reason?: string;
  expectsZeroTaxAmount: boolean;
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

export function validateVatCategoryRate(
  categoryValue: unknown,
  rateValue: unknown,
  context: VatRateContext,
): VatCategoryRateValidation {
  const normalized = normalizeVatCategory(categoryValue);
  const supplied = rateValue !== undefined && rateValue !== null && String(rateValue).trim() !== '';
  const numericRate = supplied ? Number(rateValue) : null;
  const base = { ...normalized, rate: numericRate, expectsZeroTaxAmount: normalized.category !== 'S' };
  const invalid = (reason: string): VatCategoryRateValidation => ({ ...base, valid: false, reason });

  if (!['S', 'Z', 'E', 'O', 'AE', 'N'].includes(normalized.category)) {
    return invalid(`Unsupported VAT category ${normalized.category || '(missing)'}.`);
  }
  if (supplied && !Number.isFinite(numericRate)) return invalid('VAT rate must be a finite number.');

  switch (normalized.category) {
    case 'S':
      return numericRate === 5 ? { ...base, valid: true } : invalid('Standard-rated VAT category S requires a VAT rate of exactly 5%.');
    case 'Z':
      return numericRate === 0 ? { ...base, valid: true } : invalid('Zero-rated VAT category Z requires a VAT rate of 0%.');
    case 'AE':
      return numericRate === 0 ? { ...base, valid: true } : invalid('Reverse-charge VAT category AE requires a VAT rate of 0%.');
    case 'E':
      if (context === 'adjustment') {
        return numericRate === 0 ? { ...base, valid: true } : invalid('Exempt document adjustments require a VAT rate of 0%.');
      }
      return !supplied ? { ...base, valid: true, rate: null } : invalid(`Exempt VAT category E must omit the VAT rate in the ${context}.`);
    case 'O':
      return !supplied ? { ...base, valid: true, rate: null } : invalid(`Not-subject-to-VAT category O must omit the VAT rate in the ${context}.`);
    case 'N':
      if (context === 'adjustment') return invalid('Document adjustments cannot use VAT category N.');
      return numericRate !== null && numericRate > 0
        ? { ...base, valid: true }
        : invalid('Standard-rate-additional-VAT category N requires a positive VAT rate.');
  }

  return invalid(`Unsupported VAT category ${normalized.category}.`);
}
