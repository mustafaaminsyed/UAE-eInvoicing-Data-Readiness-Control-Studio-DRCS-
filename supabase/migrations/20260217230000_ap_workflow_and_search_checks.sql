-- AP workflow + search checks (additive, backward compatible)

-- 1) Add dataset type to check runs
ALTER TABLE public.check_runs
ADD COLUMN IF NOT EXISTS dataset_type TEXT DEFAULT 'AR';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_runs_dataset_type_check'
  ) THEN
    ALTER TABLE public.check_runs
    ADD CONSTRAINT check_runs_dataset_type_check
    CHECK (dataset_type IN ('AR', 'AP', 'ALL'));
  END IF;
END $$;

-- 2) Add dataset type to exceptions
ALTER TABLE public.check_exceptions
ADD COLUMN IF NOT EXISTS dataset_type TEXT;

UPDATE public.check_exceptions
SET dataset_type = 'AR'
WHERE dataset_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_exceptions_dataset_type_check'
  ) THEN
    ALTER TABLE public.check_exceptions
    ADD CONSTRAINT check_exceptions_dataset_type_check
    CHECK (dataset_type IN ('AR', 'AP'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_check_exceptions_dataset_type
ON public.check_exceptions(dataset_type);

-- 3) Extend custom checks with check_type and search rule types
ALTER TABLE public.custom_checks
ADD COLUMN IF NOT EXISTS check_type TEXT DEFAULT 'VALIDATION';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_checks_check_type_check'
  ) THEN
    ALTER TABLE public.custom_checks
    DROP CONSTRAINT custom_checks_check_type_check;
  END IF;

  ALTER TABLE public.custom_checks
  ADD CONSTRAINT custom_checks_check_type_check
  CHECK (check_type IN ('VALIDATION', 'SEARCH_CHECK'));
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_checks_rule_type_check'
  ) THEN
    ALTER TABLE public.custom_checks
    DROP CONSTRAINT custom_checks_rule_type_check;
  END IF;

  ALTER TABLE public.custom_checks
  ADD CONSTRAINT custom_checks_rule_type_check
  CHECK (
    rule_type IN (
      'missing',
      'duplicate',
      'math',
      'regex',
      'custom_formula',
      'fuzzy_duplicate',
      'invoice_number_variant',
      'trn_format_similarity'
    )
  );
END $$;

CREATE INDEX IF NOT EXISTS idx_custom_checks_check_type
ON public.custom_checks(check_type);

-- 4) Investigation flags table (separate from hard exceptions)
CREATE TABLE IF NOT EXISTS public.investigation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.check_runs(id) ON DELETE SET NULL,
  dataset_type TEXT NOT NULL CHECK (dataset_type IN ('AR', 'AP')),
  check_id TEXT NOT NULL,
  check_name TEXT NOT NULL,
  invoice_id TEXT,
  invoice_number TEXT,
  counterparty_name TEXT,
  message TEXT NOT NULL,
  confidence_score NUMERIC(5,2),
  matched_invoice_id TEXT,
  matched_invoice_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigation_flags_dataset_type
ON public.investigation_flags(dataset_type);

CREATE INDEX IF NOT EXISTS idx_investigation_flags_invoice_id
ON public.investigation_flags(invoice_id);

ALTER TABLE public.investigation_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'investigation_flags'
      AND policyname = 'Allow public read on investigation_flags'
  ) THEN
    CREATE POLICY "Allow public read on investigation_flags"
    ON public.investigation_flags
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'investigation_flags'
      AND policyname = 'Allow public insert on investigation_flags'
  ) THEN
    CREATE POLICY "Allow public insert on investigation_flags"
    ON public.investigation_flags
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;
