import { CustomCheckConfig, CustomCheckParameters } from '@/types/customChecks';
import { DataContext, Exception, Severity } from '@/types/compliance';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

function getFieldValue(record: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let value = record;
  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }
  return value;
}

function evaluateExpression(expression: string, record: any): number | undefined {
  try {
    // Replace field references with actual values
    let expr = expression;
    const fieldMatches = expression.match(/\{([^}]+)\}/g);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        const field = match.slice(1, -1);
        const value = getFieldValue(record, field);
        if (value === undefined || value === null) return undefined;
        expr = expr.replace(match, String(value));
      }
    }
    // Safely evaluate the expression
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expr}`)();
    return typeof result === 'number' ? result : undefined;
  } catch {
    return undefined;
  }
}

function formatMessage(template: string, record: any, extraContext?: Record<string, any>): string {
  let message = template;
  const fieldMatches = template.match(/\{([^}]+)\}/g);
  if (fieldMatches) {
    for (const match of fieldMatches) {
      const field = match.slice(1, -1);
      const value = extraContext?.[field] ?? getFieldValue(record, field) ?? '(undefined)';
      message = message.replace(match, String(value));
    }
  }
  return message;
}

function evaluateCondition(condition: string | undefined, record: any): boolean {
  if (!condition) return true;
  try {
    let expr = condition;
    const fieldMatches = condition.match(/\{([^}]+)\}/g);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        const field = match.slice(1, -1);
        const value = getFieldValue(record, field);
        if (typeof value === 'string') {
          expr = expr.replace(match, `"${value}"`);
        } else if (value === undefined || value === null) {
          expr = expr.replace(match, 'null');
        } else {
          expr = expr.replace(match, String(value));
        }
      }
    }
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return ${expr}`)());
  } catch {
    return true;
  }
}

