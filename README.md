# UAE eInvoicing Data Readiness Control Studio (DRCS)

Enterprise frontend for UAE e-invoicing data readiness, validation, exception triage, and evidence reporting.

## Tech Stack

- Vite
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase

## Local Setup

```bash
git clone https://github.com/mustafaaminsyed/UAE-eInvoicing-Data-Readiness-Control-Studio-DRCS-.git
cd UAE-eInvoicing-Data-Readiness-Control-Studio-DRCS-
npm install
npm run dev
```

Default local URL: `http://127.0.0.1:5173`

## Scripts

- `npm run dev` - start local dev server
- `npm test` - run test suite (Vitest)
- `npx tsc --noEmit` - typecheck
- `npm run lint` - ESLint
- `npm run build` - production build

## Workspace Navigation

The app now uses a shared workspace shell with left sidebar navigation (desktop) across all primary routes.

Sidebar labels and routes:

- `Dashboard` -> `/dashboard`
- `Ingestion` -> `/upload`
- `Schema Mapping` -> `/mapping`
- `Validation` -> `/run`
- `Exceptions` -> `/exceptions`
- `Cases` -> `/cases`
- `Evidence` -> `/evidence-pack`
- `Check Registry` -> `/check-registry`
- `Settings` -> `/settings` (alias to controls page)

Compatibility note:

- Existing top navigation remains available.
- Existing route paths and page behavior are preserved.

## Dashboard UX Enhancements

`/dashboard` now includes:

- Compact control bar with dataset selector (`AR`/`AP`), PINT-AE badge, and system status
- Pipeline progress: `Ingest -> Map -> Validate -> Control`
- Validation results preview panel (top failed checks)
- Mapping confidence by category: `Header`, `Supplier`, `Buyer`, `Tax`, `Lines`
- Grouped quick actions: `Data`, `Compliance`, `Governance`
- Activity log (last 10 actions) from upload audit + recent check runs
- Standardized card styling with `rounded-xl`, `shadow-lg`, neutral borders, and consistent spacing

## Branding and Theme

- Dariba-aligned green-first brand palette in design tokens
- Reduced visual transparency/noise for stronger panel separation
- Global dark mode via `next-themes` (`storageKey: drcs.theme`)
- Dark mode toggles are available in:
  - top navigation (all non-landing routes)
  - landing page hero (root route `/`)

## Exception Explanation Pack

Exceptions now support deterministic, evidence-based explanation packs with optional assist mode.

- Trigger from `/exceptions` using the `Explain` action
- Supports modes:
  - `heuristic_only` (deterministic, evidence-based)
  - `assist` (optional wording enhancement via edge function, with schema validation)
- Backward compatible with flat `explanation` + `recommendedFix`
- UI renders structured `ExplanationPack` fields:
  - summary
  - why-it-failed bullets
  - ranked likely root causes with probabilities
  - impact
  - actionable fix checklist with deep links

Related files:

- `src/lib/api/validationExplainApi.ts`
- `src/types/validationExplain.ts`
- `src/components/explanations/ExplanationPackPanel.tsx`
- `src/pages/ExceptionsPage.tsx`
- `supabase/functions/validation-explain/index.ts`

## Upload UX and Ingestion Notes

Upload screen improvements:

- File upload progress indicator (`valid/selected`)
- Better CSV guidance and accessibility labels
- Delimiter mismatch warning (ingestion parser expects comma-delimited CSV)
- Improved top nav overflow behavior

AR/AP notes:

- `AR` = Customer Invoices (Outbound)
- `AP` = Vendor Invoices (Inbound)
- Exceptions are dataset-aware and can be filtered by dataset type
- Validation can run per scope (`AR`, `AP`, `ALL`)

## Repo Hygiene

The following local/generated paths are ignored in Git:

- `.vite/`
- `review_free_llm_api_resources_20260224/`
