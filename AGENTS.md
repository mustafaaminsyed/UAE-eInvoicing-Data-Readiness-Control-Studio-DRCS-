# AGENTS.md

## Project
This repository is DRCS: UAE e-Invoicing Data Readiness Control Studio.
It is a compliance and explainability platform for assessing e-invoicing data readiness, mapping source data to UAE/PINT-AE structures, running validation checks, managing exceptions, and producing audit/evidence outputs.

## Product priorities
1. Explainability over visual noise
2. Traceability over generic dashboards
3. Deterministic validation over clever abstraction
4. Regulator-friendly language and structure
5. Small, safe, incremental changes

## Source of truth
- README.md = high-level architecture and functional overview
- specs/uae/** = schema and regulatory reference artifacts
- supabase/migrations/** = database truth
- src/context/** and src/lib/** = runtime orchestration and domain logic

## UI/UX goals
When building UI:
- prefer workflow-oriented screens over static reports
- prioritize these views:
  1. executive dashboard
  2. datasets/submissions workspace
  3. invoice digital twin / lineage view
  4. validation explorer
  5. exceptions workflow
  6. evidence pack
- prefer drill-down and contextual side panels
- avoid adding large tables unless necessary
- keep components reusable and modular

## Constraints
- Do not refactor unrelated files
- Do not scan the entire repo unless explicitly asked
- Prefer reading only referenced files and their direct imports
- Keep output concise
- Before editing, summarize impacted files in 5 bullets or fewer
- After editing, return:
  - files changed
  - what changed
  - how to verify
  - risks / follow-ups

## Design style
- modern enterprise SaaS
- clean spacing
- card-based layout
- minimal color dependence
- status chips for readiness / pass / fail / pending
- right-side detail drawers where useful

## Build behavior
When asked to implement a feature:
1. inspect the minimum relevant files
2. propose a short implementation plan
3. implement only the scoped change
4. verify with existing tests or lightweight checks
5. stop after completing the scoped task