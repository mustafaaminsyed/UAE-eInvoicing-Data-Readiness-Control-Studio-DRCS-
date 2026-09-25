# Readiness hardening: baseline and first implementation stage

## Baseline

- Source commit: `78dee06e1a405252cb789b6c7af36312f7bc43f9`.
- Starting branch: `feat/mof-source-truth-registry-layer`.
- Working branch: `fix/readiness-validation-foundation`.
- Existing test baseline: 54 tests in 18 files passed.
- Existing AR/AP synthetic fixtures remain in `src/lib/sampleData.ts`.
- Before fixes, the new ingestion/counting regression suite reproduced 13 failures out of 14 tests.
- Existing untracked development-server logs were left alone.

## Stage 1 behavior

- CSV scanning supports quoted multiline fields, escaped quotes, BOM and CRLF.
- Invalid quoting, duplicate/empty headers and unequal row widths reject the complete file. No partial dataset is published.
- Empty physical lines are ignored; source row numbers retain physical coordinates.
- Raw CSV cell strings are preserved by `parseCSV`; numeric conversion accepts finite decimal strings only. Optional empty numbers remain absent; required UC1 line numbers/amounts reject missing input instead of substituting zero.
- Numeric errors identify the field and original row. This stage reports the first error; an all-errors import report is deferred.
- Record outcome counts are separate from the number of exception findings.
- Upload analysis must succeed before loading. Replacing a file clears old analysis, and obsolete asynchronous reads cannot restore cleared selections.
- The selected AR/AP direction reaches analysis, parsers, and downloadable samples. Changing direction clears staged files to prevent reuse of incompatible analysis.

## Verification

- Full suite: 72 tests across 20 files passed; the final identifier-normalization refinement then passed all 16 parser tests (including one additional regression).
- ESLint and the production Vite build passed. Build warnings concern existing chunk size and outdated Browserslist data.
- Standalone TypeScript checking still reports two errors in the unchanged `src/lib/api/validationExplainApi.ts`, at lines 287 (readonly code-list cast) and 569 (`MappingContext` assignment). These are not reported as passing.
- Git whitespace checks passed.

## Scope limits

This stage does not change tax formulas, mandatory-field applicability, database policies, official specification artifacts, or historical evidence. The current UC1 numeric contract remains in force; broader document scenarios require the planned applicability model.

No production database, customer dataset or ASP connection was inspected or changed. No claim of PINT-AE certification is made.

## Remaining stages and acceptance criteria

### Stage 2: execution safeguards

- Execution callers request strict ruleset loading. Missing configuration without explicit local fallback, database/transport failures and empty enabled rulesets reject the run.
- Diagnostic reads retain the existing empty-result behavior so setup screens can continue displaying configuration guidance.
- The PINT runner validates enabled rules before execution: unsupported types, duplicate IDs, altered built-in type/scope, missing required parameters, malformed regex, unknown generic codelists and invalid tolerances stop execution.
- Failed execution clears the previous assessment and always releases the running state. The Run Checks page displays the failure and stays on the page instead of navigating to the dashboard.
- Tests verify that failed execution does not save results through either the context or service path. Explicit local fallback and the full existing UC1 pack remain supported.
- Verification: full suite passed 92 tests; the subsequently expanded execution/API regression suite passed all 22 tests. ESLint, production build and whitespace checks passed. Existing standalone TypeScript errors from stage 1 remain outside this change.
- This is a fail-closed execution boundary, not yet a complete per-record outcome ledger. Per-rule applicability, skipped/unevaluated outcomes, persistence-failure presentation, and immutable evidence remain pending.

### Stage 3: recorded execution outcomes and evidence

- PINT execution now aggregates actual record outcomes: pass, fail, not applicable, not evaluated and error. Empty populations and absent comparison inputs do not become passes. Classification describes current executor behavior, not a complete regulatory applicability model.
- Seller rules count header records even when registry display scope is Party; buyer rules count buyer records. Multiple findings on one record count as one failed record, with findings reported separately.
- Each recorded rule carries copied configuration, dataset direction, timestamp and engine version. Both run paths include the ledger in the existing `check_runs.results_summary` JSON; no schema migration is required. Context results remain available when persistence returns no run ID, with an assessment-local identifier.
- Evidence and traceability rates use recorded pass/fail counts. Registry rules without execution records remain unavailable, with no inferred executions or 100% pass rate.
- Excel and PDF expose outcome status and skipped/error counts. The ZIP includes `07_execution_ledger.json` with the recorded rule configurations and assessment identity.
- Full evidence export is limited to the matching current assessment. The former archived-exceptions/current-dataset combination was removed; historical full exports require saved dataset snapshots, which are not yet implemented.
- Upload replacement, clearing data and direction switches invalidate the snapshot. In-flight validation cannot publish an assessment after the dataset changes.
- Existing tax formulas and exception output are preserved; negative AR/AP fixture parity is tested. Calculation corrections, legacy rule consolidation, full applicability, durable error-run storage, dataset hashing and immutable historical snapshots remain outstanding.
- Final verification: 118 tests across 27 files passed, ESLint and the production build passed, and whitespace checks passed. Standalone TypeScript checking reports only the two previously recorded explanation-API errors.

