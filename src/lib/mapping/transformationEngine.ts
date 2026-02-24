// Transformation Engine for Field Mapping
import { Transformation, TransformationType } from '@/types/fieldMapping';

/**
 * Apply a series of transformations to a value
 */
export function applyTransformations(
  value: string,
  transformations: Transformation[],
  rowContext?: Record<string, string>
): string {
  let result = value;

  for (const transform of transformations) {
    result = applyTransformation(result, transform, rowContext);
  }

  return result;
}

/**
 * Apply a single transformation
 */
function applyTransformation(
  value: string,
  transformation: Transformation,
  rowContext?: Record<string, string>
): string {
  const { type, config } = transformation;

  switch (type) {
    case 'none':
      return value;

    case 'trim':
      return value.trim();

    case 'uppercase':
      return value.toUpperCase();

    case 'lowercase':
      return value.toLowerCase();

    case 'date_parse':
      return parseDateTransform(value, config);

    case 'static_value':
      return config.value || '';

    case 'combine':
      return combineColumns(value, config, rowContext);

    case 'lookup':
      return lookupValue(value, config);

    case 'split':
      return splitValue(value, config);

    case 'regex_extract':
      return regexExtract(value, config);

    default:
      return value;
  }
}

/**
 * Parse date with format conversion
 */
function parseDateTransform(value: string, config: Record<string, any>): string {
  if (!value) return '';
  
  const { inputFormat, outputFormat } = config;
  
  // Simple date parsing - handles common formats
  let day: string, month: string, year: string;
  
  if (inputFormat === 'DD/MM/YYYY' || inputFormat === 'DD-MM-YYYY') {
    const sep = inputFormat.includes('/') ? '/' : '-';
    const parts = value.split(sep);
    if (parts.length !== 3) throw new Error(`Invalid date format: ${value}`);
    [day, month, year] = parts;
  } else if (inputFormat === 'MM/DD/YYYY' || inputFormat === 'MM-DD-YYYY') {
    const sep = inputFormat.includes('/') ? '/' : '-';
    const parts = value.split(sep);
    if (parts.length !== 3) throw new Error(`Invalid date format: ${value}`);
    [month, day, year] = parts;
  } else if (inputFormat === 'YYYY-MM-DD') {
    const parts = value.split('-');
    if (parts.length !== 3) throw new Error(`Invalid date format: ${value}`);
    [year, month, day] = parts;
  } else {
    // Try auto-detect
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      [, year, month, day] = isoMatch;
    } else {
      const slashMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (slashMatch) {
        [, day, month, year] = slashMatch;
      } else {
        throw new Error(`Cannot parse date: ${value}`);
      }
    }
  }
  
  // Output format
  if (outputFormat === 'YYYY-MM-DD') {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } else if (outputFormat === 'DD/MM/YYYY') {
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  } else if (outputFormat === 'ISO') {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`;
  }
  
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Combine multiple columns
 */
function combineColumns(
  value: string,
  config: Record<string, any>,
  rowContext?: Record<string, string>
): string {
  const { columns, separator = ' ' } = config;
  
  if (!columns || !Array.isArray(columns) || !rowContext) {
    return value;
  }
  
  const values = columns.map((col: string) => rowContext[col] || '').filter(Boolean);
  return values.join(separator);
}

/**
 * Lookup value in a mapping table
 */
function lookupValue(value: string, config: Record<string, any>): string {
  const { mappings, defaultValue } = config;
  
  if (!mappings || typeof mappings !== 'object') {
    return value;
  }
  
  // Case-insensitive lookup
  const key = Object.keys(mappings).find(
    k => k.toLowerCase() === value.toLowerCase()
  );
  
  return key ? mappings[key] : (defaultValue ?? value);
}

/**
 * Split value and extract part
 */
function splitValue(value: string, config: Record<string, any>): string {
  const { separator = ' ', index = 0 } = config;
  
  const parts = value.split(separator);
  return parts[index] || '';
}

/**
 * Extract using regex
 */
function regexExtract(value: string, config: Record<string, any>): string {
  const { pattern, group = 0 } = config;
  
  if (!pattern) return value;
  
  try {
    const regex = new RegExp(pattern);
    const match = value.match(regex);
    return match ? (match[group] || match[0]) : '';
  } catch {
    return value;
  }
}

/**
 * Validate transformation output
 */
export function validateTransformedValue(
  value: string,
  dataType: 'string' | 'number' | 'date' | 'boolean',
  format?: string
): { valid: boolean; error?: string } {
  if (!value && value !== '0') {
    return { valid: true }; // Empty is valid for optional fields
  }

  switch (dataType) {
    case 'number':
      const num = Number(value.replace(/,/g, ''));
      if (isNaN(num)) {
        return { valid: false, error: `"${value}" is not a valid number` };
      }
      break;

    case 'date':
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(value)) {
        return { valid: false, error: `"${value}" is not in YYYY-MM-DD format` };
      }
      break;

    case 'boolean':
      const boolValues = ['true', 'false', '1', '0', 'yes', 'no'];
      if (!boolValues.includes(value.toLowerCase())) {
        return { valid: false, error: `"${value}" is not a valid boolean` };
      }
      break;

    case 'string':
      if (format) {
        const regex = new RegExp(format);
        if (!regex.test(value)) {
          return { valid: false, error: `"${value}" doesn't match expected format` };
        }
      }
      break;
  }

  return { valid: true };
}

/**
 * Transform a full row using mappings
 */
export function transformRow(
  row: Record<string, string>,
  mappings: { erpColumn: string; targetFieldId: string; transformations: Transformation[] }[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const mapping of mappings) {
    const originalValue = row[mapping.erpColumn] || '';
    try {
      result[mapping.targetFieldId] = applyTransformations(
        originalValue,
        mapping.transformations,
        row
      );
    } catch (err) {
      result[mapping.targetFieldId] = originalValue;
    }
  }

  return result;
}
