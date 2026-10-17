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

1. Phase 1B: complete. Read-only traceability, coverage, check-registry and run-check surfaces use canonical IDs while retaining legacy lookup and historical aggregation.
2. Phase 1C: complete. Product labels now separate MoF source supply, runtime control implementation, and terms not evaluated by DCS. Missing rules are not presented as proof of universal applicability.
3. Phase 2A: complete. A typed, read-only regulatory obligation registry records responsibility, applicability, acquisition, implementation state, evidence and source/rule links for BTAE-07, BTAE-03, IBT-025, IBT-026, IBT-031/032, IBT-113 and BTAE-06/IBT-022.
4. Phase 2B: complete. A pure, non-authoritative shadow engine evaluates registered obligations as applicable, not applicable or unresolved, with reason and evidence fields. It does not affect runtime validation or readiness.
5. Phase 2C: complete. Traceability includes a read-only invoice-level obligation review with shadow decisions, responsibility, implementation state, reasons and evidence fields. It remains outside validation and readiness enforcement.
6. Phase 2D: complete. A non-authoritative population-level comparison separates aligned execution, applicable-but-not-evaluated gaps, execution outside shadow scope, unsupported obligations and policy-review uncertainty.

## Guardrails

- Never infer a universal taxpayer source requirement from XML cardinality alone.
- Every obligation must identify applicability, responsibility, acquisition method and implementation state.
- Keep legacy identifiers readable until persisted data migration is explicitly approved.
- Do not present MoF crosswalk coverage as full PINT-AE validation coverage.
