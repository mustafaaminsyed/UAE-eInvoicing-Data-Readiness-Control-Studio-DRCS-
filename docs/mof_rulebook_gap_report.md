# UAE MoF Rulebook Delta/Gaps Assessment

Date: 2026-03-06  
Scope: Compare `docs/uae_einvoicing_data_schema.json` against current DRCS PINT-AE UC1 implementation

## Executive Summary
- The MoF rulebook is present in the repo but is not yet wired into runtime validation/exceptions.
- Current system remains primarily UC1/PINT-driven (`UAE_UC1_CHECK_PACK` with 34 checks).
- Crosswalk results (`docs/mof_rulebook_crosswalk.json`) show:
  - `aligned`: 29 fields
  - `partial`: 11 fields
  - `derived_only`: 6 fields
  - `semantic_conflict`: 2 fields
  - `gap`: 3 fields

## High-Risk Gaps (Must Address First)
1. Runtime source-of-truth mismatch
- MoF rulebook is not executed by `runChecks` pipeline.
- Impact: system can claim MoF alignment while still enforcing legacy UC1 logic.

2. Identifier semantics conflict
- Field 11 and 15 semantics differ from current implementation:
  - MoF: TIN/TRN conditional logic and strict scheme handling.
  - Current: predominantly TRN-centric checks.
- Impact: false positives/false negatives on legal identifiers.

3. Mandatory cardinality mismatch
- Several MoF 1..1 fields are currently optional in templates/parser (e.g., 6, 9, 19, 28, 34).
- Impact: upload may pass, but MoF-mandated completeness is not guaranteed.

4. Commercial XML extension coverage
- MoF fields 42..51 include commercial XML extensions.
- Current model partially supports this, but line AED fields and some mandatory behavior are incomplete.
- Impact: partial compliance for commercial XML use case.

## Medium-Risk Gaps
1. Exception taxonomy mismatch
- MoF defines `EINV_*` exception code templates.
- Current runtime exceptions are check-id-driven, no standard `exception_code` contract.

2. Controls and traceability linkage
- Controls and rule traceability are derived from existing UC1 check pack metadata.
- Not yet mapped to MoF `rule_id`/`exception_code` model.

3. Audit provenance
- Run artifacts do not persist `rulebook_version` + `rule_source`.

## File-Level Observations
1. MoF rulebook exists but unused at runtime
- `docs/uae_einvoicing_data_schema.json`

2. Current runtime checks are UC1 check pack + switch-case runner
- `src/lib/checks/uaeUC1CheckPack.ts`
- `src/lib/checks/pintAECheckRunner.ts`

3. Uploader/template mandatory behavior is derived from current DR registry, not MoF field numbers
- `public/templates/templates_manifest.json`
- `src/lib/registry/drRegistry.ts`
- `src/lib/csvParser.ts`
- `src/components/upload/FileAnalysis.tsx`

4. Conformance and controls are linked to existing rule trace metadata
- `src/lib/coverage/conformanceEngine.ts`
- `src/lib/rules/ruleTraceability.ts`
- `src/lib/registry/controlsRegistry.ts`

## Controlled Remediation Plan (Recommended)
1. P1: Canonical crosswalk + precedence contract
- Approve `MoF -> DR/IBT -> internal column` mapping.
- Set policy: `UAE MoF overlay > PINT UC1 baseline` for overlaps.

2. P1: Rulebook adapter (shadow mode)
- Add adapter to translate MoF rule types (`presence`, `equals`, `regex`, `conditional_format`, `default_if_missing`) to internal executable checks.
- Run in shadow mode alongside current UC1 checks and compare outputs.

3. P2: Uploader/template alignment
- Update template mandatory flags and parser coverage for MoF-priority fields.
- Add explicit handling for missing/gapped fields (24, 25, 49).

4. P2: Exception and controls alignment
- Normalize MoF `exception_code` into runtime exception model.
- Re-link controls and traceability to MoF rule IDs.

5. P3: Audit/version governance
- Persist `rule_source`, `rulebook_version`, `crosswalk_version` with each run.
- Add release checks that block deployment if rulebook/crosswalk validation fails.

## Suggested Immediate Next Deliverable
- Create `rulebook_adapter` scaffold + validation tests, but keep feature-flagged (`shadow only`) until comparison metrics are approved.
