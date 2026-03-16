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

## Verification

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

## Rollback

If non-prod behavior deviates from the approved set:

```powershell
VITE_OVERLAY_APPLICABILITY_MODE=legacy
```

Redeploy and rerun the focused overlay suite. This reverts overlay applicability to the legacy path without changing rule IDs, exception schemas, UI behavior, traceability rendering, or exception-analysis behavior.
