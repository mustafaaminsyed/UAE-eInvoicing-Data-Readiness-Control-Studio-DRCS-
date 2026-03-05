# MoF UAT Script (Team Walkthrough)

Date: 2026-03-06  
Scope: UAE MoF overlay validation for fields 24, 25, 44, 48, 49 with controlled gate

## 1) Objective

Validate that:
- New MoF fields are mappable and ingestible.
- Shadow diagnostics show expected `EINV_*` findings.
- Mandatory gate behaves correctly for selected field list.
- Field 49 FX checks detect real mismatches and avoid false alerts.

## 2) UAT Environment Setup

Use non-production environment with these variables:

```env
VITE_USE_MOF_RULEBOOK=true
VITE_RULEBOOK_SHADOW_MODE=true
VITE_MOF_MANDATORY_GATE_ENABLED=true
VITE_MOF_MANDATORY_GATE_FIELDS=1,2,3,4,5,24,25,44,48,49
```

## 3) Pre-Run Checklist

- [ ] Deploy latest code to UAT.
- [ ] Confirm env vars above are active.
- [ ] Open `/mapping` and verify "MoF Overlay Mapping Coverage" card is visible.
- [ ] Open `/rulebook-shadow` and verify page loads without errors.
- [ ] Confirm template files contain:
  - `buyer_legal_reg_id`
  - `buyer_legal_reg_id_type`
  - `item_gross_price`
  - `line_vat_amount_aed`
  - `line_amount_aed`

## 4) Test Scenarios

### Scenario A: Baseline Pass (expected clean run)

Input:
- Use updated positive sample templates.
- Keep field 25 values valid (`TL/EID/PAS/CD`).
- Keep `line_amount_aed` consistent with line total and FX.

Expected:
- Mapping coverage card: all MoF overlay fields mapped.
- Run checks: no `MOF-GATE-MANDATORY` for 24/25/49.
- Shadow diagnostics:
  - no Field 49 mismatch rows,
  - low/no `EINV_FIELD_VALUE_INVALID` from new overlay rules.

Pass criteria:
- No unexpected blocking errors.

---

### Scenario B: Missing field 24 (buyer legal reg id)

Input:
- Remove `buyer_legal_reg_id` value for one buyer row.

Expected:
- With gate enabled and field 24 in list: run produces `MOF-GATE-MANDATORY`.
- Shadow diagnostics show missing mandatory signal tied to relevant invoice(s).

Pass criteria:
- Missing value is blocked/detected consistently.

---

### Scenario C: Invalid field 25 codelist

Input:
- Set `buyer_legal_reg_id_type=ABC` for one buyer row.

Expected:
- Shadow diagnostics include `UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST`.
- Exception code should be `EINV_FIELD_VALUE_INVALID`.
- If gate includes field 25, corresponding gate impact should appear in run results.

Pass criteria:
- Invalid code is detected and visible in diagnostics.

---

### Scenario D: Field 49 mismatch (AED)

Input:
- For one line, set `line_amount_aed` different from expected value.
- Example: `line_total_excl_vat=2000`, currency `AED`, but `line_amount_aed=1990`.

Expected:
- Shadow diagnostics "Field 49 FX Mismatch Spotlight" count > 0.
- Rule shown: `UAE_FIELD_49_AED_AMOUNT_CONSISTENCY`.
- Message includes expected vs observed mismatch.

Pass criteria:
- Mismatch is detected exactly on modified line.

---

### Scenario E: Non-AED with missing FX rate

Input:
- Set invoice currency to non-AED (e.g. `USD`), clear `fx_rate`, keep `line_amount_aed`.

Expected:
- Shadow diagnostics show field 49 consistency issue for missing/invalid FX rate.

Pass criteria:
- System surfaces actionable message, not a silent pass.

## 5) Evidence to Capture

For each scenario, attach:
- Screenshot of Mapping Analysis (MoF overlay coverage card).
- Screenshot of Run Checks shadow status card.
- Screenshot of Rulebook Shadow page:
  - exception summary,
  - field 49 spotlight section,
  - sample findings.
- Exported files:
  - `mof_shadow_exception_summary.csv`
  - `mof_shadow_impacted_controls.csv`
  - `mof_shadow_findings_sample.csv`
  - `mof_shadow_diagnostics.json`

## 6) Defect Logging Template

For each failed expectation, record:
- Scenario ID:
- Dataset file and row reference:
- Expected behavior:
- Actual behavior:
- Exception/rule ID:
- Severity:
- Screenshot link:

## 7) UAT Sign-Off Criteria

- [ ] All baseline pass checks are clean.
- [ ] Scenarios B, C, D, E are detected as expected.
- [ ] No high-severity false positives on clean data.
- [ ] Team confirms remediation guidance is clear.
- [ ] Product owner approves moving to phased production rollout.

## 8) Rollout Decision

If UAT passes:
- keep shadow mode enabled,
- start with narrow gate field list in production,
- expand list in small batches after monitoring.
