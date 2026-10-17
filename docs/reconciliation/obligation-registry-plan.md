# DCS obligation registry delivery plan

This file is the compact hand-off ledger for the scenario-aware PINT-AE readiness build.

## Current increment

Phase 1A: canonical PINT term identity and responsibility classification.

Delivered:

- Canonical BTAE normalization for legacy `BTUAE-02`, `BTUAE-08`, and `BTUAE-15`.
- Reverse alias lookup so persisted legacy identifiers remain compatible.
- Normalized responsibility categories: taxpayer source, DCS derived, fixed configuration, ASP generated, unresolved.
- BTAE-07 UUID classified as ASP-generated and not a taxpayer source requirement.
- DR registry exposes canonical identity, legacy aliases, and normalized responsibility without replacing its existing `dr_id` contract.

Non-goals for this increment:

- No validation applicability changes.
- No new mandatory upload fields.
- No persisted identifier migration.
- No readiness UI changes.

## Validation

- Focused registry, alias, mapping and traceability tests.
- ESLint.
- Production build.

## Next increments

1. Phase 1B: migrate read-only traceability and coverage consumers to canonical IDs while retaining legacy lookup.
2. Phase 1C: separate MoF source coverage, runtime control coverage, and unsupported-applicable coverage labels.
3. Phase 2A: introduce the typed regulatory obligation registry, seeded with BTAE-07, BTAE-03, IBT-025, IBT-026, IBT-031/032, IBT-113 and BTAE-06/IBT-022.
4. Phase 2B: add a pure scenario applicability/scope engine.

## Guardrails

- Never infer a universal taxpayer source requirement from XML cardinality alone.
- Every obligation must identify applicability, responsibility, acquisition method and implementation state.
- Keep legacy identifiers readable until persisted data migration is explicitly approved.
- Do not present MoF crosswalk coverage as full PINT-AE validation coverage.
