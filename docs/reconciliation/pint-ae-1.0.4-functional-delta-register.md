# PINT AE 1.0.4 functional delta register

Baseline: PINT AE Billing 1.0.4, PINT AE Self-Billing 1.0.4, UAE TDD 1.0.4,
PINT General 1.1.3, and PDK 1.4.4.

Status statement: the reference baseline is current. Executable control parity remains
outstanding until each item below is remediated and regression-tested. Importing the
official resources does not make DRCS fully PINT AE 1.0.4 compliant.

| External requirement / area | Current DRCS treatment | Status | Future remediation | Source-schema change expected |
|---|---|---|---|---|
| IBR-SR-63 CustomizationID wildcard prohibition | Present in the 1.0.4 reference resources; no equivalent DRCS runtime control verified | Open | Add/verify runtime parity in a controlled rules task | No; system-generated value |
| Commercial buyer identity separation (IBT-047 / IBT-048) | Completed in P1.3: `buyer_legal_reg_id` maps to IBT-047 and `buyer_trn` remains independently mapped to IBT-048; the canonical Buyers / Headers / Lines model is 10 / 36 / 19 | Complete | Preserve distinct legal-registration and VAT/tax identifier semantics | Implemented; Buyer schema expanded conditionally |
| Buyer legal registration identifier type (BTAE-16) | Completed in P1.3: `buyer_legal_reg_id_type` maps to BTAE-16 with current PINT applicability and code-list semantics | Complete | Preserve BTAE-16 as an explicit Buyer-master field without a tax-identifier default | Implemented; optional at ingestion and conditionally required |
| VAT category taxable amount (IBT-116) | P1.4 foundation derives repeatable invoice-currency breakdowns from IBT-131 grouped by normalized category and applicable significant rate when document adjustments are positively absent; otherwise returns `not_evaluated` | Partial — P1.7 dependency | Add categorized document-level allowances/charges under P1.7; do not treat IBT-116 as taxpayer-source missing | No P1.4 source-schema change; derived |
| VAT category tax amount (IBT-117) | P1.4 foundation derives standard tax from IBT-116 × IBT-119 and applies pinned zero-tax category treatment; IBT-110 reconciliation uses derived breakdowns rather than AED-oriented line VAT | Partial — P1.7 dependency | Complete P1.7 inputs and broader P1.9 executable parity before claiming full coverage | No P1.4 source-schema change; derived |
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

P1.4 uses the normalized grouping key `category|significant-rate`; rate-inapplicable E/O
groups use no invented rate. RC is accepted only as an ingestion alias and is recorded as
normalized to official AE. Line allowance/charge values are not added again because they
are already included in IBT-131. Monetary results round half away from zero at the group
result to two decimals. The pinned standard-rate formula permits scoped `0.02` slack; P1.4
does not change unrelated global tolerances. Derived evidence records contributing line IDs,
currency, normalization, formula, rounding, rule/version, and dependency state.

This register does not claim full PINT-AE 1.0.4 executable parity and does not alter the 10/36/19 taxpayer
ingestion contract, validation applicability, Credit Note behavior, reverse-charge
behavior, or TDD processing.
