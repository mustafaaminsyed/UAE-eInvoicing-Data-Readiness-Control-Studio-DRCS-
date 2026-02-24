-- Enhanced PINT-AE Check Model
-- Drop and recreate pint_ae_checks table with full PINT-AE aligned structure
CREATE TABLE IF NOT EXISTS public.pint_ae_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_id TEXT NOT NULL UNIQUE,
  check_name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('Header', 'Lines', 'Party', 'Cross')),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('Presence', 'Format', 'CodeList', 'Math', 'Dependency', 'CrossCheck')),
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  use_case TEXT,
  pint_reference_terms TEXT[] DEFAULT '{}',
  mof_rule_reference TEXT,
  pass_condition TEXT,
  fail_condition TEXT,
  owner_team_default TEXT DEFAULT 'ASP Ops' CHECK (owner_team_default IN ('ASP Ops', 'Client Finance', 'Client IT', 'Buyer-side')),
  suggested_fix TEXT,
  evidence_required TEXT,
  is_enabled BOOLEAN DEFAULT true,
  parameters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pint_ae_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read on pint_ae_checks" ON public.pint_ae_checks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on pint_ae_checks" ON public.pint_ae_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on pint_ae_checks" ON public.pint_ae_checks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on pint_ae_checks" ON public.pint_ae_checks FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pint_ae_checks_updated_at
  BEFORE UPDATE ON public.pint_ae_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enhanced Exceptions Output Table
CREATE TABLE IF NOT EXISTS public.check_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.check_runs(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_id TEXT NOT NULL,
  check_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  scope TEXT,
  rule_type TEXT,
  use_case TEXT,
  pint_reference_terms TEXT[] DEFAULT '{}',
  invoice_id TEXT,
  invoice_number TEXT,
  seller_trn TEXT,
  buyer_id TEXT,
  line_id TEXT,
  field_name TEXT,
  observed_value TEXT,
  expected_value_or_rule TEXT,
  message TEXT NOT NULL,
  suggested_fix TEXT,
  root_cause_category TEXT DEFAULT 'Unclassified',
  owner_team TEXT DEFAULT 'ASP Ops',
  sla_target_hours INTEGER DEFAULT 24,
  case_status TEXT DEFAULT 'Open' CHECK (case_status IN ('Open', 'In Progress', 'Waiting on Client', 'Resolved', 'Closed')),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.check_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read on check_exceptions" ON public.check_exceptions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on check_exceptions" ON public.check_exceptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on check_exceptions" ON public.check_exceptions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on check_exceptions" ON public.check_exceptions FOR DELETE USING (true);

-- Indexes for performance
CREATE INDEX idx_check_exceptions_run_id ON public.check_exceptions(run_id);
CREATE INDEX idx_check_exceptions_check_id ON public.check_exceptions(check_id);
CREATE INDEX idx_check_exceptions_seller_trn ON public.check_exceptions(seller_trn);
CREATE INDEX idx_check_exceptions_severity ON public.check_exceptions(severity);
CREATE INDEX idx_check_exceptions_case_status ON public.check_exceptions(case_status);
CREATE INDEX idx_pint_ae_checks_check_id ON public.pint_ae_checks(check_id);
CREATE INDEX idx_pint_ae_checks_is_enabled ON public.pint_ae_checks(is_enabled);

-- Run Summary Table
CREATE TABLE IF NOT EXISTS public.run_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.check_runs(id) ON DELETE CASCADE,
  total_invoices_tested INTEGER NOT NULL DEFAULT 0,
  total_exceptions INTEGER NOT NULL DEFAULT 0,
  pass_rate_percent NUMERIC NOT NULL DEFAULT 100,
  exceptions_by_severity JSONB DEFAULT '{}',
  top_10_failing_checks JSONB DEFAULT '[]',
  top_10_clients_by_risk JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.run_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on run_summaries" ON public.run_summaries FOR SELECT USING (true);
CREATE POLICY "Allow public insert on run_summaries" ON public.run_summaries FOR INSERT WITH CHECK (true);

-- Client Risk Scores Table (per run)
CREATE TABLE IF NOT EXISTS public.client_risk_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.check_runs(id) ON DELETE CASCADE,
  seller_trn TEXT NOT NULL,
  client_name TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER NOT NULL DEFAULT 100,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  total_exceptions INTEGER NOT NULL DEFAULT 0,
  total_invoices INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(run_id, seller_trn)
);

-- Enable RLS
ALTER TABLE public.client_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on client_risk_scores" ON public.client_risk_scores FOR SELECT USING (true);
CREATE POLICY "Allow public insert on client_risk_scores" ON public.client_risk_scores FOR INSERT WITH CHECK (true);