export function runCustomCheck(check: CustomCheckConfig, data: DataContext): Exception[] {
  const exceptions: Exception[] = [];
  const params = check.parameters;

  const getDataset = () => {
    switch (check.dataset_scope) {
      case 'buyers': return data.buyers;
      case 'header': return data.headers;
      case 'lines': return data.lines;
      case 'cross-file': return data.headers;
      default: return [];
    }
  };

  const dataset = getDataset();

  switch (check.rule_type) {
    case 'missing':
      if (!params.field) break;
      for (const record of dataset) {
        if (!evaluateCondition(params.condition, record)) continue;
        const value = getFieldValue(record, params.field);
        if (value === undefined || value === null || String(value).trim() === '') {
          const invoiceId = (record as any).invoice_id;
          const header = invoiceId ? data.headerMap.get(invoiceId) : undefined;
          exceptions.push({
            id: generateId(),
            checkId: check.id || 'custom',
            checkName: check.name,
            severity: check.severity,
            message: formatMessage(check.message_template, record),
            invoiceId: invoiceId || (record as any).invoice_id,
            invoiceNumber: header?.invoice_number || (record as any).invoice_number,
            sellerTrn: header?.seller_trn || (record as any).seller_trn,
            buyerId: header?.buyer_id || (record as any).buyer_id,
            field: params.field,
            actualValue: '(empty)',
          });
        }
      }
      break;

    case 'duplicate':
      if (!params.fields || params.fields.length === 0) break;
      const seen = new Map<string, any[]>();
      for (const record of dataset) {
        if (!evaluateCondition(params.condition, record)) continue;
        const key = params.fields.map(f => String(getFieldValue(record, f) ?? '')).join('|');
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(record);
      }
      for (const [key, records] of seen) {
        if (records.length > 1) {
          for (const record of records) {
            const invoiceId = (record as any).invoice_id;
            const header = invoiceId ? data.headerMap.get(invoiceId) : undefined;
            exceptions.push({
              id: generateId(),
              checkId: check.id || 'custom',
              checkName: check.name,
              severity: check.severity,
              message: formatMessage(check.message_template, record, { count: records.length }),
              invoiceId: invoiceId || (record as any).invoice_id,
              invoiceNumber: header?.invoice_number || (record as any).invoice_number,
              sellerTrn: header?.seller_trn || (record as any).seller_trn,
              buyerId: header?.buyer_id || (record as any).buyer_id,
              field: params.fields.join(', '),
              actualValue: `${records.length} duplicates`,
            });
          }
        }
      }
      break;

    case 'math':
      if (!params.left_expression || !params.right_expression || !params.operator) break;
      for (const record of dataset) {
        if (!evaluateCondition(params.condition, record)) continue;
        const left = evaluateExpression(params.left_expression, record);
        const right = evaluateExpression(params.right_expression, record);
        if (left === undefined || right === undefined) continue;
        
        const tolerance = params.tolerance ?? 0.01;
        let passes = false;
        switch (params.operator) {
          case '=': passes = Math.abs(left - right) <= tolerance; break;
          case '!=': passes = Math.abs(left - right) > tolerance; break;
          case '>': passes = left > right; break;
          case '<': passes = left < right; break;
          case '>=': passes = left >= right; break;
          case '<=': passes = left <= right; break;
        }
        
        if (!passes) {
          const invoiceId = (record as any).invoice_id;
          const header = invoiceId ? data.headerMap.get(invoiceId) : undefined;
          exceptions.push({
            id: generateId(),
            checkId: check.id || 'custom',
            checkName: check.name,
            severity: check.severity,
            message: formatMessage(check.message_template, record, { left, right }),
            invoiceId: invoiceId || (record as any).invoice_id,
            invoiceNumber: header?.invoice_number || (record as any).invoice_number,
            sellerTrn: header?.seller_trn || (record as any).seller_trn,
            buyerId: header?.buyer_id || (record as any).buyer_id,
            field: params.left_expression,
            expectedValue: right,
            actualValue: left,
          });
        }
      }
      break;

    case 'regex':
      if (!params.field || !params.pattern) break;
      const regex = new RegExp(params.pattern);
      for (const record of dataset) {
        if (!evaluateCondition(params.condition, record)) continue;
        const value = getFieldValue(record, params.field);
        if (value !== undefined && value !== null && !regex.test(String(value))) {
          const invoiceId = (record as any).invoice_id;
          const header = invoiceId ? data.headerMap.get(invoiceId) : undefined;
          exceptions.push({
            id: generateId(),
            checkId: check.id || 'custom',
            checkName: check.name,
            severity: check.severity,
            message: formatMessage(check.message_template, record),
            invoiceId: invoiceId || (record as any).invoice_id,
            invoiceNumber: header?.invoice_number || (record as any).invoice_number,
            sellerTrn: header?.seller_trn || (record as any).seller_trn,
            buyerId: header?.buyer_id || (record as any).buyer_id,
            field: params.field,
            expectedValue: `matches ${params.pattern}`,
            actualValue: value,
          });
        }
      }
      break;

    case 'custom_formula':
      if (!params.formula) break;
      for (const record of dataset) {
        if (!evaluateCondition(params.condition, record)) continue;
        try {
          let expr = params.formula;
          const fieldMatches = expr.match(/\{([^}]+)\}/g);
          if (fieldMatches) {
            for (const match of fieldMatches) {
              const field = match.slice(1, -1);
              const value = getFieldValue(record, field);
              if (typeof value === 'string') {
                expr = expr.replace(match, `"${value}"`);
              } else if (value === undefined || value === null) {
                expr = expr.replace(match, 'null');
              } else {
                expr = expr.replace(match, String(value));
              }
            }
          }
          // eslint-disable-next-line no-new-func
          const result = new Function(`return ${expr}`)();
          if (!result) {
            const invoiceId = (record as any).invoice_id;
            const header = invoiceId ? data.headerMap.get(invoiceId) : undefined;
            exceptions.push({
              id: generateId(),
              checkId: check.id || 'custom',
              checkName: check.name,
              severity: check.severity,
              message: formatMessage(check.message_template, record),
              invoiceId: invoiceId || (record as any).invoice_id,
              invoiceNumber: header?.invoice_number || (record as any).invoice_number,
              sellerTrn: header?.seller_trn || (record as any).seller_trn,
              buyerId: header?.buyer_id || (record as any).buyer_id,
            });
          }
        } catch {
          // Skip records that fail formula evaluation
        }
      }
      break;
  }

  return exceptions;
}
