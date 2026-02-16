import { useState, useEffect } from 'react';
import { 
  XCircle, 
  TrendingUp, 
  RefreshCw,
  Building2,
  Tag,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatsCard } from '@/components/StatsCard';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { fetchRejections, getRejectionAnalytics, createRejection } from '@/lib/api/casesApi';
import { Rejection, RejectionCategory, RootCauseOwner } from '@/types/cases';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const CATEGORY_COLORS: Record<string, string> = {
  'Data Quality': '#3b82f6',
  'Schema Validation': '#06b6d4',
  'Business Rules': '#22c55e',
  'Buyer Validation': '#f59e0b',
  'Tax Authority': '#ef4444',
  'Technical': '#8b5cf6',
  'Other': '#6b7280',
};

const CATEGORIES: RejectionCategory[] = [
  'Data Quality', 'Schema Validation', 'Business Rules', 
  'Buyer Validation', 'Tax Authority', 'Technical', 'Other'
];

const ROOT_CAUSE_OWNERS: RootCauseOwner[] = [
  'ASP Ops', 'Client Finance', 'Client IT', 'Buyer-side', 'Tax Authority', 'System'
];

export default function RejectionsPage() {
  const { toast } = useToast();
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [analytics, setAnalytics] = useState({
    byCategory: {} as Record<string, number>,
    byClient: [] as { seller_trn: string; count: number; rate: number }[],
    repeatRate: 0,
    totalRejections: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRejection, setNewRejection] = useState({
    invoice_id: '',
    invoice_number: '',
    seller_trn: '',
    rejection_code: '',
    rejection_category: 'Data Quality' as RejectionCategory,
    root_cause_owner: 'ASP Ops' as RootCauseOwner,
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [rejectionsData, analyticsData] = await Promise.all([
      fetchRejections(),
      getRejectionAnalytics(),
    ]);
    setRejections(rejectionsData);
    setAnalytics(analyticsData);
    setIsLoading(false);
  };

  const handleAddRejection = async () => {
    if (!newRejection.invoice_id || !newRejection.seller_trn || !newRejection.rejection_code) {
      toast({ title: 'Error', description: 'Required fields missing', variant: 'destructive' });
      return;
    }
    const result = await createRejection(newRejection);
    if (result) {
      toast({ title: 'Rejection logged' });
      setIsAddOpen(false);
      setNewRejection({
        invoice_id: '', invoice_number: '', seller_trn: '', rejection_code: '',
        rejection_category: 'Data Quality', root_cause_owner: 'ASP Ops', description: '',
      });
      loadData();
    }
  };

  const categoryData = Object.entries(analytics.byCategory).map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name] || '#6b7280',
  }));

  const clientData = analytics.byClient.slice(0, 10);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-severity-critical/10 rounded-lg">
              <XCircle className="w-6 h-6 text-severity-critical" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Rejection Analytics</h1>
              <p className="text-muted-foreground">Track and analyze invoice rejections</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setIsAddOpen(true)}>
              Log Rejection
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <StatsCard
            title="Total Rejections"
            value={analytics.totalRejections}
            icon={<XCircle className="w-5 h-5" />}
            variant={analytics.totalRejections > 0 ? 'danger' : 'success'}
          />
          <StatsCard
            title="Repeat Rate"
            value={`${analytics.repeatRate.toFixed(1)}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            variant={analytics.repeatRate > 20 ? 'danger' : analytics.repeatRate > 10 ? 'warning' : 'success'}
          />
          <StatsCard
            title="Categories"
            value={Object.keys(analytics.byCategory).length}
            icon={<Tag className="w-5 h-5" />}
            variant="default"
          />
          <StatsCard
            title="Affected Clients"
            value={analytics.byClient.length}
            icon={<Building2 className="w-5 h-5" />}
            variant="default"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-slide-up">
          {/* By Category */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Rejections by Category</h2>
            {categoryData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No rejections recorded
              </div>
            )}
          </div>

          {/* By Client */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Top Clients by Rejections</h2>
            {clientData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="seller_trn" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No client data
              </div>
            )}
          </div>
        </div>

        {/* Recent Rejections Table */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm overflow-hidden animate-slide-up">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-foreground">Recent Rejections</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Seller TRN</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Code</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Root Cause</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Repeat?</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : rejections.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No rejections logged</td></tr>
                ) : (
                  rejections.slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-mono text-sm">{r.invoice_number || r.invoice_id}</td>
                      <td className="p-4 text-sm font-mono">{r.seller_trn}</td>
                      <td className="p-4 text-sm font-medium">{r.rejection_code}</td>
                      <td className="p-4">
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: CATEGORY_COLORS[r.rejection_category] }}
                        >
                          {r.rejection_category}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{r.root_cause_owner || '-'}</td>
                      <td className="p-4">
                        {r.is_repeat ? (
                          <span className="text-severity-critical font-medium">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Rejection Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Rejection</DialogTitle>
              <DialogDescription>Record a new invoice rejection</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice ID *</Label>
                  <Input
                    value={newRejection.invoice_id}
                    onChange={(e) => setNewRejection({ ...newRejection, invoice_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Invoice Number</Label>
                  <Input
                    value={newRejection.invoice_number}
                    onChange={(e) => setNewRejection({ ...newRejection, invoice_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Seller TRN *</Label>
                  <Input
                    value={newRejection.seller_trn}
                    onChange={(e) => setNewRejection({ ...newRejection, seller_trn: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Rejection Code *</Label>
                  <Input
                    value={newRejection.rejection_code}
                    onChange={(e) => setNewRejection({ ...newRejection, rejection_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={newRejection.rejection_category}
                    onValueChange={(v) => setNewRejection({ ...newRejection, rejection_category: v as RejectionCategory })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Root Cause Owner</Label>
                  <Select
                    value={newRejection.root_cause_owner}
                    onValueChange={(v) => setNewRejection({ ...newRejection, root_cause_owner: v as RootCauseOwner })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROOT_CAUSE_OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newRejection.description}
                  onChange={(e) => setNewRejection({ ...newRejection, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRejection}>Log Rejection</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


