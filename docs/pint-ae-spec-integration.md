# PINT-AE Spec Integration (UAE)

This project now supports importing official PINT-AE resources (schematron + codelists) and linking them to runtime validation.

## What was integrated

- Added generator script: `scripts/import-pint-ae-resources.mjs`
- Added generated spec artifacts:
  - `src/lib/pintAE/generated/metadata.ts`
  - `src/lib/pintAE/generated/codelists.ts`
  - `src/lib/pintAE/generated/schematronRules.ts`
- Added runtime catalog helper:
  - `src/lib/pintAE/specCatalog.ts`
- Wired `UAE-UC1-CHK-006` to official `ISO4217` codelist in:
  - `src/lib/checks/pintAECheckRunner.ts`
  - `src/lib/checks/uaeUC1CheckPack.ts`

## How to refresh from a new PINT-AE ZIP

1. Extract the ZIP under `tmp/pint-ae-resources-dev` (or pass your own path).
2. Run:

```bash
npm run generate:pint-spec -- "tmp/pint-ae-resources-dev"
```

3. Re-run checks:

```bash
npm run lint
npm run test
npm run build
```

## How this maps to your current app

- Your app validates customer source e-invoicing data after CSV upload and mapping.
- The imported PINT-AE resources are now a canonical source for:
  - Codelist validity (already active for currency check).
  - Rule metadata from schematron asserts (`id`, `context`, `message`, reference terms).
- This enables converting hardcoded checks into spec-driven checks incrementally.

## Recommended next implementation steps

1. Add codelist-backed checks for:
   - Invoice type (`UNCL1001-inv`)
   - Country code (`ISO3166`)
   - UAE subdivision code (`AUH`, `DXB`, `SHJ`, `UAQ`, `FUJ`, `AJM`, `RAK`)
2. Add a small "Spec Coverage" view:
   - total imported schematron rules vs currently executable checks
3. Add a server-side XML validation path (UBL XML + schematron XSLT) for end-to-end conformance checking.

