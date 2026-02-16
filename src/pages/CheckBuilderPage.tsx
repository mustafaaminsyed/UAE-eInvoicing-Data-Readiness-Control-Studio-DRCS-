import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, ArrowLeft, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { SeverityBadge } from '@/components/SeverityBadge';
import { CustomCheckConfig } from '@/types/customChecks';
import { Severity } from '@/types/compliance';
import {
  fetchAllCustomChecks,
  createCustomCheck,
  updateCustomCheck,
  deleteCustomCheck,
} from '@/lib/api/checksApi';

const DATASET_SCOPES = [
  { value: 'header', label: 'Invoice Headers' },
  { value: 'lines', label: 'Invoice Lines' },
  { value: 'buyers', label: 'Buyers' },
  { value: 'cross-file', label: 'Cross-File' },
];

const RULE_TYPES = [
  { value: 'missing', label: 'Missing Field', description: 'Check if a field is empty or null' },
  { value: 'duplicate', label: 'Duplicate Detection', description: 'Find duplicate values across records' },
  { value: 'math', label: 'Math Validation', description: 'Compare calculated values' },
  { value: 'regex', label: 'Pattern Match', description: 'Validate field format with regex' },
  { value: 'custom_formula', label: 'Custom Formula', description: 'Write custom validation logic' },
];

const FIELD_OPTIONS: Record<string, string[]> = {
  header: ['invoice_id', 'invoice_number', 'issue_date', 'seller_trn', 'buyer_id', 'currency', 'invoice_type', 'total_excl_vat', 'vat_total', 'total_incl_vat'],
  lines: ['line_id', 'invoice_id', 'line_number', 'description', 'quantity', 'unit_price', 'line_discount', 'line_total_excl_vat', 'vat_rate', 'vat_amount'],
  buyers: ['buyer_id', 'buyer_name', 'buyer_trn', 'buyer_address', 'buyer_country'],
  'cross-file': ['invoice_id', 'invoice_number', 'seller_trn', 'buyer_id'],
};

const defaultCheck: Omit<CustomCheckConfig, 'id'> = {
  name: '',
  description: '',
  severity: 'Medium',
  dataset_scope: 'header',
  rule_type: 'missing',
  parameters: { field: '' },
  message_template: 'Validation failed for {invoice_number}',
  is_active: true,
};

