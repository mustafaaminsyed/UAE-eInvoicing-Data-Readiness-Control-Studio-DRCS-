# MoF vs Current Runtime Reconciliation Report (2026-03-07)

## Scope and guardrails
- Artifact-only analysis.
- No runtime behavior changes.
- MoF source-truth authority used: `specs/uae/mof/source-schema-v1.json`.
- Current runtime comparison targets:
  - `src/lib/registry/specRegistry.ts` (loads `specs/uae/pint-ae/2025-q2.json`)
  - `src/lib/registry/drRegistry.ts` (DR to dataset/column bridge)
  - `src/lib/checks/uaeUC1CheckPack.ts` (technical checks)

## Executive summary
- Current production runtime remains PINT-centric and stable.
- MoF baseline and PINT technical layer are not yet fully separated in runtime decisions.
- The repo now has a parallel MoF foundation (`mofSpecRegistry` + `mofCoverageEngine`), but no cutover has been made.

## Source snapshot
- MoF schema:
  - Name: `UAE_eInvoice_MoF_Source_Schema_v1`
  - Version: `1.0.0`
  - Counts:
    - `tax_invoice`: 51 mandatory fields (1-51)
    - `commercial_xml`: 49 mandatory fields (1-49)
- PINT runtime registry:
  - Spec ID: `PINT-AE-2025-Q2`
  - Version: `2.0`
  - Field count: 50

## Dependency map (current runtime)
1. PINT registry authority:
   - `specRegistry.ts` -> `2025-q2.json`
2. DR bridge and ingestibility:
   - `drRegistry.ts` -> `DR_TO_COLUMN_MAP` + `PARSER_KNOWN_COLUMNS`
3. Coverage/gating:
   - `coverageAnalyzer.ts`, `conformanceEngine.ts`
4. Check execution:
   - `RunChecksPage.tsx` + `ComplianceContext.tsx` + `pintAEApi.ts` + `uaeUC1CheckPack.ts`
5. Exceptions/controls:
   - Exceptions and control pages consume existing run outputs and traceability matrix.

## Reconciliation findings

### 1) Authority mismatch
- MoF baseline authority is document-type specific (`tax_invoice`, `commercial_xml`).
- Runtime mandatory logic still derives from the single PINT registry and DR mapping bridge.

### 2) Document model mismatch
- MoF requires explicit divergence handling:
  - shared core: fields 1-41
  - tail differences:
    - tax invoice: 42-51
    - commercial XML: 42-49
- Current runtime is not yet document-type aware for baseline gating.

### 3) AR/AP vs document_type
- Current app correctly models direction (`AR`/`AP`) as dataset flow.
- MoF baseline requires independent `document_type` (`tax_invoice`/`commercial_xml`).
- These dimensions are currently not fully separated in gating logic.

### 4) Mapping and ingestibility constraints
- Existing bridge has coverage for many canonical fields but not all MoF mandatory fields as direct input columns.
- Known no-direct-bridge or pending-bridge patterns (as currently modeled in parallel MoF coverage):
  - core/tail examples requiring policy decision or derived treatment:
    - 12, 16, 25, 45, 49
- This does not imply runtime failure now; it implies MoF baseline enforcement needs explicit bridge policy.

### 5) Check-pack alignment
- UC1 check pack references many PINT terms (34 checks), including key monetary, party, and tax validations.
- MoF baseline asks first: “must field exist by document type”.
- PINT layer asks second: “does value/structure/behavior satisfy technical rules”.
- These two layers are currently combined operationally; they should be rendered as separate pass/fail dimensions.

### 6) Field 7 and 8 policy status
- Commercial fields 7 and 8 in MoF schema intentionally remain:
  - mandatory
  - literal unresolved (`source_literal_with_pending_literal_confirmation`)
- No hardcoded predefined literal should be introduced until confirmed by authoritative technical source.

## Impact assessment on key screens
- Run Checks:
  - Today: PINT runtime gate/check path.
  - Needed: optional pre-gate for MoF mandatory baseline by document type (feature flagged).
- Exceptions:
  - Today: reflects technical check outcomes.
  - Needed: tag exception provenance (MoF baseline vs PINT technical) when dual-layer is enabled.
- Controls/Traceability:
  - Today: PINT DR-centric matrix plus overlay.
  - Needed: explicit dual-layer traceability with MoF baseline status and reconciliation delta.

## Safe staged plan (no hard cutover)
1. Keep current PINT runtime unchanged.
2. Add MoF baseline evaluation in parallel (already scaffolded in codebase).
3. Generate reconciliation output as telemetry/artifact first.
4. Introduce feature flag for MoF baseline pre-gate (default off).
5. Add read-only diagnostics pane only after telemetry stability and policy sign-off.

## Non-goals in this artifact
- No Supabase schema changes.
- No check-runner rewrite.
- No replacement of `specs/uae/pint-ae/2025-q2.json`.
- No UI behavior changes.

## Recommended next implementation task
- Add an artifact generator service that outputs MoF-vs-runtime reconciliation JSON/Markdown from:
  - `mofSpecRegistry`
  - `mofCoverageEngine`
  - existing `drRegistry` and `uaeUC1CheckPack` references
- Keep it non-blocking and non-runtime-critical.

