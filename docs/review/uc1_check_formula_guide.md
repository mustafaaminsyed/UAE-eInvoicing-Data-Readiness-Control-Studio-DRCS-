# UC1 Check View Guide

Open:

`C:\Users\musta\New folder\docs\review\uc1_check_to_dr_view.tsv`

in Excel as a tab-delimited file.

## What the file contains

One row per UC1 check from the runtime check pack, with:

- check ID
- check name
- check type
- severity
- scope
- use case
- linked DR IDs
- mapping type per DR
- validated fields per DR
- PINT reference terms
- description
- pass and fail conditions
- MoF rule reference
- owner team
- suggested fix
- evidence required

## Best Excel filters to use

Filter by:

- `Check Type`
- `Linked DR IDs`
- `Scope`
- `Severity`
- `MoF Rule Reference`

## Useful review views

- All checks linked to one DR:
  Filter `Linked DR IDs` by a DR such as `IBT-048`

- All dependency or conditional checks:
  Filter `Check Type` to `Dependency`

- All codelist checks:
  Filter `Check Type` to `CodeList`

- All checks without explicit DR linkage:
  Filter `Linked DR IDs` to blanks

## Notes

The file is generated from:

- `src/lib/checks/uaeUC1CheckPack.ts`
- `src/lib/registry/validationToDRMap.ts`

So it reflects the current runtime source, not a hand-maintained manual summary.
