# Crosswalk Excel Formula Guide

This guide assumes:

- your current crosswalk tab is `DCS Crosswalk - MoF DRs v2`
- the helper lookup file `crosswalk_input_coverage_lookup.tsv` is imported into a new Excel sheet named `CoverageLookup`
- your existing sheet columns `A:R` stay unchanged
- your new columns will start at `S`

## 1. Import the helper file

Open:

`C:\Users\musta\New folder\docs\review\crosswalk_input_coverage_lookup.tsv`

in Excel, or import it as a tab-delimited file, then rename that sheet to:

`CoverageLookup`

The helper sheet columns are:

- `A` = Excel Row
- `B` = DCS Canonical Field Name
- `C` = PINT-AE Business Term ID
- `D` = Primary Input Dataset
- `E` = Secondary Input Dataset
- `F` = Input Column(s)
- `G` = Source Template / File
- `H` = Mapping Type
- `I` = Transformation / Derivation Logic
- `J` = Coverage Status
- `K` = Ingestible in Current 3-Table Model
- `L` = Validation Rule ID(s)
- `M` = Validation Rule Name(s)
- `N` = Runtime Ownership
- `O` = Evidence / Traceability Notes
- `P` = Gap / Action Required
- `Q` = Implementation Priority

## 2. Add the new headers in your main crosswalk tab

Add these headers in row `1`:

- `S1` = `Primary Input Dataset`
- `T1` = `Secondary Input Dataset`
- `U1` = `Input Column(s)`
- `V1` = `Source Template / File`
- `W1` = `Mapping Type`
- `X1` = `Transformation / Derivation Logic`
- `Y1` = `Coverage Status`
- `Z1` = `Ingestible in Current 3-Table Model`
- `AA1` = `Validation Rule ID(s)`
- `AB1` = `Validation Rule Name(s)`
- `AC1` = `Runtime Ownership`
- `AD1` = `Evidence / Traceability Notes`
- `AE1` = `Gap / Action Required`
- `AF1` = `Implementation Priority`

## 3. Recommended lookup formula approach

Use `DCS Canonical Field Name` in column `I` as the lookup key.

This is more robust than looking up by row number for most of your current workbook.

### Formulas for row 2

Put these formulas in row `2`, then fill down through row `52`.

`S2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$D:$D,"")
```

`T2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$E:$E,"")
```

`U2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$F:$F,"")
```

`V2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$G:$G,"")
```

`W2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$H:$H,"")
```

`X2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$I:$I,"")
```

`Y2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$J:$J,"")
```

`Z2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$K:$K,"")
```

`AA2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$L:$L,"")
```

`AB2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$M:$M,"")
```

`AC2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$N:$N,"")
```

`AD2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$O:$O,"")
```

`AE2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$P:$P,"")
```

`AF2`
```excel
=XLOOKUP($I2,CoverageLookup!$B:$B,CoverageLookup!$Q:$Q,"")
```

## 4. Fallback formula for any rows that do not match cleanly by canonical field

If a row does not resolve properly because the canonical field text changed, use the row-number lookup instead.

Example for `S2`:

```excel
=XLOOKUP(ROW(),CoverageLookup!$A:$A,CoverageLookup!$D:$D,"")
```

You can apply the same pattern to the other columns by changing the return range.

## 5. Rows to review manually after import

These rows are intentionally flagged as needing careful review:

- row `16` `seller_tax_identifier`
- row `17` `seller_tax_scheme_code`
- row `25` `buyer_tax_id OR buyer_legal_reg_id`
- row `26` `buyer_tax_scheme_code OR buyer_legal_reg_id_type`
- row `36` to `39` tax breakdown rows
- row `45` `item_gross_price`
- row `46` `item_price_base_quantity`
- row `49` `vat_line_amount_aed`
- row `50` `invoice_line_amount_aed`
- row `51` and `52` item name versus description numbering

These are the rows where the workbook semantics and the current runtime registry are not perfectly one-to-one.
