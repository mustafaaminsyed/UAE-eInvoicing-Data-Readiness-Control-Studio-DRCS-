# Field Mapping Assistant Dataset Routing

## Purpose
This note explains how the DRCS Field Mapping Assistant decides which canonical fields are available for mapping after a user uploads a source file.

The key point is:

1. The assistant first determines the uploaded file's dataset category.
2. It then limits the mapping target list to the canonical fields valid for that category.
3. It only suggests mappings inside that category-specific field set.

This prevents buyer master-data files from being mapped to line-item fields, or line-item files from being treated like invoice-header files.

## Dataset categories
The mapping wizard works with four dataset types:

- `parties`: buyer or supplier master data
- `header`: invoice-header data, one row per invoice
- `lines`: invoice-line data, one row per line item
- `combined`: one source file containing both header and line fields

The upload step either:

- uses the dataset type explicitly selected by the user, or
- auto-detects the likely dataset type from the uploaded column names

Source references:

- [src/components/mapping/UploadStep.tsx](C:/Users/musta/New%20folder/src/components/mapping/UploadStep.tsx)
- [src/lib/mapping/datasetFieldCatalog.ts](C:/Users/musta/New%20folder/src/lib/mapping/datasetFieldCatalog.ts)

## Step 1: Dataset type determination
When a file is uploaded, DRCS reads the column names and scores them against known parser columns for:

- buyers
- headers
- lines

If both header and line signatures are strong enough, the file is treated as `combined`.
Otherwise, the best matching category is selected.

Examples:

- A file containing `buyer_name`, `buyer_trn`, `buyer_country` will score as `parties`
- A file containing `invoice_number`, `issue_date`, `currency`, `total_incl_vat` will score as `header`
- A file containing `line_number`, `description`, `quantity`, `unit_price`, `vat_rate` will score as `lines`
- A flat transaction extract containing both invoice and line columns will score as `combined`

## Step 2: Canonical target-field restriction
Once the dataset type is known, DRCS retrieves the allowed canonical target fields for that dataset only.

That means:

- `parties` exposes buyer or counterparty-related canonical fields
- `header` exposes invoice-header, seller, totals, and related header-level fields
- `lines` exposes line-level fields
- `combined` exposes both header and line targets

This routing is controlled by the dataset field catalog and the parser-known column sets.

In simple terms:

- master data file -> party fields
- header file -> invoice-level fields
- line file -> line-level fields
- combined file -> both header and line fields

## Step 3: Mapping suggestion logic
After the allowed field set is narrowed by dataset category, the assistant generates suggestions using three main signals:

1. Exact canonical match
2. Known ERP naming patterns
3. Similarity and sample-data-type checks

### 1. Exact canonical match
If the source column already matches the canonical field name, it receives the strongest match.

Example:

- source column `invoice_number`
- canonical field `invoice_number`

This is treated as an exact canonical match.

### 2. Known ERP naming patterns
The assistant also recognises common ERP aliases.

Example patterns for invoice number include:

- `invoice_number`
- `invoice_no`
- `inv_no`
- `invoice_id`
- `doc_no`
- `document_number`

These aliases are mapped to the canonical field `invoice_number`, but only when that field is valid for the active dataset type.

### 3. Similarity and sample-data-type checks
If no direct pattern match is found, the assistant compares the source column against:

- canonical field name
- canonical field ID

It then boosts confidence where the sample values also match the expected data type, such as:

- date
- number
- string

## Example: Where does invoice number belong?
`invoice_number` is a header canonical field in DRCS and maps to PINT-AE business term `IBT-001`.

Source references:

- [src/types/fieldMapping.ts](C:/Users/musta/New%20folder/src/types/fieldMapping.ts)
- [src/lib/registry/drRegistry.ts](C:/Users/musta/New%20folder/src/lib/registry/drRegistry.ts)

### Correct routing
`invoice_number` should be covered in:

- `header` uploads
- `combined` uploads

### Not the primary target in other datasets
`invoice_number` is not expected in:

- `parties` uploads

For `lines` uploads, the important record-linkage field is normally the internal join key such as `invoice_id`, not the header business term `invoice_number`.

So if a user uploads:

- buyer master file: invoice number should not be mapped there
- header file: invoice number should be mapped there
- line file: invoice number is not the intended primary target field
- combined file: invoice number may be mapped there because header fields are present

## Practical examples by file type

### 1. Party/master data file
Expected examples:

- `buyer_name`
- `buyer_trn`
- `buyer_address`
- `buyer_country`

The assistant should suggest buyer or counterparty targets, not invoice totals or line VAT fields.

### 2. Header file
Expected examples:

- `invoice_number`
- `issue_date`
- `invoice_type`
- `currency`
- `total_excl_vat`
- `vat_total`
- `total_incl_vat`

The assistant should suggest invoice-level and totals-related targets.

### 3. Line file
Expected examples:

- `line_number`
- `description`
- `quantity`
- `unit_price`
- `line_total_excl_vat`
- `vat_rate`
- `vat_amount`

The assistant should suggest line-level targets.

### 4. Combined file
Expected examples:

- `invoice_number`
- `issue_date`
- `currency`
- `line_number`
- `description`
- `quantity`
- `unit_price`

The assistant should allow both header and line mappings.

## Design rule for developers
Developers should treat dataset routing as the first control boundary of the mapping wizard.

The assistant must not:

- offer all canonical fields for every file
- suggest party fields from a line extract
- suggest line fields from a buyer master extract
- use naming similarity alone without respecting the active dataset type

The intended logic is:

`uploaded file -> dataset type -> allowed canonical field pool -> suggested mappings`

## Summary
The Field Mapping Assistant determines appropriate mappings by:

1. classifying the uploaded file into a dataset type
2. limiting the mapping pool to fields valid for that dataset
3. generating suggestions using naming rules, similarity, and sample-value data types

For the invoice-number example, the correct answer is:

- `invoice_number` belongs to the invoice-header dataset
- it may also be mapped in a combined export
- it should not be sourced from a party/master-data file

