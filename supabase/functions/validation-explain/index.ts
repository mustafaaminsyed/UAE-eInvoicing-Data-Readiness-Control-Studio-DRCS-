import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Risk = 'Low' | 'Medium' | 'High' | 'Critical';
type HeuristicRuleHint =
  | 'buyer_trn_format'
  | 'seller_trn_format'
  | 'required_presence'
  | 'numeric_mismatch'
  | 'date_format'
  | 'generic';

type ExplainPayload = {
  exception_key: string;
  tenant_id?: string;
  regenerate?: boolean;
  prompt_version?: string;
  exception: {
    id?: string;
    check_id?: string;
    check_name?: string;
    severity?: string;
    message?: string;
    invoice_id?: string | null;
    invoice_number?: string | null;
    seller_trn?: string | null;
    buyer_id?: string | null;
    line_id?: string | null;
    field_name?: string | null;
    expected_value?: string | number | null;
    actual_value?: string | number | null;
    dataset_type?: string | null;
    direction?: string | null;
    validation_run_id?: string | null;
  };
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toRisk(value?: string): Risk {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') {
    return value;
  }
  return 'Medium';
}

function clampConfidence(value: unknown, fallback = 0.55): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeText(value: unknown): string {
  return safeString(value).trim().toLowerCase();
}

function detectHeuristicRule(payload: ExplainPayload): HeuristicRuleHint {
  const ex = payload.exception || {};
  const corpus = [
    normalizeText(ex.check_id),
    normalizeText(ex.check_name),
    normalizeText(ex.field_name),
    normalizeText(ex.message),
  ].join(' ');
  const field = normalizeText(ex.field_name);
  const looksFormatIssue =
    corpus.includes('invalid') || corpus.includes('format') || corpus.includes('pattern');

  if ((corpus.includes('buyer_trn') || field === 'buyer_trn') && looksFormatIssue) return 'buyer_trn_format';
  if ((corpus.includes('seller_trn') || field === 'seller_trn') && looksFormatIssue) return 'seller_trn_format';
  if (corpus.includes('date') && looksFormatIssue) return 'date_format';
  if (
    corpus.includes('required') ||
    corpus.includes('missing') ||
    corpus.includes('present') ||
    corpus.includes('empty')
  ) {
    return 'required_presence';
  }
  if (
    corpus.includes('mismatch') ||
    corpus.includes('does not match') ||
    corpus.includes('difference') ||
    corpus.includes('variance')
  ) {
    return 'numeric_mismatch';
  }
  return 'generic';
}

