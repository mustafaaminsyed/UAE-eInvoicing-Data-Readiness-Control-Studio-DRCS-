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

## Non-Prod Enablement Checklist

1. Set `VITE_OVERLAY_APPLICABILITY_MODE=scenario_context`.
2. Deploy the non-prod environment.
3. Confirm only the approved changed rows differ:
  - `fixture-tax-disclosed-agent-summary:IBR-137-AE`
  - `exception-disclosed-agent-credit-note:IBR-137-AE`
  - `fixture-tax-disclosed-agent-summary:IBR-138-AE`
  - `fixture-credit-note-summary-flag:IBR-138-AE`
  - `exception-out-of-scope-summary-conflict:IBR-138-AE`
4. Confirm the expected outcome:
  - Overlay applicability follows governed `ScenarioContext` flags for disclosed-agent, summary-invoice, and export overlays.
  - No non-overlay runtime behavior changes.
  - No blocked dependencies remain for these overlay rules.

## Rollback Checklist

1. Set `VITE_OVERLAY_APPLICABILITY_MODE=legacy`.
2. Redeploy the non-prod environment.
3. Rerun the focused suite above.
4. Confirm overlay applicability has reverted to the legacy path.

## Out Of Scope

- broader `transaction_flag` cutover
- `credit_note_specialized` cutover
- UI behavior changes
- traceability rendering changes
- exception-analysis behavior changes

## Reviewer Risk Note

- default remains `legacy` when the flag is unset
- scope is limited to `IBR-137-AE`, `IBR-138-AE`, and `IBR-152-AE`
- only the five approved runtime-difference rows are expected under `scenario_context`
- no collateral impact outside the overlay family was observed in verification
