import { CustomCheckConfig, InvestigationFlag } from '@/types/customChecks';
import { DataContext, Exception } from '@/types/compliance';
import { DatasetType } from '@/types/datasets';

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

export function normalizeInvoiceNumber(value: string | undefined | null): string {
  if (!value) return '';
  return value.toLowerCase().replace(/[\s-_/\\]/g, '');
}

export function normalizeVendorName(value: string | undefined | null): string {
  if (!value) return '';
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeTrn(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

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

function stringSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();
  if (!aNorm && !bNorm) return 1;
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;

  const longer = aNorm.length > bNorm.length ? aNorm : bNorm;
  const shorter = aNorm.length > bNorm.length ? bNorm : aNorm;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

type SearchCandidate = {
  invoiceId: string;
  invoiceNumber?: string;
  issueDate?: string;
  totalAmount?: number;
  sellerTrn?: string;
  sellerName?: string;
};

function toSearchCandidates(data: DataContext): SearchCandidate[] {
  return data.headers.map((header) => ({
    invoiceId: header.invoice_id,
    invoiceNumber: header.invoice_number,
    issueDate: header.issue_date,
    totalAmount: header.total_incl_vat ?? header.total_excl_vat,
    sellerTrn: header.seller_trn,
    sellerName: header.seller_name,
  }));
}

function parseISODate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createFlag(
  check: CustomCheckConfig,
  datasetType: DatasetType,
  candidate: SearchCandidate,
  message: string,
  confidenceScore?: number,
  matched?: SearchCandidate
): InvestigationFlag {
  return {
    id: generateId(),
    checkId: check.id || `search-${check.name}`,
    checkName: check.name,
    datasetType,
    invoiceId: candidate.invoiceId,
    invoiceNumber: candidate.invoiceNumber,
    counterpartyName: candidate.sellerName,
    message,
    confidenceScore,
    matchedInvoiceId: matched?.invoiceId,
    matchedInvoiceNumber: matched?.invoiceNumber,
    createdAt: new Date().toISOString(),
  };
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

    case 'fuzzy_duplicate':
    case 'invoice_number_variant':
    case 'trn_format_similarity':
      // Search checks are evaluated via runSearchCheck and should not emit hard exceptions.
      break;
  }

  return exceptions;
}

export function runSearchCheck(
  check: CustomCheckConfig,
  data: DataContext,
  datasetType: DatasetType
): InvestigationFlag[] {
  if ((check.check_type || 'VALIDATION') !== 'SEARCH_CHECK') return [];
  if (datasetType !== 'AP') return [];

  const candidates = toSearchCandidates(data);
  const flags: InvestigationFlag[] = [];
  const pairSeen = new Set<string>();

  const registerPair = (a: SearchCandidate, b: SearchCandidate): string => {
    const left = a.invoiceId < b.invoiceId ? a.invoiceId : b.invoiceId;
    const right = a.invoiceId < b.invoiceId ? b.invoiceId : a.invoiceId;
    return `${left}|${right}`;
  };

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const left = candidates[i];
      const right = candidates[j];
      const pairKey = registerPair(left, right);
      if (pairSeen.has(pairKey)) continue;

      const vendorSimilarity = stringSimilarity(
        normalizeVendorName(left.sellerName),
        normalizeVendorName(right.sellerName)
      );
      const leftAmount = left.totalAmount ?? 0;
      const rightAmount = right.totalAmount ?? 0;
      const amountDiff = Math.abs(leftAmount - rightAmount);
      const leftDate = parseISODate(left.issueDate);
      const rightDate = parseISODate(right.issueDate);
      const dateDiffDays =
        leftDate && rightDate
          ? Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24)
          : Number.POSITIVE_INFINITY;

      if (check.rule_type === 'fuzzy_duplicate') {
        const vendorThreshold = check.parameters.vendor_similarity_threshold ?? 0.9;
        const amountTolerance = check.parameters.amount_tolerance ?? 0.01;
        const windowDays = check.parameters.date_window_days ?? 3;
        if (
          vendorSimilarity >= vendorThreshold &&
          amountDiff <= amountTolerance &&
          dateDiffDays <= windowDays
        ) {
          pairSeen.add(pairKey);
          const confidence = Math.round((vendorSimilarity * 100 + 100) / 2);
          flags.push(
            createFlag(
              check,
              datasetType,
              left,
              `Possible duplicate with ${right.invoiceNumber || right.invoiceId}`,
              confidence,
              right
            )
          );
          flags.push(
            createFlag(
              check,
              datasetType,
              right,
              `Possible duplicate with ${left.invoiceNumber || left.invoiceId}`,
              confidence,
              left
            )
          );
        }
      }

      if (check.rule_type === 'invoice_number_variant') {
        const threshold = check.parameters.invoice_number_similarity_threshold ?? 0.88;
        const leftNorm = normalizeInvoiceNumber(left.invoiceNumber);
        const rightNorm = normalizeInvoiceNumber(right.invoiceNumber);
        const invSimilarity = stringSimilarity(leftNorm, rightNorm);
        if (leftNorm && rightNorm && invSimilarity >= threshold && leftNorm !== rightNorm) {
          pairSeen.add(pairKey);
          const confidence = Math.round(invSimilarity * 100);
          flags.push(
            createFlag(
              check,
              datasetType,
              left,
              `Possible invoice-number variant of ${right.invoiceNumber || right.invoiceId}`,
              confidence,
              right
            )
          );
          flags.push(
            createFlag(
              check,
              datasetType,
              right,
              `Possible invoice-number variant of ${left.invoiceNumber || left.invoiceId}`,
              confidence,
              left
            )
          );
        }
      }

      if (check.rule_type === 'trn_format_similarity') {
        const threshold = check.parameters.trn_distance_threshold ?? 2;
        const leftTrnRaw = left.sellerTrn || '';
        const rightTrnRaw = right.sellerTrn || '';
        const leftTrnNorm = normalizeTrn(leftTrnRaw);
        const rightTrnNorm = normalizeTrn(rightTrnRaw);
        if (!leftTrnRaw || !rightTrnRaw) continue;

        const rawDistance = levenshteinDistance(leftTrnRaw, rightTrnRaw);
        const similarNormalized = leftTrnNorm === rightTrnNorm && leftTrnRaw !== rightTrnRaw;

        if (similarNormalized || rawDistance <= threshold) {
          pairSeen.add(pairKey);
          const confidence = similarNormalized
            ? 95
            : Math.max(60, 100 - rawDistance * 15);
          flags.push(
            createFlag(
              check,
              datasetType,
              left,
              `Possible TRN formatting variant near ${right.invoiceNumber || right.invoiceId}`,
              confidence,
              right
            )
          );
          flags.push(
            createFlag(
              check,
              datasetType,
              right,
              `Possible TRN formatting variant near ${left.invoiceNumber || left.invoiceId}`,
              confidence,
              left
            )
          );
        }
      }
    }
  }

  return flags;
}
