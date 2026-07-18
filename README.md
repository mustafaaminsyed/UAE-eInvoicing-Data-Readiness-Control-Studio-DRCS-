# UAE eInvoicing Data Readiness and Control Studio (DRCS)

A React + Supabase application for assessing UAE PINT-AE eInvoicing readiness, executing compliance checks, triaging exceptions, and producing regulator-ready evidence packs.

## What this solution does

DRCS is an operational control studio for invoice data quality and compliance.

It supports:
- AR and AP dataset ingestion and separation
- Mapping ERP columns to PINT-AE UC1 fields
- Standard PINT-AE/UAE check execution
- Credit note scenario support for field coverage and scenario-specific checks
- Semantic crosswalk alignment between MoF fields, PINT/BT/BTUAE semantics, DCS canonical fields, and traceability state
- Mapping-driven DR coverage and traceability attribution
- Governed mapping runs and diagnostic mapping runs with readiness qualification
- Custom validation checks and AP search checks
- AI-generated validation explanations per exception (with cached responses)
- Traceability coverage and conformance gating
- Exception, case, rejection, and lifecycle views
- End-user Evidence Pack generation with client-facing narrative summaries, technical appendices, and branded export
- Historical run-safe evidence snapshots and runtime-backed execution telemetry

## End-to-end workflow

1. Upload AR and/or AP files.
2. Build or select a mapping template.
3. Run governed or diagnostic checks for AR, AP, or ALL scope.
4. Review dashboard, exceptions, controls, and traceability outputs.
5. Generate a client-ready Evidence Pack with technical appendix support.

## Validation workflow

The runtime workflow is now explicitly organized around:

1. Upload and dataset qualification
2. Mapping and canonical alignment
3. Run Checks with governed or diagnostic execution context
4. Review of readiness, blockers, and remediation views
5. Evidence Pack generation from current or historical run context

Historical runs preserve their own evidence basis and do not fall back to whatever data is currently loaded in the browser.

## Evidence Pack

The Evidence Pack is no longer only a raw export bundle.

It now provides:
- executive verdict and readiness summary
- scope and methodology explanation
- priority blockers and remediation actions
- template-by-template findings summary
- detailed technical appendix for data requirements, rules, exceptions, controls, and population evidence
- branded PDF export aligned to Dariba client-report styling

Evidence output is historical-run safe and can be reconstructed from saved run snapshots where available.

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

Focused evidence-pack validation tests:

```bash
npm test -- src/lib/evidence/streamlinedEvidenceReport.test.ts src/lib/evidence/evidenceExporter.test.ts
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
- Evidence Pack now separates:
  - client-facing narrative report sections
  - remediation-focused exception summary
  - technical appendix evidence tables
- Workflow navigation has been normalized across dashboard, exceptions, controls, traceability, and evidence screens to support end-to-end review without losing context
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

Latest saved checkpoint:
- Commit: `cc448bf`
- Date: `2026-07-17`
- Branch: `feat/semantic-crosswalk-alignment`
- Scope:
  - Evidence Pack redesigned into a more client-facing narrative structure
  - Evidence Pack wording simplified for end users (`Data Requirements`, `Assessment confidence`, clearer readiness labels)
  - Branded Dariba PDF export styling added, including cover-page treatment and section chrome
  - Evidence preview aligned to executive verdict, methodology, remediation, and template findings sections

Previous major checkpoint:
- Commit: `d89905b`
- Date: `2026-07-16`
- Branch: `feat/semantic-crosswalk-alignment`
- Scope:
  - DRCS workflow and validation updates checkpointed
  - workflow navigation and cross-screen UX hardening
  - template/parser alignment for invoice line allowance/discount compatibility
  - credit-note-related readiness and validation updates carried forward in the active feature branch

Latest platform highlights on the active branch:
- Traceability uses canonical MoF source registry overlay (`specs/uae/mof/source-schema-v1.json`) instead of legacy docs JSON.
- Run Checks supports raw-template execution mode when canonical upload structure is already present.
- `IBT-023` and `IBT-024` are classified as `system_default_allowed` (not generic ASP-derived), with strict PINT-AE validation still enforced.
- Evidence/Traceability labels distinguish:
  - `System Default` fields (no upload column required, controlled default path)
  - `ASP Derived` fields (technical/derived fields not expected from upload templates)
- Workflow navigation has been normalized across dashboard, exceptions, controls, traceability, and evidence screens.
- Controls Dashboard has clearer executive KPI logic and weighting disclosure.
- Evidence Pack is historical-run safe:
  - historical evidence uses persisted run snapshots instead of current in-memory populations
  - historical export is blocked when required snapshot data is unavailable
- Evidence execution counts are runtime-backed across the active validation layers:
  - core runner telemetry
  - PINT/UAE runner telemetry
  - org-profile runner telemetry
- Evidence Pack now supports:
  - client-facing narrative sections
  - remediation-focused exception summaries
  - technical appendix evidence tables
  - branded PDF export styling
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
