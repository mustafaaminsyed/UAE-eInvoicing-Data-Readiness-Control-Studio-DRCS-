import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search, Filter, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompliance } from '@/context/ComplianceContext';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Exception, Severity } from '@/types/compliance';
import { checksRegistry } from '@/lib/checks/checksRegistry';

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const { isChecksRun, exceptions } = useCompliance();
  
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [checkFilter, setCheckFilter] = useState<string>('all');

  useEffect(() => {
    if (!isChecksRun) navigate('/');
  }, [isChecksRun, navigate]);

  const filteredExceptions = useMemo(() => {
    return exceptions.filter((exception) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        !search ||
        exception.invoiceNumber?.toLowerCase().includes(searchLower) ||
        exception.sellerTrn?.toLowerCase().includes(searchLower) ||
        exception.buyerId?.toLowerCase().includes(searchLower) ||
        exception.message.toLowerCase().includes(searchLower);

      // Severity filter
      const matchesSeverity = severityFilter === 'all' || exception.severity === severityFilter;

      // Check filter
      const matchesCheck = checkFilter === 'all' || exception.checkId === checkFilter;

      return matchesSearch && matchesSeverity && matchesCheck;
    });
  }, [exceptions, search, severityFilter, checkFilter]);

  const handleExport = () => {
    const csvContent = [
      ['Check Name', 'Severity', 'Message', 'Invoice Number', 'Seller TRN', 'Buyer ID', 'Field', 'Expected', 'Actual'].join(','),
      ...filteredExceptions.map(e => [
        `"${e.checkName}"`,
        e.severity,
        `"${e.message.replace(/"/g, '""')}"`,
        e.invoiceNumber || '',
        e.sellerTrn || '',
        e.buyerId || '',
        e.field || '',
        e.expectedValue || '',
        e.actualValue || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `exceptions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewInvoice = (invoiceId: string) => {
    navigate(`/invoice/${invoiceId}`);
  };

  const uniqueChecks = [...new Set(exceptions.map(e => e.checkId))];

  if (!isChecksRun) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Exceptions
            </h1>
            <p className="text-muted-foreground mt-1">
              {filteredExceptions.length} of {exceptions.length} exceptions shown
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4 mb-6 animate-slide-up">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number, TRN, buyer ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as Severity | 'all')}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={checkFilter} onValueChange={setCheckFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Check" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Checks</SelectItem>
                {uniqueChecks.map(checkId => {
                  const check = checksRegistry.find(c => c.id === checkId);
                  return (
                    <SelectItem key={checkId} value={checkId}>
                      {check?.name || checkId}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Exceptions Table */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Severity</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Check</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Seller TRN</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Buyer ID</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Message</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No exceptions match your filters
                    </td>
                  </tr>
                ) : (
                  filteredExceptions.map((exception) => (
                    <tr key={exception.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <SeverityBadge severity={exception.severity} />
                      </td>
                      <td className="p-4 text-sm font-medium text-foreground max-w-[200px] truncate">
                        {exception.checkName}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground font-mono">
                        {exception.invoiceNumber || '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground font-mono">
                        {exception.sellerTrn || '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground font-mono">
                        {exception.buyerId || '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[300px] truncate">
                        {exception.message}
                      </td>
                      <td className="p-4 text-right">
                        {exception.invoiceId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInvoice(exception.invoiceId!)}
                            className="gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


