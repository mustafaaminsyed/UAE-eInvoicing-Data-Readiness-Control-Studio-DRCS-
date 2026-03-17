# Overlay Cutover Runbook

Date: 2026-03-17

## Scope

Feature flag:

```text
VITE_OVERLAY_APPLICABILITY_MODE
```

Default runtime behavior must remain:

```text
legacy
```

Overlay runtime scope is limited to:
- `IBR-137-AE`
- `IBR-138-AE`
- `IBR-152-AE`

Only these five rows are approved to differ under `scenario_context`:
- `fixture-tax-disclosed-agent-summary:IBR-137-AE`
- `exception-disclosed-agent-credit-note:IBR-137-AE`
- `fixture-tax-disclosed-agent-summary:IBR-138-AE`
- `fixture-credit-note-summary-flag:IBR-138-AE`
- `exception-out-of-scope-summary-conflict:IBR-138-AE`

## 1. PR Step

1. Open the PR using the finalized overlay cutover PR description.
2. Confirm the PR states:
   - default remains `legacy`
   - scope is limited to the three approved overlay rules
   - only the five approved runtime-difference rows may differ
   - rollback is immediate via `VITE_OVERLAY_APPLICABILITY_MODE=legacy`

## 2. Review Step

1. Obtain reviewer approval on:
   - exact rule scope
   - approved runtime-difference rows
   - non-prod-only enablement plan
   - rollback procedure
2. Do not proceed to non-prod enablement until the approved difference set is explicitly accepted.

## 3. Non-Prod Enablement

1. Set the non-prod environment variable:

```text
VITE_OVERLAY_APPLICABILITY_MODE=scenario_context
```

2. Deploy the non-prod environment.
3. Do not enable the flag in production as part of this runbook.

## 4. Validation

Run the focused overlay validation suite in non-prod context:

```powershell
$env:VITE_OVERLAY_APPLICABILITY_MODE='scenario_context'
npm.cmd test -- src/lib/checks/overlayRuntimeEnablement.test.ts src/modules/scenarioContext/overlayRuntimeCutover.test.ts src/modules/scenarioContext/overlayAuthoritativeCutoverPacket.test.ts
```

Acceptance gate:
- no runtime deltas outside the approved five rows

Validation checklist:
- confirm only these three rules are in scope:
  - `IBR-137-AE`
  - `IBR-138-AE`
  - `IBR-152-AE`
- confirm only the five approved rows differ
- confirm no collateral impact outside the overlay family
- confirm default behavior still remains `legacy` when the flag is unset

## 5. Rollback Procedure

If any runtime delta appears outside the approved five rows:

1. Set the flag back to:

```text
VITE_OVERLAY_APPLICABILITY_MODE=legacy
```

2. Redeploy the non-prod environment.
3. Rerun the focused overlay validation suite.
4. Confirm overlay applicability has returned to the legacy baseline.

## Notes

- This runbook does not widen cutover beyond `IBR-137-AE`, `IBR-138-AE`, and `IBR-152-AE`.
- This runbook does not introduce broader `transaction_flag` cutover.
- This runbook does not introduce `credit_note_specialized` cutover.
- This runbook does not change UI behavior, traceability rendering, or exception-analysis behavior.
