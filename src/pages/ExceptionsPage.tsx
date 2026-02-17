import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Download, Eye, Search } from 'lucide-react';
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
import { Severity } from '@/types/compliance';
import { DatasetType } from '@/types/datasets';

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isChecksRun, exceptions } = useCompliance();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [checkFilter, setCheckFilter] = useState<string>('all');
  const [datasetFilter, setDatasetFilter] = useState<DatasetType>(() => {
    const value = searchParams.get('dataset');
    return value === 'AP' ? 'AP' : 'AR';
  });

  useEffect(() => {
    if (!isChecksRun) navigate('/');
  }, [isChecksRun, navigate]);

  useEffect(() => {
    if (searchParams.get('dataset') === datasetFilter) return;
    const next = new URLSearchParams(searchParams);
    next.set('dataset', datasetFilter);
    setSearchParams(next, { replace: true });
  }, [datasetFilter, searchParams, setSearchParams]);

  const filteredExceptions = useMemo(() => {
    return exceptions.filter((exception) => {
      const exceptionDataset = exception.datasetType || 'AR';
      if (exceptionDataset !== datasetFilter) return false;

      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        exception.invoiceNumber?.toLowerCase().includes(searchLower) ||
        exception.sellerTrn?.toLowerCase().includes(searchLower) ||
        exception.buyerId?.toLowerCase().includes(searchLower) ||
        exception.message.toLowerCase().includes(searchLower);

      const matchesSeverity = severityFilter === 'all' || exception.severity === severityFilter;
      const matchesCheck = checkFilter === 'all' || exception.checkId === checkFilter;
      return matchesSearch && matchesSeverity && matchesCheck;
    });
  }, [exceptions, search, severityFilter, checkFilter, datasetFilter]);

  const handleExport = () => {
    const csvContent = [
      [
        'Dataset',
        'Check Name',
        'Severity',
        'Message',
        'Invoice Number',
        'Seller TRN',
        'Buyer ID',
        'Field',
        'Expected',
        'Actual',
      ].join(','),
      ...filteredExceptions.map((exception) =>
        [
          exception.datasetType || 'AR',
          `"${exception.checkName}"`,
          exception.severity,
          `"${exception.message.replace(/"/g, '""')}"`,
          exception.invoiceNumber || '',
          exception.sellerTrn || '',
          exception.buyerId || '',
          exception.field || '',
          exception.expectedValue || '',
          exception.actualValue || '',
        ].join(',')
      ),
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

  const handleOpenAPExplorer = (invoiceId?: string) => {
    if (!invoiceId) return;
    navigate(`/ap-explorer?invoiceId=${encodeURIComponent(invoiceId)}`);
  };

  const checkOptions = useMemo(() => {
    const map = new Map<string, string>();
    exceptions
      .filter((exception) => (exception.datasetType || 'AR') === datasetFilter)
      .forEach((exception) => {
        if (!map.has(exception.checkId)) map.set(exception.checkId, exception.checkName);
      });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [exceptions, datasetFilter]);

  if (!isChecksRun) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">Exceptions</h1>
            <p className="text-muted-foreground mt-1">
              {filteredExceptions.length} of {exceptions.length} exceptions shown
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4 mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Button
              size="sm"
              variant={datasetFilter === 'AR' ? 'default' : 'outline'}
              onClick={() => setDatasetFilter('AR')}
            >
              Outbound (AR)
            </Button>
            <Button
              size="sm"
              variant={datasetFilter === 'AP' ? 'default' : 'outline'}
              onClick={() => setDatasetFilter('AP')}
            >
              Inbound (AP)
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number, TRN, buyer ID..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={severityFilter}
              onValueChange={(value) => setSeverityFilter(value as Severity | 'all')}
            >
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
                {checkOptions.map((check) => (
                  <SelectItem key={check.id} value={check.id}>
                    {check.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
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
                      <td className="p-4 text-sm font-medium text-foreground max-w-[220px] truncate">
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
                      <td className="p-4 text-sm text-muted-foreground max-w-[320px] truncate">
                        {exception.message}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
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
                          {(exception.datasetType || 'AR') === 'AP' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAPExplorer(exception.invoiceId)}
                              className="gap-1"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                              AP Explorer
                            </Button>
                          )}
                        </div>
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
