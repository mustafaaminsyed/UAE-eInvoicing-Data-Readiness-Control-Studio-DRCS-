import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Users,
  Filter,
  Plus,
  Eye,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Case, CaseStatus, OwnerTeam, CaseNote } from '@/types/cases';
import { 
  fetchCases, 
  updateCase, 
  getSLAMetrics, 
  addCaseNote, 
  fetchCaseNotes,
  updateSLABreaches 
} from '@/lib/api/casesApi';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: CaseStatus[] = ['Open', 'In Progress', 'Waiting', 'Resolved'];
const OWNER_OPTIONS: OwnerTeam[] = ['ASP Ops', 'Client Finance', 'Client IT', 'Buyer-side'];

const statusColors: Record<CaseStatus, string> = {
  'Open': 'bg-severity-critical-bg text-severity-critical border-severity-critical/30',
  'In Progress': 'bg-severity-high-bg text-severity-high border-severity-high/30',
  'Waiting': 'bg-severity-medium-bg text-severity-medium border-severity-medium/30',
  'Resolved': 'bg-success-bg text-success border-success/30',
};

export default function CasesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerTeam | 'all'>('all');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached' | 'ok'>('all');
  const [search, setSearch] = useState('');
  
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [slaMetrics, setSlaMetrics] = useState({ 
    averageResolutionHours: {} as Record<string, number>, 
    breachPercentage: 0, 
    totalCases: 0, 
    breachedCases: 0, 
    openCases: 0, 
    resolvedCases: 0 
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, ownerFilter, slaFilter]);

  const loadData = async () => {
    setIsLoading(true);
    await updateSLABreaches();
    
    const filters: any = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (ownerFilter !== 'all') filters.owner_team = ownerFilter;
    if (slaFilter === 'breached') filters.is_sla_breached = true;
    if (slaFilter === 'ok') filters.is_sla_breached = false;
    
    const [casesData, metrics] = await Promise.all([
      fetchCases(filters),
      getSLAMetrics(),
    ]);
    
    setCases(casesData);
    setSlaMetrics(metrics);
    setIsLoading(false);
  };

  const handleOpenDetail = async (caseItem: Case) => {
    setSelectedCase(caseItem);
    const notes = await fetchCaseNotes(caseItem.id);
    setCaseNotes(notes);
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = async (newStatus: CaseStatus) => {
    if (!selectedCase) return;
    const success = await updateCase(selectedCase.id, { status: newStatus });
    if (success) {
      toast({ title: 'Case updated', description: `Status changed to ${newStatus}` });
      loadData();
      setSelectedCase({ ...selectedCase, status: newStatus });
    }
  };

  const handleAddNote = async () => {
    if (!selectedCase || !newNote.trim()) return;
    const note = await addCaseNote(selectedCase.id, newNote, 'System');
    if (note) {
      setCaseNotes([note, ...caseNotes]);
      setNewNote('');
      toast({ title: 'Note added' });
    }
  };

  const filteredCases = cases.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.case_number.toLowerCase().includes(s) ||
      c.invoice_number?.toLowerCase().includes(s) ||
      c.seller_trn?.toLowerCase().includes(s);
  });

  const formatHours = (hours?: number) => {
    if (!hours) return '-';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cases</h1>
              <p className="text-muted-foreground">Exception case management & SLA tracking</p>
            </div>
          </div>
        </div>

        {/* SLA Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <StatsCard
            title="Total Cases"
            value={slaMetrics.totalCases}
            icon={<Briefcase className="w-5 h-5" />}
            variant="default"
          />
          <StatsCard
            title="Open Cases"
            value={slaMetrics.openCases}
            icon={<Clock className="w-5 h-5" />}
            variant={slaMetrics.openCases > 0 ? 'warning' : 'success'}
          />
          <StatsCard
            title="SLA Breached"
            value={slaMetrics.breachedCases}
            subtitle={`${slaMetrics.breachPercentage.toFixed(1)}% breach rate`}
            icon={<AlertTriangle className="w-5 h-5" />}
            variant={slaMetrics.breachedCases > 0 ? 'danger' : 'success'}
          />
          <StatsCard
            title="Resolved"
            value={slaMetrics.resolvedCases}
            icon={<CheckCircle className="w-5 h-5" />}
            variant="success"
          />
        </div>

        {/* Avg Resolution by Severity */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6 mb-8 animate-slide-up">
          <h3 className="font-semibold text-foreground mb-4">Average Resolution Time by Severity</h3>
          <div className="grid grid-cols-4 gap-4">
            {['Critical', 'High', 'Medium', 'Low'].map(sev => (
              <div key={sev} className="text-center p-4 bg-muted/30 rounded-lg">
                <SeverityBadge severity={sev as any} className="mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {formatHours(slaMetrics.averageResolutionHours[sev])}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4 mb-6 animate-slide-up">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search case #, invoice, seller..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {OWNER_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={slaFilter} onValueChange={(v) => setSlaFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SLA</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
                <SelectItem value="ok">Within SLA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cases Table */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Case #</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Check</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Severity</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Owner</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">SLA</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredCases.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No cases found</td></tr>
                ) : (
                  filteredCases.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-mono text-sm font-medium text-foreground">{c.case_number}</td>
                      <td className="p-4 text-sm text-muted-foreground">{c.invoice_number || c.invoice_id}</td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[150px] truncate">{c.check_name || '-'}</td>
                      <td className="p-4"><SeverityBadge severity={c.severity} /></td>
                      <td className="p-4 text-sm text-muted-foreground">{c.owner_team}</td>
                      <td className="p-4">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', statusColors[c.status])}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {c.is_sla_breached ? (
                          <span className="text-severity-critical font-medium text-sm">Breached</span>
                        ) : (
                          <span className="text-success font-medium text-sm">OK</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(c)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Case Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Case {selectedCase?.case_number}</DialogTitle>
              <DialogDescription>
                Invoice: {selectedCase?.invoice_number || selectedCase?.invoice_id}
              </DialogDescription>
            </DialogHeader>

            {selectedCase && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Severity</Label>
                    <div className="mt-1"><SeverityBadge severity={selectedCase.severity} /></div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Owner Team</Label>
                    <p className="font-medium">{selectedCase.owner_team}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Select value={selectedCase.status} onValueChange={handleUpdateStatus}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">SLA Status</Label>
                    <p className={cn('font-medium', selectedCase.is_sla_breached ? 'text-severity-critical' : 'text-success')}>
                      {selectedCase.is_sla_breached ? 'Breached' : 'Within SLA'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Check Name</Label>
                    <p className="font-medium">{selectedCase.check_name || '-'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Notes
                  </h4>
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    />
                    <Button onClick={handleAddNote}>Add</Button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {caseNotes.map(note => (
                      <div key={note.id} className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    {caseNotes.length === 0 && (
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => navigate(`/invoice/${selectedCase?.invoice_id}`)}>
                View Invoice
              </Button>
              <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


