## Summary

This PR completes the overlay-family runtime cutover in a family-isolated, flag-gated path.

Scope is limited to:
- `IBR-137-AE`
- `IBR-138-AE`
- `IBR-152-AE`

Default behavior remains `legacy` via `VITE_OVERLAY_APPLICABILITY_MODE`, with explicit rollback by setting the flag back to `legacy`.

## What Changed

- added isolated authoritative overlay runtime check definitions
- extended `pintAECheckRunner` with overlay-family applicability gating
- kept the main authoritative UI/runtime pack unchanged
- added overlay runtime comparison and cutover verification reporting
- added staging-readiness and env-driven enablement tests
- documented the non-prod enablement checklist and rollback steps

## Why This Is Safe

- default behavior remains `legacy`
- runtime scope is limited to `IBR-137-AE`, `IBR-138-AE`, and `IBR-152-AE`
- no UI behavior changes
- no traceability rendering changes
- no exception-analysis behavior changes
- rollback remains immediate by setting `VITE_OVERLAY_APPLICABILITY_MODE=legacy`

## Exact Rule Scope

This PR affects only:
- `IBR-137-AE`
- `IBR-138-AE`
- `IBR-152-AE`

## Verification Performed

Default legacy validation:

```powershell
npm.cmd test -- src/lib/checks/overlayRuntimeEnablement.test.ts src/lib/checks/pintAECheckRunner.registry.test.ts
```

Staging-mode verification:

```powershell
$env:VITE_OVERLAY_APPLICABILITY_MODE='scenario_context'
npm.cmd test -- src/lib/checks/overlayRuntimeEnablement.test.ts src/modules/scenarioContext/overlayRuntimeCutover.test.ts src/modules/scenarioContext/overlayAuthoritativeCutoverPacket.test.ts
```

Rollback verification:

```powershell
$env:VITE_OVERLAY_APPLICABILITY_MODE='legacy'
npm.cmd test -- src/lib/checks/overlayRuntimeEnablement.test.ts src/modules/scenarioContext/overlayRuntimeCutover.test.ts src/modules/scenarioContext/overlayAuthoritativeCutoverPacket.test.ts
```

Build:

```powershell
npm.cmd run build
```

## Approved Runtime Differences

Only these rows are approved to differ under `scenario_context`:
- `fixture-tax-disclosed-agent-summary:IBR-137-AE`
- `exception-disclosed-agent-credit-note:IBR-137-AE`
- `fixture-tax-disclosed-agent-summary:IBR-138-AE`
- `fixture-credit-note-summary-flag:IBR-138-AE`
- `exception-out-of-scope-summary-conflict:IBR-138-AE`

There are:
- zero potential regressions
- zero blocked dependencies
- zero collateral changes outside the overlay family

## Non-Prod Enablement Checklist

1. Set the non-prod flag:

```text
VITE_OVERLAY_APPLICABILITY_MODE=scenario_context
```

2. Deploy the non-prod environment.
3. Run the focused overlay validation suite.
4. Confirm only the five approved runtime-difference rows above differ.
5. Confirm no non-overlay runtime behavior changes.
6. Confirm no blocked dependencies remain for the three overlay rules.

## Rollback Checklist

1. Set the flag:

```text
VITE_OVERLAY_APPLICABILITY_MODE=legacy
```

2. Redeploy the non-prod environment.
3. Rerun the focused overlay validation suite.
4. Confirm overlay applicability has reverted to the legacy path.
5. Confirm no unexpected non-prod differences remain.

## Out Of Scope

This PR does not:
- widen cutover beyond `IBR-137-AE`, `IBR-138-AE`, and `IBR-152-AE`
- introduce broader `transaction_flag` cutover
- introduce `credit_note_specialized` cutover
- change UI behavior
- change traceability rendering
- change exception-analysis behavior

## Reviewer Risk Note

- default remains `legacy` when the flag is unset
- scope is restricted to the three approved overlay rules
- only the five approved runtime-difference rows are expected under `scenario_context`
- no collateral impact outside the overlay family was observed in verification
