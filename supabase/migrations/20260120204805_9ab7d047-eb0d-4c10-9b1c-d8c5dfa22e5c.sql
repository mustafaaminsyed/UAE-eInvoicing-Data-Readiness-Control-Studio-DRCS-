-- Create mapping_templates table to store reusable field mapping templates
CREATE TABLE public.mapping_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  tenant_id TEXT,
  legal_entity TEXT,
  seller_trn TEXT,
  erp_type TEXT,
  document_type TEXT DEFAULT 'UC1 Standard Tax Invoice',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (this is an internal tool)
CREATE POLICY "Allow all operations on mapping_templates" 
ON public.mapping_templates 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mapping_templates_updated_at
BEFORE UPDATE ON public.mapping_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_mapping_templates_active ON public.mapping_templates (is_active);
CREATE INDEX idx_mapping_templates_seller_trn ON public.mapping_templates (seller_trn);
CREATE INDEX idx_mapping_templates_erp_type ON public.mapping_templates (erp_type);