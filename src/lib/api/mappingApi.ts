import { supabase } from '@/integrations/supabase/client';
import { MappingTemplate, FieldMapping } from '@/types/fieldMapping';
import { Json } from '@/integrations/supabase/types';

// Helper to safely parse mappings from JSONB
function parseMappings(mappings: Json | null): FieldMapping[] {
  if (!mappings) return [];
  if (Array.isArray(mappings)) {
    return mappings as unknown as FieldMapping[];
  }
  return [];
}

// Fetch all mapping templates
export async function fetchMappingTemplates(): Promise<MappingTemplate[]> {
  const { data, error } = await supabase
    .from('mapping_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[MappingAPI] Error fetching templates:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    templateName: row.template_name,
    description: row.description,
    clientName: row.client_name,
    tenantId: row.tenant_id,
    legalEntity: row.legal_entity,
    sellerTrn: row.seller_trn,
    erpType: row.erp_type,
    documentType: row.document_type || 'UC1 Standard Tax Invoice',
    version: row.version,
    isActive: row.is_active,
    mappings: parseMappings(row.mappings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// Fetch active templates only
export async function fetchActiveTemplates(): Promise<MappingTemplate[]> {
  const { data, error } = await supabase
    .from('mapping_templates')
    .select('*')
    .eq('is_active', true)
    .order('template_name');

  if (error) {
    console.error('[MappingAPI] Error fetching active templates:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    templateName: row.template_name,
    description: row.description,
    clientName: row.client_name,
    tenantId: row.tenant_id,
    legalEntity: row.legal_entity,
    sellerTrn: row.seller_trn,
    erpType: row.erp_type,
    documentType: row.document_type || 'UC1 Standard Tax Invoice',
    version: row.version,
    isActive: row.is_active,
    mappings: parseMappings(row.mappings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// Save a new mapping template
export async function saveMappingTemplate(template: MappingTemplate): Promise<string | null> {
  const insertData = {
    template_name: template.templateName,
    description: template.description || null,
    client_name: template.clientName || null,
    tenant_id: template.tenantId || null,
    legal_entity: template.legalEntity || null,
    seller_trn: template.sellerTrn || null,
    erp_type: template.erpType || null,
    document_type: template.documentType,
    version: template.version,
    is_active: template.isActive,
    mappings: template.mappings as unknown as Json,
  };

  const { data, error } = await supabase
    .from('mapping_templates')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('[MappingAPI] Error saving template:', error);
    return null;
  }

  console.log('[MappingAPI] Template saved with ID:', data.id);
  return data.id;
}

// Update an existing template
export async function updateMappingTemplate(id: string, template: Partial<MappingTemplate>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  
  if (template.templateName !== undefined) updateData.template_name = template.templateName;
  if (template.description !== undefined) updateData.description = template.description;
  if (template.clientName !== undefined) updateData.client_name = template.clientName;
  if (template.tenantId !== undefined) updateData.tenant_id = template.tenantId;
  if (template.legalEntity !== undefined) updateData.legal_entity = template.legalEntity;
  if (template.sellerTrn !== undefined) updateData.seller_trn = template.sellerTrn;
  if (template.erpType !== undefined) updateData.erp_type = template.erpType;
  if (template.documentType !== undefined) updateData.document_type = template.documentType;
  if (template.version !== undefined) updateData.version = template.version;
  if (template.isActive !== undefined) updateData.is_active = template.isActive;
  if (template.mappings !== undefined) updateData.mappings = template.mappings as unknown as Record<string, unknown>[];

  const { error } = await supabase
    .from('mapping_templates')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('[MappingAPI] Error updating template:', error);
    return false;
  }

  return true;
}

// Delete a template
export async function deleteMappingTemplate(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('mapping_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[MappingAPI] Error deleting template:', error);
    return false;
  }

  return true;
}

// Create a new version of an existing template
export async function createTemplateVersion(baseTemplateId: string, updatedMappings: FieldMapping[]): Promise<string | null> {
  // Fetch the base template
  const { data: baseTemplate, error: fetchError } = await supabase
    .from('mapping_templates')
    .select('*')
    .eq('id', baseTemplateId)
    .single();

  if (fetchError || !baseTemplate) {
    console.error('[MappingAPI] Error fetching base template:', fetchError);
    return null;
  }

  // Create new version
  const insertData = {
    template_name: baseTemplate.template_name,
    description: baseTemplate.description,
    client_name: baseTemplate.client_name,
    tenant_id: baseTemplate.tenant_id,
    legal_entity: baseTemplate.legal_entity,
    seller_trn: baseTemplate.seller_trn,
    erp_type: baseTemplate.erp_type,
    document_type: baseTemplate.document_type,
    version: baseTemplate.version + 1,
    is_active: true,
    mappings: updatedMappings as unknown as Json,
  };

  const { data, error } = await supabase
    .from('mapping_templates')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('[MappingAPI] Error creating template version:', error);
    return null;
  }

  // Deactivate old version
  await supabase
    .from('mapping_templates')
    .update({ is_active: false })
    .eq('id', baseTemplateId);

  return data.id;
}
