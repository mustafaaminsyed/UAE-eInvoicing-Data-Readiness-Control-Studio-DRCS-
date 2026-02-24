-- Create the update function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Custom checks table for Check Builder
CREATE TABLE public.custom_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  dataset_scope TEXT NOT NULL CHECK (dataset_scope IN ('header', 'lines', 'buyers', 'cross-file')),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('missing', 'duplicate', 'math', 'regex', 'custom_formula')),
  parameters JSONB NOT NULL DEFAULT '{}',
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Run history table for tracking check runs
CREATE TABLE public.check_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_invoices INTEGER NOT NULL DEFAULT 0,
  total_exceptions INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  pass_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  results_summary JSONB
);

-- Entity scores table for seller/buyer readiness scores
CREATE TABLE public.entity_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.check_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('seller', 'buyer', 'invoice')),
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  score DECIMAL(5,2) NOT NULL DEFAULT 100,
  total_exceptions INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX idx_entity_scores_run_id ON public.entity_scores(run_id);
CREATE INDEX idx_entity_scores_entity_type ON public.entity_scores(entity_type);
CREATE INDEX idx_custom_checks_active ON public.custom_checks(is_active);

-- Enable RLS but allow public access (no auth required for this app)
ALTER TABLE public.custom_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_scores ENABLE ROW LEVEL SECURITY;

-- Public access policies (this is a data tool, not user-specific)
CREATE POLICY "Allow public read access on custom_checks" ON public.custom_checks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on custom_checks" ON public.custom_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on custom_checks" ON public.custom_checks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on custom_checks" ON public.custom_checks FOR DELETE USING (true);

CREATE POLICY "Allow public read access on check_runs" ON public.check_runs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on check_runs" ON public.check_runs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on entity_scores" ON public.entity_scores FOR SELECT USING (true);
CREATE POLICY "Allow public insert on entity_scores" ON public.entity_scores FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_custom_checks_updated_at
  BEFORE UPDATE ON public.custom_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();