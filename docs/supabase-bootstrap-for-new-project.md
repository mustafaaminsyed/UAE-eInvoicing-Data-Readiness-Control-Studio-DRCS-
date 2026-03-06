# Supabase bootstrap for a new DRCS project

Use this when Vercel is connected to a newly created Supabase project and `/run` shows:
- `Could not find the table 'public.pint_ae_checks'`
- `mapping_templates probe failed`

## Why this happens

Vercel env variables point to a valid Supabase project, but the database schema has not been initialized yet (migrations not applied).

## Prerequisites

- Vercel env vars are set with real values:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- You have access to Supabase project with ref: `swoosryscytcuaettkwc`

## Option A (recommended): apply migrations via CLI

1. Login and link project:

```bash
npx supabase login
npx supabase link --project-ref swoosryscytcuaettkwc
```

2. Apply all repo migrations:

```bash
npx supabase db push
```

3. Redeploy Vercel `main` so app re-checks against initialized schema.

## Option B: SQL Editor fallback

If CLI is unavailable, run migration SQL files in chronological order from:

- `supabase/migrations/20260116200326_0928e299-1749-4ea5-9929-19a9217eb2eb.sql`
- `supabase/migrations/20260116201419_72e79cd2-3070-472e-b96c-738ed59097f6.sql`
- `supabase/migrations/20260119203442_1ba9645b-82f4-4bf6-aa64-1ea7b96715b6.sql`
- `supabase/migrations/20260120204805_9ab7d047-eb0d-4c10-9b1c-d8c5dfa22e5c.sql`
- `supabase/migrations/20260217230000_ap_workflow_and_search_checks.sql`
- `supabase/migrations/20260224183000_validation_explanations.sql`

Then redeploy Vercel.

## Post-bootstrap verification

1. In app `/run`, click `Test Connection`.
2. Expect probes for `pint_ae_checks` and `mapping_templates` to pass.
3. Click `Seed UC1 Check Pack` once.
4. Go to Mapping page, create/save an active template.
5. Return to `/run` and execute checks.

## Important note on repo linkage

Current repo `supabase/config.toml` may reference an older project ID.
Always run `npx supabase link --project-ref <new-ref>` before `db push` when using a new Supabase project.
