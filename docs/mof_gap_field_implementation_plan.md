# MoF Gap Field Implementation Plan

Date: 2026-03-06

Purpose: close known MoF crosswalk gaps in controlled phases.

## Gap backlog (current)

| MoF Field | Name | Current Status | Proposed Action | Effort | Risk |
|---|---|---|---|---|---|
| 24 | Buyer legal registration identifier | Gap | Add column to templates, parser, model, non-blocking validation | Low | Low |
| 25 | Buyer legal registration identifier type | Gap | Add column to templates, parser, model, codelist check (phase 2) | Low-Med | Low |
| 49 | Invoice line amount in AED | Gap | Add AED line amount column + FX conversion consistency checks | Medium | Medium |
| 44 | Item gross price | Partial | Add dedicated gross price column and consistency checks vs net/base qty | Medium | Medium |
| 48 | VAT line amount in AED | Partial | Add explicit AED field and FX validation (if currency != AED) | Medium | Medium |

## Implementation phases

### Phase A (now): low-risk data model enablement
- Add fields 24/25 to buyer data model.
- Accept fields in CSV parser (AR/AP aliases).
- Add to sample and downloadable templates.
- Keep checks non-blocking until usage is stabilized.

### Phase B: rule coverage
- Add format/codelist checks for field 25 (`TL`, `EID`, `PAS`, `CD`).
- Add presence checks behind MoF mandatory gate configuration.

### Phase C: monetary AED fields
- Add field 49 input support and mapping.
- Add validation against line totals and FX conversion.
- Add reconciliation checks for field 48 AED semantics.

## Completed in this run
- Phase A for MoF 24/25 is implemented.
- Included in parser + templates + sample data.
- Phase C (partial) for MoF 49 is implemented:
  - `line_amount_aed` added to parser/model/templates/sample data.
  - Shadow FX consistency validation added via runtime overlay rule.
- Phase C extension for MoF 44/48 is implemented:
  - `item_gross_price` and `line_vat_amount_aed` added to parser/model/templates/sample data.
  - Shadow checks added:
    - `UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY`
    - `UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY`
  - Mapping coverage card expanded to include 44/48.
  - Rulebook adapter now maps:
    - field 44 -> `item_gross_price`
    - field 48 -> `line_vat_amount_aed`

## Recommended next coding step
- Run focused UAT scenarios for new fields 44/48:
  - gross/net/discount consistency for field 44
  - VAT AED FX consistency for field 48
- Tune tolerance/edge-case handling based on UAT findings (credit notes, zero quantity, rounding policy).
