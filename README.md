# UAE eInvoicing Data Readiness and Control Studio (DRCS)

A React + Supabase application for assessing UAE PINT-AE eInvoicing readiness, executing compliance checks, triaging exceptions, and producing regulator-ready evidence packs.

## What this solution does

DRCS is an operational control studio for invoice data quality and compliance.

It supports:
- AR and AP dataset ingestion and separation
- Mapping ERP columns to PINT-AE UC1 fields
- Standard PINT-AE/UAE check execution
- Custom validation checks and AP search checks
- AI-generated validation explanations per exception (with cached responses)
- Traceability coverage and conformance gating
- Exception, case, rejection, and lifecycle views
- Evidence Pack export for audit/regulatory use

## End-to-end workflow

1. Upload AR and/or AP files.
2. Build or select a mapping template.
3. Run checks for AR, AP, or ALL scope.
4. Review exceptions, cases, and controls insights.
5. Export an Evidence Pack.

## Key application modules

- Upload and Upload Audit
- Mapping and Traceability
- Run Checks and Check Registry
- Exceptions and Invoice Detail
- AI explanation panel in Exception Drill-down
- Cases, Rejections, and Controls Dashboard
- AP Explorer for search-check outputs
- Evidence Pack

## Architecture summary

Frontend:
- React 18 + TypeScript + Vite
- Tailwind + shadcn-ui components
- React Router for module navigation
- TanStack Query for query client wiring

Core orchestration:
- `src/context/ComplianceContext.tsx` manages dataset state, run scope, execution, and result aggregation.

Validation and domain logic:
- `src/lib/checks/*` for built-in and custom check runners
- `src/lib/coverage/*` for readiness/traceability coverage
- `src/lib/evidence/*` for Evidence Pack generation
- `src/lib/mapping/*` for mapping suggestion and coverage

Persistence (Supabase):
- Checks and runs: `pint_ae_checks`, `custom_checks`, `check_runs`, `check_exceptions`, `run_summaries`
- Risk and analytics: `entity_scores`, `client_risk_scores`, `investigation_flags`, `client_health`
- Operations: `cases`, `case_notes`, `rejections`, `invoice_lifecycle`
- Mapping: `mapping_templates`
- AI explanations cache: `validation_explanations`

Edge functions:
- `validation-explain` generates structured explanations (`explanation`, `risk`, `recommended_fix`, `confidence`) and stores them for reuse.

## Local setup

Prerequisites:
- Node.js 18+
- npm

Install and run:

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Team setup baseline

- Node version is pinned in `.nvmrc` (`22`).
- `package.json` has `engines` for Node and npm.
- Use `npm ci` for deterministic installs across devices.
- Copy `.env.example` to `.env` and fill local values.
- `.env` is intentionally local-only and not committed.

## Multi-device workflow (recommended)

Start of session:

```bash
git fetch --all --prune
git checkout <your-branch>
git pull --rebase origin <your-branch>
nvm use
npm ci
```

End of session:

```bash
git add -A
git commit -m "wip: <short summary>"
git push origin <your-branch>
```

Before merging:

```bash
git fetch origin
git rebase origin/main
npm run lint
npm run test
npm run build
```

## Environment variables

Create `.env` with:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
```

Important:
- Do not keep placeholder values like `YOUR_PROJECT_REF` or `YOUR_SUPABASE_ANON_KEY`.
- If placeholders are detected, Run Checks is now intentionally blocked and shows a setup error banner.

Optional feature flags:

```bash
VITE_ENABLE_CASES=false
VITE_ENABLE_SCENARIO_LENS=true
VITE_ENABLE_SCENARIO_LENS_MOCK_DATA=false
VITE_ENABLE_SCENARIO_APPLICABILITY_COLUMN=false
VITE_ENABLE_LOCAL_DEV_FALLBACK=false
```

`VITE_ENABLE_LOCAL_DEV_FALLBACK=true` allows Run Checks to use the built-in UC1 check pack when Supabase is not configured (local testing only).

Server-side environment variables for `validation-explain`:

```bash
LLM_EXPLAINER_API_KEY=your_llm_api_key
LLM_EXPLAINER_API_URL=https://api.openai.com/v1
LLM_EXPLAINER_MODEL=gpt-4o-mini
```

## AI validation explanation setup

1. Apply Supabase migrations (includes `validation_explanations` table):

```bash
supabase db push
```

2. Deploy the edge function:

```bash
supabase functions deploy validation-explain
```

3. Set edge function secrets in Supabase:

```bash
supabase secrets set LLM_EXPLAINER_API_KEY=...
supabase secrets set LLM_EXPLAINER_API_URL=https://api.openai.com/v1
supabase secrets set LLM_EXPLAINER_MODEL=gpt-4o-mini
```

4. In the app, open `Exceptions` and use `Explain` on any exception row.

## Quality and smoke tests

Run the basic quality gate locally:

```bash
npm run lint
npm run test
npm run build
```

## Spec utilities

To regenerate/import PINT-AE resources used by the solution:

```bash
npm run generate:pint-spec
```

## Repository structure

- `src/` application code
- `supabase/` Supabase SQL/migrations/config
- `scripts/` utility scripts
- `docs/` additional technical documentation
- `specs/` specification-related assets

## Deployment

This is a static Vite app. Deploy the `dist/` output to any static host after `npm run build`, with required `VITE_*` variables configured in the host environment.
