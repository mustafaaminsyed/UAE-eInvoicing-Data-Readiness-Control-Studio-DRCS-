# UAE eInvoicing Data Readiness and Control Studio (DRCS)

A React + Supabase application for assessing UAE PINT-AE eInvoicing readiness, executing compliance checks, triaging exceptions, and producing regulator-ready evidence packs.

## What this solution does

DRCS is an operational control studio for invoice data quality and compliance.

It supports:
- AR and AP dataset ingestion and separation
- Mapping ERP columns to PINT-AE UC1 fields
- Standard PINT-AE/UAE check execution
- Semantic crosswalk alignment between MoF fields, PINT/BT/BTUAE semantics, DCS canonical fields, and traceability state
- Mapping-driven DR coverage and traceability attribution
- Custom validation checks and AP search checks
- AI-generated validation explanations per exception (with cached responses)
- Traceability coverage and conformance gating
- Exception, case, rejection, and lifecycle views
- Evidence Pack export for audit/regulatory use
- Historical run-safe evidence snapshots and runtime-backed execution telemetry

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
- Route-level lazy loading for major workspace pages

Application state:
- `src/context/ComplianceContext.tsx` now focuses on data + validation run state
- `src/context/WorkspaceContext.tsx` owns workspace/session state such as dataset direction and active mapping profile
- `src/context/UploadLogContext.tsx` owns upload-log lifecycle state

Validation and domain logic:
- `src/lib/checks/*` for built-in and custom check runners
- `src/lib/coverage/*` for readiness/traceability coverage
- `src/lib/evidence/*` for Evidence Pack generation
- `src/lib/mapping/*` for mapping suggestion and coverage
- `src/lib/registry/semanticCrosswalk.ts` for target-state vs current-state semantic alignment across MoF, PINT, and DCS fields
- `src/lib/registry/semanticCrosswalkBuyerAlias.ts` for read-only document-type-aware buyer semantic interpretation
- `src/lib/registry/validationToDRMap.ts` for explicit validation-to-DR linkage

Traceability model:
- Distinguishes direct executable rule coverage from indirect scenario/applicability coverage
- Keeps target-state semantics separate from current runtime alignment
- Preserves buyer semantic divergence for tax-invoice vs commercial-XML views as explainability metadata before runtime routing changes

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
- Node.js 22.x
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
- For new Supabase projects, apply repo migrations before running checks. See:
  - `docs/supabase-bootstrap-for-new-project.md`

Optional feature flags:

```bash
VITE_ENABLE_CASES=false
VITE_ENABLE_SCENARIO_LENS=true
VITE_ENABLE_SCENARIO_LENS_MOCK_DATA=false
VITE_ENABLE_SCENARIO_APPLICABILITY_COLUMN=false
VITE_ENABLE_LOCAL_DEV_FALLBACK=false
```

`VITE_ENABLE_LOCAL_DEV_FALLBACK=true` allows Run Checks to use the built-in UC1 check pack when Supabase is not configured (local testing only).

When local fallback is enabled, Run Checks now also degrades safely if Supabase probes fail at fetch time during local review:
- checks library falls back to the built-in UC1 pack
- mapping templates degrade to raw-data / no-template mode
- diagnostics report a hardcoded fallback instead of blocking the page

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

Focused checks used heavily during recent hardening:

```bash
npm run build
npm run preview
```

Focused patch-scoped tests commonly used for recent controls / traceability work:

```bash
npm test -- src/pages/TraceabilityPage.render.test.tsx
npm test -- src/pages/ControlsDashboardPage.allTime.test.tsx src/pages/ControlsDashboardPage.entityRiskMatrix.test.tsx
npm test -- src/pages/RunChecksPage.localFallback.test.tsx
```

## Current UX status notes

- Traceability is the primary explainability surface and now includes:
  - grouped, aligned PINT DR table headers
  - indirect-rule status where scenario/applicability logic exists without direct field-rule ownership
  - MoF overlay semantic notes for buyer fields `24` and `25`
- Controls Dashboard now separates:
  - top operational KPI panel
  - diagnostic readiness radar
  - operational risk snapshot