### Stage 4a: line monetary calculations

- Both the PINT and legacy line-net checks share decimal arithmetic following [IBR-147-AE](https://docs.peppol.eu/poac/ae/pint-ae/trn-invoice/rule/ibr-147-ae/), consulted 2026-09-26: quantity × (net price / price base quantity) + line charges − line allowances, comparing rounded cents with XPath tie handling. One-cent differences now fail; a stored legacy tolerance does not relax this rule.
- CSV accepts `price_base_quantity`. Omission defaults to one for compatibility with existing tabular inputs; this is an ingestion convention, not proof that an emitted XML document contains required data. Explicit zero/negative quantities fail the line calculation.
- `line_discount` remains a legacy alias for a total line allowance. Use `line_allowance_amount` for new uploads. Matching aliases count once; conflicting values fail. `unit_price` is already the net item price, so item price discounts must not be supplied again as line allowances.
- Nonfinite comparison inputs remain unevaluated in the PINT ledger; invalid base quantities and conflicting aliases produce failures. New assessments record `uc1-execution-v2`.
- Added ten regression cases, including CSV import and parity between execution paths. Full suite: 128 tests across 28 files passed; lint and production build passed.
- This completes the line-calculation slice only. Invoice-level allowances/charges, category VAT breakdowns and payable reconciliation remain next. Parsed amounts still use JavaScript number storage before decimal calculation; arbitrary-precision source preservation and official XML validation remain outstanding.

### Stage 4b: invoice monetary reconciliation

- Invoice net now deducts document allowances and adds document charges using decimal arithmetic. Provided detailed adjustments must agree with declared aggregates; line adjustments are not counted twice.
- CSV header ingestion supports paid amounts plus validated JSON arrays for category breakdowns, document allowances and document charges. See [the input contract and examples](monetary-inputs.md).
- CHK-028 now evaluates invoice category bases and tax amounts, counting headers rather than lines. It checks category coverage and duplicate categories, applies standard-category 0.02 slack, and requires zero supplier tax for supported zero-tax categories. Unsupported categories and missing allocation remain unevaluated. The legacy VAT check uses the same category evaluator.
- CHK-029 reconciles VAT total to independently supplied category amounts, never the sum of rounded line VAT. A flat single-category header can support CHK-028, but cannot independently establish CHK-029 and is recorded as unevaluated for that check.
- CHK-025 and the legacy gross-total check share decimal reconciliation. New local-pack CHK-035 implements amount due, paid amounts and payable rounding using IBR-CO-16 comparison semantics. Engine provenance is `uc1-execution-v3`.
- The local pack now contains 35 checks. Database-backed installs need the existing non-force seed/repair to add CHK-035; no remote database action was performed. Existing saved assessments are not retroactively changed.
- Regression suite: 157 tests across 29 files passed, including 29 new invoice-calculation/input cases. Lint, production build and whitespace checks passed. After the final registry cleanup, all 31 targeted monetary/registry tests passed. Standalone TypeScript checking reports only the two pre-existing explanation-API errors; build retains its existing chunk-size and Browserslist warnings.
- Remaining limits: source numbers are still parsed into JavaScript numbers before decimal operations; complete tax-category/rate legality, foreign-currency totals, immutable input snapshots and official XML/Schematron validation remain outside this arithmetic stage. Legacy aggregate check results do not have the PINT ledger's unevaluated status.

### Remaining work

1. Database isolation: inventory the deployed policies and tenant ownership, create staging migrations, test anonymous/cross-tenant access and authorized administration, then backfill before policy cutover.
2. Execution outcomes: distinguish pass/fail/not-applicable/not-evaluated/error, reject unsupported rules and unavailable rulesets, and consolidate overlapping legacy checks.
3. Calculations: decimal arithmetic, price base quantity, allowances/charges, VAT breakdowns, foreign currency and payable reconciliation with official fixtures.
4. Applicability: separate AR/AP, document type and billing/self-billing; represent party VAT status and conditional requirements.
5. Official validation: pin release and hashes, run UBL/Schematron alongside current checks, explain disagreements before cutover.
6. Coverage/evidence: use actual execution records and immutable input/mapping/ruleset provenance; preserve historical versions.
7. Pilot: representative anonymized datasets, explicit rollout gates and tested rollback.

Rollback of stage 1 is an application-source rollback to the baseline; no database migration is involved. Keep original uploaded files for reprocessing.
