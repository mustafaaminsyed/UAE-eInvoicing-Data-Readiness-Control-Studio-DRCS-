# MoF Mandatory Gate Rollout Checklist (Simple)

This checklist helps you switch from "observe only" to controlled enforcement safely.

## Step 1: Observe only (no blocking)

Goal: collect real-world results without disrupting users.

Set environment flags:

```env
VITE_USE_MOF_RULEBOOK=true
VITE_RULEBOOK_SHADOW_MODE=true
VITE_MOF_MANDATORY_GATE_ENABLED=false
VITE_MOF_MANDATORY_GATE_FIELDS=
```

What to do:
- Run checks as usual.
- Review `MoF Shadow Diagnostics` page daily.
- Export CSV/JSON from that page and track top `EINV_*` codes.

Success criteria:
- Shadow findings are understandable and stable.
- No critical unexplained spikes in exception codes.

## Step 2: Small enforcement in non-production

Goal: enforce a tiny mandatory subset first.

Set environment flags:

```env
VITE_USE_MOF_RULEBOOK=true
VITE_RULEBOOK_SHADOW_MODE=true
VITE_MOF_MANDATORY_GATE_ENABLED=true
VITE_MOF_MANDATORY_GATE_FIELDS=1,2,3,4,5
```

What this means:
- Only selected mandatory fields are hard-gated.
- Missing values for those fields become `MOF-GATE-MANDATORY` exceptions.

What to do:
- Run checks on representative datasets.
- Compare `MOF-GATE-MANDATORY` output with business expectation.

Success criteria:
- False positives are low and understood.
- Teams can remediate issues without workflow disruption.

## Step 3: Gradual expansion

Goal: increase enforcement safely over time.

How:
- Add more field numbers in small batches (for example 3-5 at a time).
- Re-test after each batch.
- Keep shadow mode on for visibility.

Example:

```env
VITE_MOF_MANDATORY_GATE_FIELDS=1,2,3,4,5,6,9,19
```

Stop/rollback condition:
- If unexpected failures increase sharply, reduce the field list to previous stable set.

## Quick operational checks

- Run Checks page should show:
  - `Mandatory gate: Enabled`
  - `Gate fields: ...` (not empty)
- Run summary metadata includes:
  - `results_summary.rulebookMandatoryGate.enabled`
  - `results_summary.rulebookMandatoryGate.configuredFieldNumbers`
  - `results_summary.rulebookMandatoryGate.gateExceptions`

