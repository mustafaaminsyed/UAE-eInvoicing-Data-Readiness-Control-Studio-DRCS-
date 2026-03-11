# Phase 4 Run-Checks Architectural Debt

Date: 2026-03-11

## Completed in Phase 4

- Org-profile execution is now behind a dedicated runner wrapper.
- Orchestrator no longer calls org-profile rules directly.
- Runtime ordering and persistence semantics are unchanged.

## Remaining Debt (Intentionally Deferred)

1. MoF readiness remains a UI pre-gate layer and is not part of orchestrator `RunArtifact`.
2. `runChecksService` remains a separate legacy orchestration path and is not unified with runner contracts.
3. Orchestrator still performs cross-layer merge/enrich logic directly (not yet separated into a composer module).

## Why Deferred

- Phase 4 targeted the smallest safe diff with strict parity constraints.
- Moving MoF readiness into orchestration or unifying `runChecksService` would increase behavior-change risk.
- Current scope prioritizes contract extraction over execution/persistence redesign.

## Phase 5 Governance Update (No Behavior Change)

- `runChecksService` was frozen as a legacy compatibility module.
- Canonical runtime execution path is explicitly: `ComplianceContext.runChecks -> runChecksOrchestrator`.
- No runtime logic, ordering, persistence semantics, findings normalization, UI flow, or pre-gate behavior changed.

## Removal Preconditions for `runChecksService`

Future removal requires explicit review of legacy semantics currently retained in the service:

1. `ALL` scope planner behavior (`AR` + `AP` execution plan semantics).
2. `persist_failed` result contract.
3. `runLog` structure and step-level logging semantics.
4. Internal persistence orchestration behavior and payload shape.
