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
- docs/ai/REPO_MAP.md = task routing for minimum-context repository inspection

## Efficient repository workflow
- Start with `docs/ai/REPO_MAP.md` and the file named by the task.
- Inspect only the relevant entry file, its direct imports, and its colocated tests. Expand outward only when evidence requires it.
- Do not inventory or search the whole repository by default. Scope `rg`, `rg --files`, and directory listings to the domain paths in the repository map.
- Reuse existing types, registries, services, and tests. Do not load generated files, PDFs, lockfiles, build output, or unrelated migrations unless the task specifically requires them.
- Make the smallest targeted change that satisfies the request. Avoid opportunistic cleanup, broad formatting, and unrelated refactors.
- Run the nearest focused test first. Broaden to related domain tests, then lint/build/full tests only when risk, shared-code impact, or the request justifies it.
- Summarize findings instead of pasting long files or command output.

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

## Regulatory and data safeguards
- Preserve the UAE/PINT-AE and MoF source artifacts, semantic crosswalks, obligation registries, mandatory-field rules, applicability logic, validation-to-DR mappings, and evidence lineage unless the task explicitly authorizes a regulatory change.
- Never weaken, bypass, or silently reclassify a mandatory requirement, conformance gate, traceability link, control, or evidence requirement to make a test pass.
- Treat `specs/uae/**` as regulatory source material and `supabase/migrations/**` as append-only database history. Do not edit either without explicit scope and corresponding verification.
- Keep target-state regulatory meaning separate from current runtime coverage and implementation status.
- Preserve AR/AP direction, document/scenario applicability, governed versus diagnostic execution, and historical-run evidence boundaries.
- Select verification from the actual behavior, dependencies, and contracts changed—not merely the folder or screen name.
- Mapping UI or presentation-only changes require focused UI verification and relevant component tests; they do not automatically require regulatory, coverage, traceability, or evidence tests.
- Changes to mapping semantics, transformations, field applicability, canonical mappings, or coverage require the affected mapping, regulatory, coverage, traceability, and evidence tests.
- PINT-AE validation or regulatory-rule changes require focused tests for each changed rule or registry plus all affected coverage, traceability, and evidence behavior; add broader regression testing when shared execution paths or cross-domain contracts are affected. Existing test requirements remain mandatory.

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
4. run colocated or directly related tests first
5. broaden verification only for shared or high-risk impact
6. stop after completing the scoped task
