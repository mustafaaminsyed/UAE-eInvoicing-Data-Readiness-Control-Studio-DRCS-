# Overlay Staging Readiness

Date: 2026-03-17

## Checklist Outcome

- Default behavior remains `legacy` when `VITE_OVERLAY_APPLICABILITY_MODE` is unset.
- Non-prod enablement is isolated to the overlay family runtime checks:
  - `IBR-137-AE`
  - `IBR-138-AE`
  - `IBR-152-AE`
- Focused regression under `VITE_OVERLAY_APPLICABILITY_MODE=scenario_context` passed.
- Only the approved runtime-difference rows are expected to change:
  - `fixture-tax-disclosed-agent-summary:IBR-137-AE`
  - `exception-disclosed-agent-credit-note:IBR-137-AE`
  - `fixture-tax-disclosed-agent-summary:IBR-138-AE`
  - `fixture-credit-note-summary-flag:IBR-138-AE`
  - `exception-out-of-scope-summary-conflict:IBR-138-AE`
- No collateral impact outside the overlay family was detected.
- Rollback to `legacy` was executed and verified by rerunning the same focused suite.

## Commands Run

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

## Enablement Note

- Flag: `VITE_OVERLAY_APPLICABILITY_MODE=scenario_context`
- Approved changed rows:
  - `fixture-tax-disclosed-agent-summary:IBR-137-AE`
  - `exception-disclosed-agent-credit-note:IBR-137-AE`
  - `fixture-tax-disclosed-agent-summary:IBR-138-AE`
  - `fixture-credit-note-summary-flag:IBR-138-AE`
  - `exception-out-of-scope-summary-conflict:IBR-138-AE`
- Expected outcome:
  - Overlay applicability follows governed `ScenarioContext` flags for disclosed-agent, summary-invoice, and export overlays.
  - No non-overlay runtime behavior changes.
  - No blocked dependencies remain for these overlay rules.
- Rollback:
  - Set `VITE_OVERLAY_APPLICABILITY_MODE=legacy`
  - Redeploy the non-prod environment
  - Rerun the focused suite above to confirm reversion
