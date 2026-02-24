-- AI validation explanations cache + audit trail

CREATE TABLE IF NOT EXISTS public.validation_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  exception_key TEXT NOT NULL,
  check_exception_id UUID REFERENCES public.check_exceptions(id) ON DELETE SET NULL,
  validation_run_id UUID REFERENCES public.check_runs(id) ON DELETE SET NULL,
  invoice_id TEXT,
  rule_code TEXT,
  check_id TEXT,
  check_name TEXT,
  dataset_type TEXT,
  direction TEXT,
  explanation TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('Low', 'Medium', 'High', 'Critical')),
  recommended_fix TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  model TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  source_context JSONB,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error_message TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_validation_explanations_tenant_key
ON public.validation_explanations(tenant_id, exception_key);

CREATE INDEX IF NOT EXISTS idx_validation_explanations_run
ON public.validation_explanations(validation_run_id);

CREATE INDEX IF NOT EXISTS idx_validation_explanations_invoice
ON public.validation_explanations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_validation_explanations_status
ON public.validation_explanations(status);

CREATE OR REPLACE FUNCTION public.update_validation_explanations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_validation_explanations_updated_at
ON public.validation_explanations;

CREATE TRIGGER update_validation_explanations_updated_at
BEFORE UPDATE ON public.validation_explanations
FOR EACH ROW
EXECUTE FUNCTION public.update_validation_explanations_updated_at();

ALTER TABLE public.validation_explanations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validation_explanations'
      AND policyname = 'Allow public read on validation_explanations'
  ) THEN
    CREATE POLICY "Allow public read on validation_explanations"
    ON public.validation_explanations
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validation_explanations'
      AND policyname = 'Allow public insert on validation_explanations'
  ) THEN
    CREATE POLICY "Allow public insert on validation_explanations"
    ON public.validation_explanations
    FOR INSERT
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validation_explanations'
      AND policyname = 'Allow public update on validation_explanations'
  ) THEN
    CREATE POLICY "Allow public update on validation_explanations"
    ON public.validation_explanations
    FOR UPDATE
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validation_explanations'
      AND policyname = 'Allow public delete on validation_explanations'
  ) THEN
    CREATE POLICY "Allow public delete on validation_explanations"
    ON public.validation_explanations
    FOR DELETE
    USING (true);
  END IF;
END $$;
