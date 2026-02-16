-- Invoice lifecycle status enum and tracking
CREATE TABLE public.invoice_lifecycle (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT,
  seller_trn TEXT NOT NULL,
  buyer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('Received', 'Pre-Validated', 'Held', 'Submitted', 'Acknowledged', 'Accepted', 'Rejected', 'Resolved', 'Resubmitted', 'Closed')),
  previous_status TEXT,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cases workflow table
CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT,
  seller_trn TEXT,
  buyer_id TEXT,
  exception_id TEXT,
  check_name TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  owner_team TEXT NOT NULL CHECK (owner_team IN ('ASP Ops', 'Client Finance', 'Client IT', 'Buyer-side')),
  sla_hours INTEGER NOT NULL DEFAULT 24,
  sla_target_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Waiting', 'Resolved')),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  is_sla_breached BOOLEAN DEFAULT false
);

-- Case notes/activity log
CREATE TABLE public.case_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rejection tracking table
CREATE TABLE public.rejections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT,
  seller_trn TEXT NOT NULL,
  rejection_code TEXT NOT NULL,
  rejection_category TEXT NOT NULL CHECK (rejection_category IN ('Data Quality', 'Schema Validation', 'Business Rules', 'Buyer Validation', 'Tax Authority', 'Technical', 'Other')),
  root_cause_owner TEXT CHECK (root_cause_owner IN ('ASP Ops', 'Client Finance', 'Client IT', 'Buyer-side', 'Tax Authority', 'System')),
  description TEXT,
  is_repeat BOOLEAN DEFAULT false,
  original_rejection_id UUID REFERENCES public.rejections(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Client health scores table
CREATE TABLE public.client_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_trn TEXT NOT NULL,
  client_name TEXT,
  score DECIMAL(5,2) NOT NULL DEFAULT 100,
  rejection_rate DECIMAL(5,4) DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  sla_breaches INTEGER DEFAULT 0,
  total_invoices INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_invoice_lifecycle_invoice_id ON public.invoice_lifecycle(invoice_id);
CREATE INDEX idx_invoice_lifecycle_seller_trn ON public.invoice_lifecycle(seller_trn);
CREATE INDEX idx_invoice_lifecycle_status ON public.invoice_lifecycle(status);
CREATE INDEX idx_cases_invoice_id ON public.cases(invoice_id);
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_owner_team ON public.cases(owner_team);
CREATE INDEX idx_cases_sla_breached ON public.cases(is_sla_breached);
CREATE INDEX idx_rejections_seller_trn ON public.rejections(seller_trn);
CREATE INDEX idx_rejections_category ON public.rejections(rejection_category);
CREATE INDEX idx_client_health_seller_trn ON public.client_health(seller_trn);

-- Enable RLS with public access (no auth for this tool)
ALTER TABLE public.invoice_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_health ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Public access invoice_lifecycle" ON public.invoice_lifecycle FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access cases" ON public.cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access case_notes" ON public.case_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access rejections" ON public.rejections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access client_health" ON public.client_health FOR ALL USING (true) WITH CHECK (true);

-- Trigger for cases updated_at
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();