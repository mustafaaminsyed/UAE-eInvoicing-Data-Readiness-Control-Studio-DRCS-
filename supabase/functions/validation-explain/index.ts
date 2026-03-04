import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

type RuntimeWithDeno = typeof globalThis & {
  Deno?: {
    env?: { get: (key: string) => string | undefined };
    serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
  };
};

const runtime = globalThis as RuntimeWithDeno;

const RuleReferenceSchema = z.object({
  ruleCode: z.string(),
  ruleName: z.string().optional(),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
  specRef: z.string().optional(),
});

const RootCauseSchema = z.object({
  cause: z.string(),
  probability: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

const FixStepSchema = z.object({
  step: z.string(),
  ownerHint: z.string(),
  linkToUI: z.string().optional(),
});

const ExplanationPackSchema = z.object({
  summary: z.string(),
  whyItFailed: z.array(z.string()),
  likelyRootCauses: z.array(RootCauseSchema),
  impact: z.string(),
  fixChecklist: z.array(FixStepSchema),
  ruleReferences: z.array(RuleReferenceSchema),
  confidence: z.number().min(0).max(1),
  engine: z.object({
    source: z.enum(['cache', 'heuristic', 'assist']),
    version: z.enum(['heuristic_v1', 'assist_v1']),
    promptVersion: z.string().optional(),
    heuristicRuleHint: z.string().optional(),
  }),
  evidenceSnapshot: z.record(z.unknown()),
});

const RequestSchema = z.object({
  mode: z.enum(['heuristic_only', 'assist']).optional(),
  prompt_version: z.string().optional(),
  regenerate: z.boolean().optional(),
  exception: z
    .object({
      checkId: z.string(),
      checkName: z.string(),
      severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
      message: z.string(),
      field: z.string().optional(),
      expectedValue: z.union([z.string(), z.number()]).optional(),
      actualValue: z.union([z.string(), z.number()]).optional(),
      invoiceId: z.string().optional(),
      invoiceNumber: z.string().optional(),
      datasetType: z.string().optional(),
    })
    .optional(),
  explanation_pack: ExplanationPackSchema.optional(),
});

function normalizeProbabilities(causes: Array<{ cause: string; probability: number; evidence: string[] }>) {
  if (causes.length === 0) return causes;
  const total = causes.reduce((sum, cause) => sum + Math.max(0, cause.probability), 0);
  if (total === 0) {
    const uniform = 1 / causes.length;
    return causes.map((cause, idx) => ({
      ...cause,
      probability: idx === causes.length - 1 ? 1 - uniform * (causes.length - 1) : uniform,
    }));
  }
  const normalized = causes.map((cause) => ({
    ...cause,
    probability: Number((Math.max(0, cause.probability) / total).toFixed(3)),
  }));
  const sum = normalized.reduce((acc, item) => acc + item.probability, 0);
  const delta = Number((1 - sum).toFixed(3));
  normalized[normalized.length - 1].probability = Number(
    Math.max(0, Math.min(1, normalized[normalized.length - 1].probability + delta)).toFixed(3)
  );
  return normalized;
}

function buildDeterministicPack(input: z.infer<typeof RequestSchema>): z.infer<typeof ExplanationPackSchema> {
  if (input.explanation_pack) {
    const parsed = ExplanationPackSchema.parse(input.explanation_pack);
    return {
      ...parsed,
      engine: {
        ...parsed.engine,
        source: 'heuristic',
        version: 'heuristic_v1',
        promptVersion: input.prompt_version || parsed.engine.promptVersion,
      },
    };
  }

  const exception = input.exception;
  if (!exception) {
    return {
      summary: 'No exception payload was provided for explanation generation.',
      whyItFailed: ['Missing input payload prevents rule-level diagnosis.'],
      likelyRootCauses: [{ cause: 'No exception payload', probability: 1, evidence: ['Request body is missing exception details.'] }],
      impact: 'Unable to assess impact without deterministic evidence.',
      fixChecklist: [{ step: 'Provide exception payload and retry explanation generation.', ownerHint: 'ASP Ops', linkToUI: '/exceptions' }],
      ruleReferences: [{ ruleCode: 'unknown', severity: 'Low' }],
      confidence: 0.2,
      engine: { source: 'heuristic', version: 'heuristic_v1', promptVersion: input.prompt_version || 'validation_explain_v1' },
      evidenceSnapshot: {},
    };
  }

  const causes = normalizeProbabilities([
    {
      cause: 'Source data violates the active validation rule',
      probability: 0.5,
      evidence: [
        `Rule message: ${exception.message}`,
        `Field: ${exception.field || '(unspecified)'}`,
      ],
    },
    {
      cause: 'Mapping/transformation path is not aligned to target semantics',
      probability: 0.3,
      evidence: ['Review mapping configuration and transformation steps for the field.'],
    },
    {
      cause: 'Master-data quality issue in upstream ERP extract',
      probability: 0.2,
      evidence: ['Observed value differs from expected validation condition.'],
    },
  ]);

  const pack: z.infer<typeof ExplanationPackSchema> = {
    summary: `${exception.checkName} failed for ${exception.invoiceNumber || exception.invoiceId || 'selected record'}.`,
    whyItFailed: [
      `Message: ${exception.message}`,
      `Expected: ${String(exception.expectedValue ?? '(not provided)')}`,
      `Actual: ${String(exception.actualValue ?? '(not provided)')}`,
    ],
    likelyRootCauses: causes,
    impact:
      exception.severity === 'Critical'
        ? 'High readiness impact with potential exchange/rejection risk.'
        : 'Validation quality impact requiring remediation.',
    fixChecklist: [
      {
        step: `Verify source value for ${exception.field || 'the failed field'} and correct at source if needed.`,
        ownerHint: 'Client Finance',
        linkToUI: exception.invoiceId ? `/invoice/${exception.invoiceId}` : '/exceptions',
      },
      {
        step: 'Review mapping/transformation configuration and re-run checks.',
        ownerHint: 'Client IT',
        linkToUI: exception.field
          ? `/mapping?dataset=${encodeURIComponent(exception.datasetType || 'AR')}&field=${encodeURIComponent(exception.field)}`
          : '/mapping',
      },
    ],
    ruleReferences: [
      {
        ruleCode: exception.checkId,
        ruleName: exception.checkName,
        severity: exception.severity,
      },
    ],
    confidence: 0.78,
    engine: {
      source: 'heuristic',
      version: 'heuristic_v1',
      promptVersion: input.prompt_version || 'validation_explain_v1',
    },
    evidenceSnapshot: {
      invoice: exception.invoiceNumber || exception.invoiceId,
      field: exception.field,
      expected: exception.expectedValue,
      actual: exception.actualValue,
      rawMessage: exception.message,
    },
  };

  return ExplanationPackSchema.parse(pack);
}

function mergeAssistPack(
  base: z.infer<typeof ExplanationPackSchema>,
  assistant: Partial<z.infer<typeof ExplanationPackSchema>>,
  promptVersion: string
) {
  const merged: z.infer<typeof ExplanationPackSchema> = {
    ...base,
    summary: assistant.summary || base.summary,
    whyItFailed: assistant.whyItFailed?.length ? assistant.whyItFailed : base.whyItFailed,
    fixChecklist: assistant.fixChecklist?.length ? assistant.fixChecklist : base.fixChecklist,
    engine: {
      source: 'assist',
      version: 'assist_v1',
      promptVersion,
      heuristicRuleHint: base.engine.heuristicRuleHint,
    },
  };
  return ExplanationPackSchema.parse(merged);
}

async function maybeAssistPack(
  basePack: z.infer<typeof ExplanationPackSchema>,
  promptVersion: string
): Promise<z.infer<typeof ExplanationPackSchema>> {
  const apiKey = runtime.Deno?.env?.get('OPENAI_API_KEY');
  if (!apiKey) return basePack;

  const prompt = `
You are improving wording only for a validation explanation pack.
Rules:
1) Do not invent facts.
2) Use only given evidence.
3) Keep cause probabilities unchanged.
4) Output strict JSON with keys: summary, whyItFailed, fixChecklist.

INPUT:
${JSON.stringify(basePack)}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: prompt,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return basePack;
    const payload = await response.json();
    const content = payload?.output?.[0]?.content?.[0]?.text;
    if (!content) return basePack;

    const parsed = JSON.parse(content);
    const partialSchema = z.object({
      summary: z.string().optional(),
      whyItFailed: z.array(z.string()).optional(),
      fixChecklist: z.array(FixStepSchema).optional(),
    });

    const assistant = partialSchema.parse(parsed);
    return mergeAssistPack(basePack, assistant, promptVersion);
  } catch {
    return basePack;
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);
    const mode = parsed.mode || 'heuristic_only';
    const promptVersion = parsed.prompt_version || 'validation_explain_v1';

    const deterministicPack = buildDeterministicPack(parsed);
    const finalPack =
      mode === 'assist'
        ? await maybeAssistPack(deterministicPack, promptVersion)
        : deterministicPack;

    return new Response(
      JSON.stringify({
        mode,
        prompt_version: promptVersion,
        explanation_pack: finalPack,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

if (runtime.Deno?.serve) {
  runtime.Deno.serve((req: Request) => handler(req));
}