export default function CheckBuilderPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checks, setChecks] = useState<CustomCheckConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<CustomCheckConfig | null>(null);
  const [formData, setFormData] = useState<Omit<CustomCheckConfig, 'id'>>(defaultCheck);

  useEffect(() => {
    loadChecks();
  }, []);

  const loadChecks = async () => {
    setIsLoading(true);
    const data = await fetchAllCustomChecks();
    setChecks(data);
    setIsLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingCheck(null);
    setFormData(defaultCheck);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (check: CustomCheckConfig) => {
    setEditingCheck(check);
    setFormData({
      name: check.name,
      description: check.description,
      severity: check.severity,
      dataset_scope: check.dataset_scope,
      rule_type: check.rule_type,
      parameters: check.parameters,
      message_template: check.message_template,
      is_active: check.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Check name is required', variant: 'destructive' });
      return;
    }

    if (editingCheck?.id) {
      const success = await updateCustomCheck(editingCheck.id, formData);
      if (success) {
        toast({ title: 'Check updated', description: 'Custom check has been updated' });
        loadChecks();
        setIsDialogOpen(false);
      } else {
        toast({ title: 'Error', description: 'Failed to update check', variant: 'destructive' });
      }
    } else {
      const result = await createCustomCheck(formData);
      if (result) {
        toast({ title: 'Check created', description: 'Custom check has been created' });
        loadChecks();
        setIsDialogOpen(false);
      } else {
        toast({ title: 'Error', description: 'Failed to create check', variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this check?')) {
      const success = await deleteCustomCheck(id);
      if (success) {
        toast({ title: 'Check deleted', description: 'Custom check has been deleted' });
        loadChecks();
      } else {
        toast({ title: 'Error', description: 'Failed to delete check', variant: 'destructive' });
      }
    }
  };

  const handleToggleActive = async (check: CustomCheckConfig) => {
    if (!check.id) return;
    const success = await updateCustomCheck(check.id, { is_active: !check.is_active });
    if (success) {
      loadChecks();
    }
  };

  const updateParameters = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value },
    }));
  };

  const renderParameterFields = () => {
    const fields = FIELD_OPTIONS[formData.dataset_scope] || [];
    
    switch (formData.rule_type) {
      case 'missing':
        return (
          <div className="space-y-3">
            <Label>Field to Check</Label>
            <Select
              value={formData.parameters.field || ''}
              onValueChange={(v) => updateParameters('field', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {fields.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'duplicate':
        return (
          <div className="space-y-3">
            <Label>Fields for Duplicate Check (comma-separated)</Label>
            <Input
              placeholder="e.g., invoice_number, seller_trn"
              value={(formData.parameters.fields || []).join(', ')}
              onChange={(e) => updateParameters('fields', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>
        );

      case 'math':
        return (
          <div className="space-y-3">
            <div>
              <Label>Left Expression</Label>
              <Input
                placeholder="e.g., {total_incl_vat}"
                value={formData.parameters.left_expression || ''}
                onChange={(e) => updateParameters('left_expression', e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Use {`{field_name}`} to reference fields</p>
            </div>
            <div>
              <Label>Operator</Label>
              <Select
                value={formData.parameters.operator || '='}
                onValueChange={(v) => updateParameters('operator', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">=</SelectItem>
                  <SelectItem value="!=">!=</SelectItem>
                  <SelectItem value=">">&gt;</SelectItem>
                  <SelectItem value="<">&lt;</SelectItem>
                  <SelectItem value=">=">&gt;=</SelectItem>
                  <SelectItem value="<=">&lt;=</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Right Expression</Label>
              <Input
                placeholder="e.g., {total_excl_vat} + {vat_total}"
                value={formData.parameters.right_expression || ''}
                onChange={(e) => updateParameters('right_expression', e.target.value)}
              />
            </div>
            <div>
              <Label>Tolerance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.01"
                value={formData.parameters.tolerance || ''}
                onChange={(e) => updateParameters('tolerance', parseFloat(e.target.value) || 0.01)}
              />
            </div>
          </div>
        );

      case 'regex':
        return (
          <div className="space-y-3">
            <div>
              <Label>Field to Validate</Label>
              <Select
                value={formData.parameters.field || ''}
                onValueChange={(v) => updateParameters('field', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Regex Pattern</Label>
              <Input
                placeholder="e.g., ^\d{15}$"
                value={formData.parameters.pattern || ''}
                onChange={(e) => updateParameters('pattern', e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">JavaScript regex without delimiters</p>
            </div>
          </div>
        );

      case 'custom_formula':
        return (
          <div className="space-y-3">
            <div>
              <Label>Formula (must return true for valid records)</Label>
              <Textarea
                placeholder="e.g., {quantity} > 0 && {unit_price} >= 0"
                value={formData.parameters.formula || ''}
                onChange={(e) => updateParameters('formula', e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">Use {`{field_name}`} to reference fields. Expression should evaluate to true/false.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-5xl py-8 md:py-10">
        <div className="flex items-center gap-4 mb-8 animate-fade-in">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Wand2 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Check Builder</h1>
                <p className="text-muted-foreground">Create and manage custom compliance checks</p>
              </div>
            </div>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Check
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading checks...</div>
        ) : checks.length === 0 ? (
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-12 text-center animate-slide-up">
            <Wand2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Custom Checks Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first custom compliance check to extend the validation library.
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Create First Check
            </Button>
          </div>
        ) : (
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm overflow-hidden animate-slide-up">
            <div className="divide-y">
              {checks.map((check) => (
                <div
                  key={check.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    check.is_active ? 'hover:bg-muted/30' : 'bg-muted/20 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-foreground">{check.name}</span>
                      <SeverityBadge severity={check.severity} />
                      <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                        {check.rule_type}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                        {check.dataset_scope}
                      </span>
                    </div>
                    {check.description && (
                      <p className="text-sm text-muted-foreground truncate">{check.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(check)}
                      className="text-muted-foreground"
                    >
                      {check.is_active ? (
                        <ToggleRight className="w-5 h-5 text-success" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(check)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => check.id && handleDelete(check.id)}
                      className="text-severity-critical hover:text-severity-critical"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCheck ? 'Edit Check' : 'Create New Check'}</DialogTitle>
              <DialogDescription>
                Define a custom compliance check with validation rules and parameters.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Check Name *</Label>
                  <Input
                    placeholder="e.g., Currency Code Validation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe what this check validates..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(v) => setFormData({ ...formData, severity: v as Severity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dataset Scope</Label>
                  <Select
                    value={formData.dataset_scope}
                    onValueChange={(v) => setFormData({ 
                      ...formData, 
                      dataset_scope: v as any,
                      parameters: { field: '' } 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATASET_SCOPES.map(scope => (
                        <SelectItem key={scope.value} value={scope.value}>{scope.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Rule Type</Label>
                  <Select
                    value={formData.rule_type}
                    onValueChange={(v) => setFormData({ 
                      ...formData, 
                      rule_type: v as any,
                      parameters: {} 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <span className="font-medium">{type.label}</span>
                            <span className="text-muted-foreground ml-2 text-xs">- {type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-foreground mb-3">Rule Parameters</h4>
                  {renderParameterFields()}
                </div>

                <div className="col-span-2">
                  <Label>Message Template</Label>
                  <Textarea
                    placeholder="e.g., Invoice {invoice_number}: {field} validation failed"
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {`{field_name}`} to include field values in the message
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>
                {editingCheck ? 'Save Changes' : 'Create Check'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


