# Invoice monetary inputs

The CSV header upload supports `paid_amount`, `rounding_amount`, `document_level_allowance_total`, `document_level_charge_total`, `document_allowances`, `document_charges`, and `tax_breakdowns`.

`document_allowances` and `document_charges` contain JSON arrays. Each entry has a numeric `amount`, a `tax_category_code`, and a numeric `tax_category_rate` (optional for E/O):

```json
[{"amount":20,"tax_category_code":"S","tax_category_rate":5}]
```

`tax_breakdowns` contains independently supplied category totals:

```json
[
  {"tax_category_code":"S","tax_category_rate":5,"taxable_amount":80,"tax_amount":4},
  {"tax_category_code":"Z","tax_category_rate":0,"taxable_amount":50,"tax_amount":0}
]
```

Quote each JSON cell in CSV and double its internal quotes. For example:

```csv
invoice_id,document_allowances
I1,"[{""amount"":20,""tax_category_code"":""S"",""tax_category_rate"":5}]"
```

Amounts inside JSON must be numbers, not quoted numeric strings. Malformed JSON, missing required properties, unexpected properties, null entries and nonfinite amounts reject the upload with a row/column error. Empty arrays remain empty; they do not select the legacy fallback.

Document adjustment totals, if supplied alongside details, must agree with the detailed amounts. Omitted totals can be calculated from details for readiness reconciliation. Aggregate adjustments without category allocation allow net-total reconciliation, but leave category VAT calculation unevaluated. Line net amounts already include line allowances and charges; do not repeat these as document adjustments.

Existing `tax_category_code`, `tax_category_rate`, `total_excl_vat` and `vat_total` header fields remain a single-category input convention. Category calculation checks this convention against all invoice lines. The VAT-total sum check requires `tax_breakdowns`: it will not compare `vat_total` with itself and report a pass. Explicit `tax_breakdowns` takes precedence over the flat convention.

Supported calculation categories are S, Z, E, O and AE. Unsupported categories or missing comparison inputs are recorded as unevaluated. Category/rate legality, exemptions, document-type applicability, foreign-currency tax totals and XML conformance remain separate work; passing these arithmetic checks does not establish full PINT-AE compliance.

The standard-category base and tax checks use the official 0.02 slack. Zero-tax categories require zero supplier VAT. Other invoice monetary reconciliations use decimal arithmetic and rule-specific rounding rather than a configurable generic tolerance. Paid and rounding amounts default to zero when omitted; an absent amount due remains unevaluated.

References consulted 2026-09-26: [PINT-AE calculation model](https://docs.peppol.eu/poac/ae/pint-ae/bis/), [standard category base](https://docs.peppol.eu/poac/ae/pint-ae/trn-invoice/rule/aligned-ibrp-s-08/), [standard category tax](https://docs.peppol.eu/poac/ae/pint-ae/trn-invoice/rule/aligned-ibrp-s-09/), [reverse-charge VAT](https://docs.peppol.eu/poac/ae/pint-ae/trn-invoice/rule/aligned-ibrp-ae-09-ae/), [amount due](https://docs.peppol.eu/poac/ae/pint-ae/trn-invoice/rule/ibr-co-16/).

New assessments identify engine `uc1-execution-v3`. The local pack includes payable check `UAE-UC1-CHK-035`. Database-backed installations need the existing non-force UC1 seed/repair action to insert the missing check while preserving configured rules. This source change does not run that action or alter a remote database. Previously saved assessments must be rerun to use the changed calculations.
