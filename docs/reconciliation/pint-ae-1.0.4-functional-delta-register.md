# PINT AE 1.0.4 functional delta register

Baseline: PINT AE Billing 1.0.4, PINT AE Self-Billing 1.0.4, UAE TDD 1.0.4,
PINT General 1.1.3, and PDK 1.4.4.

Status statement: the reference baseline is current. Executable control parity remains
outstanding until each item below is remediated and regression-tested. Importing the
official resources does not make DRCS fully PINT AE 1.0.4 compliant.

| External requirement / area | Current DRCS treatment | Status | Future remediation | Source-schema change expected |
|---|---|---|---|---|
| IBR-SR-63 CustomizationID wildcard prohibition | Present in the 1.0.4 reference resources; no equivalent DRCS runtime control verified | Open | Add/verify runtime parity in a controlled rules task | No; system-generated value |
| Commercial buyer legal identifier (IBT-047) | `buyer_trn` is the only canonical buyer identifier | Open | Separate tax and legal identifier semantics | Likely yes, conditional |
| Buyer legal registration identifier type (BTAE-16) | Current buyer type coverage is incomplete/inconsistent | Open | Model permitted TL/EID/PAS/CD semantics | Likely yes, conditional |
| VAT category taxable amount (IBT-116) | No verified category-level aggregation | Open | Add deterministic per-category derivation and validation | No; derived |
| VAT category tax amount (IBT-117) | No verified category-level aggregation | Open | Add deterministic per-category derivation and validation | No; derived |
| IBT-119 / IBT-152 current category-rate rules | Basic rates are represented; current multi-category and category-specific regressions are incomplete | Open | Add current-rule regression coverage | No |
| Item gross price (IBT-148) | Net and gross price semantics are not independently represented | Open | Reconcile IBT-146/147/148 pricing model | To be assessed; conditional source possible |
| Invoice note and frequency (IBT-022 / BTAE-06) | Conditional OTH note dependency is not modeled | Open | Implement conditional rule and source responsibility assessment | To be assessed; conditional |
| Paid amount (IBT-113) | Not represented in canonical ingestion | Open | Assess conditional payment-state input and IBT-115 equation | Likely conditional |
| Invoice UUID (BTAE-07) | Responsibility is not conclusively assigned | Regulatory verification required | Confirm taxpayer/ASP/network responsibility before implementation | Unknown; do not add yet |
| Credit Note metadata | Current reason/reference behavior differs from current specification details | Open | Reconcile BTAE-03 and preceding-invoice conditions | No change unless source prerequisite is confirmed |
| Line/document allowances and charges | Amount support exists but complete conditional groups are not modeled | Open | Define conditional reason/base/percentage prerequisites | Likely conditional |
| Reverse-charge current rules | Existing behavior has not completed full 1.0.4 rule regression | Open | Reconcile IBR-166 and aligned IBRP-AE rules | No expected canonical expansion without assessment |
| Dashboard false readiness dependencies | Some UI readiness requirements overstate source obligations | Open | Remove false dependencies in a dedicated UI/readiness task | No |
| BTUAE/BTAE terminology | Legacy BTUAE identifiers remain in mappings and UI | Open | Controlled terminology/compatibility migration | No |

This register is intentionally non-executable and does not alter the 8/36/19 taxpayer
ingestion contract, validation applicability, Credit Note behavior, reverse-charge
behavior, or TDD processing.