function extractExpectedDigitLength(expected: string): number | null {
  const match = expected.match(/(\d+)\s*[- ]?digit/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

function parseNumeric(value: unknown): number | null {
  const normalized = safeString(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function formatNumeric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function computeHeuristicConfidence(
  rule: HeuristicRuleHint,
  field: string,
  expected: string,
  actual: string,
  message: string,
): number {
  let confidence = rule === 'generic' ? 0.42 : 0.56;
  if (field) confidence += 0.1;
  if (expected) confidence += 0.1;
  if (actual) confidence += 0.1;
  if (expected && actual) confidence += 0.05;
  if (message) confidence += 0.05;
  if (rule === 'buyer_trn_format' || rule === 'seller_trn_format') confidence += 0.05;
  return clampConfidence(confidence, 0.45);
}

function fallbackExplanation(payload: ExplainPayload, reason?: string) {
  const ex = payload.exception || {};
  const expected = ex.expected_value != null ? String(ex.expected_value).trim() : '';
  const actual = ex.actual_value != null ? String(ex.actual_value).trim() : '';
  const field = ex.field_name || 'the validated field';
  const invoiceRef = ex.invoice_number || ex.invoice_id || 'the invoice';
  const risk = toRisk(ex.severity);
  const message = safeString(ex.message).trim();
  const ruleHint = detectHeuristicRule(payload);
  const expectedDisplay = expected || '(defined rule)';
  const actualDisplay = actual || '(empty)';
  const confidence = computeHeuristicConfidence(ruleHint, field, expected, actual, message);
  let explanation = '';
  let recommendedFix = '';

  if (ruleHint === 'buyer_trn_format' || ruleHint === 'seller_trn_format') {
    const expectedDigits = extractExpectedDigitLength(expected) || 15;
    const actualDigitsOnly = actual.replace(/\D/g, '');
    const issues: string[] = [];
    if (!actual) {
      issues.push('The value is empty.');
    } else {
      if (!/^\d+$/.test(actual)) issues.push('It contains non-numeric characters.');
      if (actualDigitsOnly.length !== expectedDigits) {
        issues.push(`It has ${actualDigitsOnly.length} digits instead of ${expectedDigits}.`);
      }
    }
    const subject = ruleHint === 'buyer_trn_format' ? 'Buyer TRN' : 'Seller TRN';
    const issueSummary =
      issues.length > 0
        ? issues.join(' ')
        : `It does not satisfy the expected ${expectedDigits}-digit numeric format.`;
    explanation = `${subject} format validation failed for ${invoiceRef}. ${issueSummary} Expected ${expectedDisplay} but found ${actualDisplay}.`;
    recommendedFix = `Correct ${field} to a ${expectedDigits}-digit numeric value (digits only, no spaces or letters), validate at source upload, then re-run checks.`;
  } else if (ruleHint === 'required_presence') {
    explanation = `${field} is mandatory for ${invoiceRef} but is missing or blank. ${message}`;
    recommendedFix = `Populate ${field} in source data and mapping output for all required records, then re-run checks.`;
  } else if (ruleHint === 'numeric_mismatch') {
    const expectedNum = parseNumeric(expected);
    const actualNum = parseNumeric(actual);
    const mismatchDetail =
      expectedNum !== null && actualNum !== null
        ? `Expected ${formatNumeric(expectedNum)} but found ${formatNumeric(actualNum)} (difference ${formatNumeric(Math.abs(expectedNum - actualNum))}).`
        : `Expected ${expectedDisplay} but found ${actualDisplay}.`;
    explanation = `Numeric consistency validation failed for ${invoiceRef}. ${mismatchDetail}`;
    recommendedFix = `Recalculate ${field} using the check formula and source line values, then align totals and re-run checks.`;
  } else if (ruleHint === 'date_format') {
    const expectedPattern = expected || 'YYYY-MM-DD';
    explanation = `Date format validation failed for ${invoiceRef}. Field ${field} has value ${actualDisplay}, which does not match ${expectedPattern}.`;
    recommendedFix = `Normalize ${field} to ${expectedPattern} in source extraction or mapping transformation, then re-run checks.`;
  } else {
    explanation = [
      `Rule ${ex.check_id || 'unknown rule'} failed for ${invoiceRef}.`,
      message,
      `Field ${field} expected ${expectedDisplay} but found ${actualDisplay}.`,
    ]
      .filter(Boolean)
      .join(' ');
    recommendedFix = expected
      ? `Review ${field} and align it to ${expected}. Re-run checks after correction.`
      : `Review ${field} for format/completeness according to ${ex.check_name || ex.check_id || 'the check'}. Re-run checks after correction.`;
  }

  return {
    explanation,
    risk,
    recommended_fix: recommendedFix,
    confidence,
    model: 'heuristic-local-v2',
    status: reason ? 'failed' : 'completed',
    error_message: reason || null,
    source_context: {
      heuristic_version: 'v2',
      rule_hint: ruleHint,
      evidence: {
        field,
        expected_value: expected || null,
        actual_value: actual || null,
        message: message || null,
      },
    },
  };
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content);
  } catch {
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const slice = content.slice(first, last + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callLlm(payload: ExplainPayload): Promise<{
  explanation: string;
  risk: Risk;
  recommended_fix: string;
  confidence: number;
  model: string;
  status: 'completed' | 'failed';
  error_message: string | null;
  source_context?: Record<string, unknown>;
}> {
  const apiKey = Deno.env.get('LLM_EXPLAINER_API_KEY');
  const apiBase = (Deno.env.get('LLM_EXPLAINER_API_URL') || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = Deno.env.get('LLM_EXPLAINER_MODEL') || 'gpt-4o-mini';

  if (!apiKey) {
    return fallbackExplanation(payload, 'LLM_EXPLAINER_API_KEY not configured');
  }

  const systemPrompt =
    'You are a UAE eInvoicing compliance analyst. Return only valid JSON with keys: explanation, risk, recommended_fix, confidence. ' +
    'risk must be one of Low|Medium|High|Critical. confidence must be a number between 0 and 1.';
  const userPrompt = `Exception context:\n${JSON.stringify(payload.exception, null, 2)}`;

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return fallbackExplanation(payload, `LLM API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? extractJsonObject(content) : null;
    if (!parsed) {
      return fallbackExplanation(payload, 'LLM returned non-JSON response');
    }

    const explanation = String(parsed.explanation || '').trim();
    const recommendedFix = String(parsed.recommended_fix || '').trim();
    if (!explanation || !recommendedFix) {
      return fallbackExplanation(payload, 'LLM response missing required fields');
    }

    return {
      explanation,
      risk: toRisk(typeof parsed.risk === 'string' ? parsed.risk : undefined),
      recommended_fix: recommendedFix,
      confidence: clampConfidence(parsed.confidence, 0.65),
      model,
      status: 'completed',
      error_message: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fallbackExplanation(payload, `LLM call failed: ${message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase environment not configured' }, 500);
  }

  let payload: ExplainPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload?.exception_key || !payload?.exception) {
    return jsonResponse({ error: 'exception_key and exception are required' }, 400);
  }

  const tenantId = payload.tenant_id || 'default';
  const promptVersion = payload.prompt_version || 'v1';
  const regenerate = payload.regenerate === true;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (!regenerate) {
    const { data: cached } = await supabase
      .from('validation_explanations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('exception_key', payload.exception_key)
      .eq('status', 'completed')
      .maybeSingle();

    if (cached) {
      return jsonResponse({ ...cached, cached: true });
    }
  }

  const generated = await callLlm(payload);

  const rowToUpsert = {
    tenant_id: tenantId,
    exception_key: payload.exception_key,
    check_exception_id: null,
    validation_run_id: payload.exception.validation_run_id || null,
    invoice_id: payload.exception.invoice_id || null,
    rule_code: payload.exception.check_id || null,
    check_id: payload.exception.check_id || null,
    check_name: payload.exception.check_name || null,
    dataset_type: payload.exception.dataset_type || null,
    direction: payload.exception.direction || null,
    explanation: generated.explanation,
    risk: generated.risk,
    recommended_fix: generated.recommended_fix,
    confidence: generated.confidence,
    model: generated.model,
    prompt_version: promptVersion,
    source_context: generated.source_context || payload.exception,
    status: generated.status,
    error_message: generated.error_message,
    generated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await supabase
    .from('validation_explanations')
    .upsert(rowToUpsert, { onConflict: 'tenant_id,exception_key' })
    .select('*')
    .single();

  if (saveError) {
    return jsonResponse(
      {
        error: 'Failed to persist validation explanation',
        details: saveError.message,
      },
      500,
    );
  }

  return jsonResponse({ ...saved, cached: false });
});