- Some lower dashboard analytics remain intentionally heuristic/preview-oriented and are labeled as such until their runtime definitions are formalized.

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
  - Canonical MoF source-truth schema: `specs/uae/mof/source-schema-v1.json`

## Deployment

This is a static Vite app. Deploy the `dist/` output to any static host after `npm run build`, with required `VITE_*` variables configured in the host environment.

## Release tracepoints

Use annotated Git tags as rollback-safe checkpoints for production.

Latest checkpoint:
- Tag: `checkpoint-2026-03-07-prod-runchecks-hardening`
- Commit: `813ccc5`
- Scope:
  - Run Checks conformance gate diagnostics
  - Raw template mode support (no mapping profile required when canonical structure is present)
  - Last run context banner (Run Checks + Exceptions)
  - Safe UC1 sync behavior (no automatic overwrite of DB-managed check registry settings)

Latest production updates (after the checkpoint above):
- Traceability uses canonical MoF source registry overlay (`specs/uae/mof/source-schema-v1.json`) instead of legacy docs JSON.
- Run Checks supports raw-template execution mode when canonical upload structure is already present.
- `IBT-023` and `IBT-024` are classified as `system_default_allowed` (not generic ASP-derived), with strict PINT-AE validation still enforced.
- Evidence/Traceability labels now distinguish:
  - `System Default` fields (no upload column required, controlled default path)
  - `ASP Derived` fields (technical/derived fields not expected from upload templates)
- UI/UX consistency layer added across all app routes:
  - shared background gradient + grid overlay system in app shell
  - sidebar-area grid masking and shell isolation to prevent visual bleed lines
  - top navigation chrome alignment for consistent dark-mode rendering
- Landing page redesigned as a premium SaaS entry experience:
  - two-column hero, capability cards, workflow narrative, module cards, trust/intelligence section, and CTA banner
  - added direct hero CTA to `Check Registry` alongside `Explore Traceability`
- Controls Dashboard upgraded with clearer executive logic:
  - readiness score band with visible thresholds and legend
  - removal of SLA breach KPI from the executive row
  - explicit PINT-AE DR coverage + MoF mandatory coverage KPI tiles
  - readiness score weighting disclosure (pass-rate, DR coverage, MoF coverage, critical pressure)

Latest platform hardening updates:
- Evidence Pack is now historical-run safe:
  - historical evidence uses persisted run snapshots instead of current in-memory populations
  - historical export is blocked when required snapshot data is unavailable
- Evidence execution counts are now runtime-backed across the active validation layers:
  - core runner telemetry
  - PINT/UAE runner telemetry
  - org-profile runner telemetry
- Evidence Pack execution rows now surface multi-layer rule execution rather than only the PINT/UAE subset.
- Dashboard high-level exception preview now derives from the normalized exception inventory instead of check-result summary counts.
- Control registry was aligned for executable UAE VAT/runtime rules so governed rules now map to explicit controls.
- `ComplianceContext` was modularized incrementally:
  - workspace/session state extracted into `WorkspaceContext`
  - upload-log state extracted into `UploadLogContext`
- Landing experience redesigned into a premium DCS-specific hero/header system:
  - floating landing nav/header bar
  - restored theme toggle
  - Dariba-aligned dark-mode palette
  - simplified executive preview composition
- Shared app shell and route loading were refined:
  - floating/sticky workspace sidebar treatment
  - route-level code splitting for heavier pages and export libraries

Create a new checkpoint tag:

```bash
git fetch origin --prune
git tag -a checkpoint-YYYY-MM-DD-<label> <commit_sha> -m "Production tracepoint"
git push origin checkpoint-YYYY-MM-DD-<label>
```

Rollback to a checkpoint:

```bash
git fetch origin --tags
git checkout checkpoint-YYYY-MM-DD-<label>
```

Or restore `main` to a checkpoint in a controlled way:

```bash
git checkout main
git pull --rebase origin main
git revert <bad_commit_sha>
# or open a rollback PR based on the checkpoint tag
```
