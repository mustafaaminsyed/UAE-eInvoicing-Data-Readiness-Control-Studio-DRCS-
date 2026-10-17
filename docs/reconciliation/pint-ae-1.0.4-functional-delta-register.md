# PINT AE 1.0.4 functional delta register

Baseline: PINT AE Billing 1.0.4, PINT AE Self-Billing 1.0.4, UAE TDD 1.0.4,
PINT General 1.1.3, and PDK 1.4.4.

Status statement: the reference baseline is current. Executable control parity remains
outstanding until each item below is remediated and regression-tested. Importing the
official resources does not make DRCS fully PINT AE 1.0.4 compliant.

| External requirement / area | Current DRCS treatment | Status | Future remediation | Source-schema change expected |
|---|---|---|---|---|
| IBR-SR-63 CustomizationID wildcard prohibition | Completed in P1.9: CHK-010 rejects `*` in both billing and self-billing CustomizationID values after resolving the governed system default | Complete | Preserve wildcard rejection alongside allowed-prefix validation | No; system-generated value |
| Commercial buyer identity separation (IBT-047 / IBT-048) | Completed in P1.3: `buyer_legal_reg_id` maps to IBT-047 and `buyer_trn` remains independently mapped to IBT-048; the canonical Buyers / Headers / Lines model is 10 / 36 / 19 | Complete | Preserve distinct legal-registration and VAT/tax identifier semantics | Implemented; Buyer schema expanded conditionally |
| Buyer legal registration identifier type (BTAE-16) | Completed in P1.3: `buyer_legal_reg_id_type` maps to BTAE-16 with current PINT applicability and code-list semantics | Complete | Preserve BTAE-16 as an explicit Buyer-master field without a tax-identifier default | Implemented; optional at ingestion and conditionally required |
| VAT category taxable amount (IBT-116) | Completed in P1.7: repeatable invoice-currency breakdowns derive from IBT-131 plus reconciled, categorized document allowances and charges supplied through the optional governed adjustments CSV; incomplete or mismatched allocation remains explicitly `not_evaluated` | Complete | Preserve derived-field lineage and deterministic reconciliation; do not treat IBT-116 as taxpayer-source missing | Implemented; optional repeatable adjustments dataset plus derived output |
| VAT category tax amount (IBT-117) | Completed in P1.8: derives category tax from the adjusted IBT-116 basis under the current category/rate policy; IBT-110 reconciliation uses derived breakdowns rather than AED-oriented line VAT | Complete | Preserve deterministic category treatment, rounding, and reconciliation evidence | Implemented; derived |
| IBT-119 / IBT-152 current category-rate rules | Completed in P1.8: one shared policy enforces S=5, Z/AE=0, omitted E/O line and breakdown rates, adjustment-specific E=0/O omission, positive N line rates, and the prohibition of N document adjustments | Complete | Preserve shared line/adjustment/breakdown policy and multi-category regressions | IBT-152 is conditional at ingestion; IBT-119 is derived per breakdown |
| Item pricing (IBT-146/147/148/149) | P1.5 separates sourced net price and optional price discount, derives gross price deterministically, and preserves governed base quantity | Complete | Preserve price discount versus line allowance separation and derived-field evidence | Implemented with one optional `item_price_discount` line field |
| Invoice note and frequency (IBT-022 / BTAE-06) | Conditional OTH note dependency is not modeled | Open | Implement conditional rule and source responsibility assessment | To be assessed; conditional |
| Paid amount (IBT-113) | Not represented in canonical ingestion | Open | Assess conditional payment-state input and IBT-115 equation | Likely conditional |
| Invoice UUID (BTAE-07) | Responsibility is classified as ASP-generated in the term-governance registry; it is not a taxpayer source-data requirement | Responsibility resolved; output implementation remains open | Preserve the ASP hand-off obligation and add output evidence when the document-generation boundary is implemented | No taxpayer ingestion field |
| Credit Note metadata | Current reason/reference behavior differs from current specification details | Open | Reconcile BTAE-03 and preceding-invoice conditions | No change unless source prerequisite is confirmed |
| Line/document allowances and charges | Amount support exists but complete conditional groups are not modeled | Open | Define conditional reason/base/percentage prerequisites | Likely conditional |
| Reverse-charge current rules | Existing behavior has not completed full 1.0.4 rule regression | Open | Reconcile IBR-166 and aligned IBRP-AE rules | No expected canonical expansion without assessment |
| Dashboard false readiness dependencies | Some UI readiness requirements overstate source obligations | Open | Remove false dependencies in a dedicated UI/readiness task | No |
| BTUAE/BTAE terminology | Canonical BTAE aliases and compatibility normalization are implemented; legacy IDs remain in existing persisted/runtime records pending consumer migration | In progress | Migrate consumers incrementally to `canonical_dr_id`, preserving legacy lookup aliases | No |

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
