import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Eye, Filter, Save, Search, SlidersHorizontal, Trash2, CheckCheck } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useCompliance } from '@/context/ComplianceContext';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Exception, Severity } from '@/types/compliance';
import { Direction, ResolutionReasonCode } from '@/types/direction';
import { checksRegistry } from '@/lib/checks/checksRegistry';
import { cn } from '@/lib/utils';

type ExceptionSortKey = 'severity' | 'checkName' | 'invoiceNumber' | 'sellerTrn' | 'buyerId' | 'message';
type SortDirection = 'asc' | 'desc';
type ResolutionFilter = 'all' | 'resolved' | 'unresolved';
type WorkflowStatus = 'Open' | 'In Review' | 'Resolved' | 'Waived';

type ViewConfig = {
  search: string;
  severityFilter: Severity | 'all';
  directionFilter: Direction | 'all';
  checkFilter: string;
  resolutionFilter: ResolutionFilter;
  sortKey: ExceptionSortKey;
  sortDirection: SortDirection;
  visibleColumns: Record<string, boolean>;
};

type SavedView = {
  id: string;
  name: string;
  config: ViewConfig;
};

const SAVED_VIEWS_KEY = 'exceptions_saved_views_v1';
const EXCEPTION_WORKFLOW_KEY = 'exceptions_workflow_state_v1';

const defaultVisibleColumns: Record<string, boolean> = {
  severity: true,
  check: true,
  invoice: true,
  seller: true,
  buyer: true,
  message: true,
  status: true,
  direction: true,
};

const severityWeight: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function sortExceptions(items: Exception[], sortKey: ExceptionSortKey, direction: SortDirection) {
  const sorted = [...items].sort((a, b) => {
    const sign = direction === 'asc' ? 1 : -1;
    if (sortKey === 'severity') return (severityWeight[a.severity] - severityWeight[b.severity]) * sign;
    const aVal = String(a[sortKey] ?? '').toLowerCase();
    const bVal = String(b[sortKey] ?? '').toLowerCase();
    return aVal.localeCompare(bVal) * sign;
  });
  return sorted;
}

function exportExceptionsToCsv(rows: Exception[], filenamePrefix = 'exceptions') {
  const csvContent = [
    ['Check Name', 'Severity', 'Message', 'Invoice Number', 'Seller TRN', 'Buyer ID', 'Field', 'Expected', 'Actual'].join(','),
    ...rows.map((e) => [
      `"${e.checkName}"`,
      e.severity,
      `"${e.message.replace(/"/g, '""')}"`,
      e.invoiceNumber || '',
      e.sellerTrn || '',
      e.buyerId || '',
      e.field || '',
      e.expectedValue || '',
      e.actualValue || '',
    ].join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isChecksRun, exceptions, direction } = useCompliance();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [directionFilter, setDirectionFilter] = useState<Direction | 'all'>(direction);
  const [checkFilter, setCheckFilter] = useState<string>('all');
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>('all');
  const [sortKey, setSortKey] = useState<ExceptionSortKey>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVisibleColumns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('none');
  const [activeException, setActiveException] = useState<Exception | null>(null);
  const [workflowState, setWorkflowState] = useState<Record<string, { status: WorkflowStatus; reasonCode?: ResolutionReasonCode }>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isChecksRun) navigate('/');
  }, [isChecksRun, navigate]);

  useEffect(() => {
    const fromStorage = localStorage.getItem(SAVED_VIEWS_KEY);
    if (fromStorage) {
      try {
        const parsed = JSON.parse(fromStorage) as SavedView[];
        if (Array.isArray(parsed)) setSavedViews(parsed);
      } catch {
        // Ignore malformed saved views
      }
    }

    const workflowRaw = localStorage.getItem(EXCEPTION_WORKFLOW_KEY);
    if (workflowRaw) {
      try {
        const parsed = JSON.parse(workflowRaw) as Record<string, { status: WorkflowStatus; reasonCode?: ResolutionReasonCode }>;
        setWorkflowState(parsed);
      } catch {
        // Ignore malformed workflow cache
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    localStorage.setItem(EXCEPTION_WORKFLOW_KEY, JSON.stringify(workflowState));
  }, [workflowState]);

  useEffect(() => {
    const querySeverity = searchParams.get('severity');
    const queryCheck = searchParams.get('checkId');
    const querySearch = searchParams.get('q');
    const queryDirection = searchParams.get('direction');

    if (querySeverity && ['Critical', 'High', 'Medium', 'Low'].includes(querySeverity)) {
      setSeverityFilter(querySeverity as Severity);
    }
    if (queryCheck) setCheckFilter(queryCheck);
    if (querySearch) setSearch(querySearch);
    if (queryDirection === 'AR' || queryDirection === 'AP') setDirectionFilter(queryDirection);
  }, [searchParams]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Focus search quickly
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      // Export current selected/filtered set
      if ((event.key === 'e' || event.key === 'E') && event.altKey) {
        event.preventDefault();
        handleExport();
      }
      // Resolve selected rows
      if ((event.key === 'r' || event.key === 'R') && event.altKey) {
        event.preventDefault();
        handleMarkResolved();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    setDirectionFilter((current) => (current === 'all' ? current : direction));
  }, [direction]);

  const getExceptionStatus = useCallback(
    (exception: Exception): WorkflowStatus => workflowState[exception.id]?.status || exception.status || 'Open',
    [workflowState],
  );

  const isResolvedState = (status: WorkflowStatus) => status === 'Resolved' || status === 'Waived';

  const uniqueChecks = useMemo(
    () => [
      ...new Set(
        exceptions
          .filter((item) => directionFilter === 'all' || (item.direction || direction) === directionFilter)
          .map((item) => item.checkId),
      ),
    ],
    [direction, directionFilter, exceptions],
  );

  const filteredExceptions = useMemo(() => {
    return exceptions.filter((exception) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        exception.invoiceNumber?.toLowerCase().includes(searchLower) ||
        exception.sellerTrn?.toLowerCase().includes(searchLower) ||
        exception.buyerId?.toLowerCase().includes(searchLower) ||
        exception.message.toLowerCase().includes(searchLower) ||
        exception.checkName.toLowerCase().includes(searchLower);

      const matchesSeverity = severityFilter === 'all' || exception.severity === severityFilter;
      const matchesDirection = directionFilter === 'all' || (exception.direction || direction) === directionFilter;
      const matchesCheck = checkFilter === 'all' || exception.checkId === checkFilter;
      const status = getExceptionStatus(exception);
      const isResolved = isResolvedState(status);
      const matchesResolution =
        resolutionFilter === 'all' ||
        (resolutionFilter === 'resolved' && isResolved) ||
        (resolutionFilter === 'unresolved' && !isResolved);

      return matchesSearch && matchesSeverity && matchesDirection && matchesCheck && matchesResolution;
    });
  }, [exceptions, search, severityFilter, directionFilter, checkFilter, resolutionFilter, direction, getExceptionStatus]);

  const filteredAndSortedExceptions = useMemo(
    () => sortExceptions(filteredExceptions, sortKey, sortDirection),
    [filteredExceptions, sortKey, sortDirection],
  );

  const selectedExceptions = useMemo(
    () => filteredAndSortedExceptions.filter((exception) => selectedIds.has(exception.id)),
    [filteredAndSortedExceptions, selectedIds],
  );

  const exportRows = (rows: Exception[]) => {
    exportExceptionsToCsv(rows, rows.length === selectedExceptions.length && rows.length > 0 ? 'exceptions_selected' : 'exceptions_filtered');
  };

  const handleExport = () => {
    const rows = selectedExceptions.length > 0 ? selectedExceptions : filteredAndSortedExceptions;
    exportRows(rows);
  };

  const handleMarkResolved = () => {
    const ids = selectedExceptions.map((item) => item.id);
    if (ids.length === 0) return;
    setWorkflowState((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { status: 'Resolved' };
      });
      return next;
    });
    setSelectedIds(new Set());
  };

  const handleMarkUnresolved = () => {
    const ids = selectedExceptions.map((item) => item.id);
    if (ids.length === 0) return;
    setWorkflowState((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { status: 'Open' };
      });
      return next;
    });
    setSelectedIds(new Set());
  };

  const applyWorkflowAction = (status: WorkflowStatus, reasonCode?: ResolutionReasonCode) => {
    const ids = selectedExceptions.map((item) => item.id);
    if (ids.length === 0) return;
    setWorkflowState((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { status, reasonCode };
      });
      return next;
    });
    setSelectedIds(new Set());
  };

  const handleClearFilters = () => {
    setSearch('');
    setSeverityFilter('all');
    setDirectionFilter(direction);
    setCheckFilter('all');
    setResolutionFilter('all');
    setSortKey('severity');
    setSortDirection('desc');
    setSelectedViewId('none');
  };

  const handleSelectAllVisible = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredAndSortedExceptions.map((item) => item.id)) : new Set());
  };

  const handleToggleSelected = (exceptionId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(exceptionId);
      else next.delete(exceptionId);
      return next;
    });
  };

  const currentViewConfig: ViewConfig = {
    search,
    severityFilter,
    directionFilter,
    checkFilter,
    resolutionFilter,
    sortKey,
    sortDirection,
    visibleColumns,
  };

  const applyViewConfig = (config: ViewConfig) => {
    setSearch(config.search);
    setSeverityFilter(config.severityFilter);
    setDirectionFilter(config.directionFilter);
    setCheckFilter(config.checkFilter);
    setResolutionFilter(config.resolutionFilter);
    setSortKey(config.sortKey);
    setSortDirection(config.sortDirection);
    setVisibleColumns(config.visibleColumns);
  };

  const handleSaveView = () => {
    const name = window.prompt('View name');
    if (!name) return;
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      name,
      config: currentViewConfig,
    };
    setSavedViews((prev) => [newView, ...prev]);
    setSelectedViewId(newView.id);
  };

  const handleDeleteView = () => {
    if (selectedViewId === 'none') return;
    setSavedViews((prev) => prev.filter((view) => view.id !== selectedViewId));
    setSelectedViewId('none');
  };

  const severityCounts = useMemo(() => {
    const base = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    exceptions
      .filter((item) => directionFilter === 'all' || (item.direction || direction) === directionFilter)
      .forEach((item) => {
      base[item.severity] += 1;
      });
    return base;
  }, [direction, directionFilter, exceptions]);

  if (!isChecksRun) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">Exceptions</h1>
            <p className="mt-1 text-muted-foreground">
              {filteredAndSortedExceptions.length} of {exceptions.length} exceptions shown
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export {selectedExceptions.length > 0 ? 'Selected' : 'Filtered'}
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((severity) => (
            <button
              key={severity}
              type="button"
              onClick={() => setSeverityFilter((prev) => (prev === severity ? 'all' : severity))}
              className={cn(
                'rounded-xl border bg-card px-4 py-3 text-left transition-colors',
                severityFilter === severity ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
              )}
            >
              <p className="text-xs text-muted-foreground">{severity}</p>
              <p className="text-xl font-semibold text-foreground">{severityCounts[severity]}</p>
            </button>
          ))}
        </div>

        <div className="mb-6 space-y-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm animate-slide-up">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by check, invoice, TRN, buyer, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as Severity | 'all')}>
              <SelectTrigger className="w-full lg:w-44">
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
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder="Check" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Checks</SelectItem>
                {uniqueChecks.map((checkId) => {
                  const check = checksRegistry.find((c) => c.id === checkId);
                  return (
                    <SelectItem key={checkId} value={checkId}>
                      {check?.name || checkId}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <Select value={resolutionFilter} onValueChange={(v) => setResolutionFilter(v as ResolutionFilter)}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue placeholder="Resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as ExceptionSortKey)}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="checkName">Check</SelectItem>
                <SelectItem value="invoiceNumber">Invoice</SelectItem>
                <SelectItem value="sellerTrn">Seller TRN</SelectItem>
                <SelectItem value="buyerId">Buyer ID</SelectItem>
                <SelectItem value="message">Message</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as SortDirection)}>
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>

            <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as Direction | 'all')}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="AR">Outbound (AR)</SelectItem>
                <SelectItem value="AP">Inbound (AP)</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.severity}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, severity: Boolean(checked) }))}
                >
                  Severity
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.check}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, check: Boolean(checked) }))}
                >
                  Check
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.invoice}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, invoice: Boolean(checked) }))}
                >
                  Invoice
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.seller}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, seller: Boolean(checked) }))}
                >
                  Seller TRN
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.buyer}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, buyer: Boolean(checked) }))}
                >
                  Buyer ID
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.message}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, message: Boolean(checked) }))}
                >
                  Message
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.direction}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, direction: Boolean(checked) }))}
                >
                  Direction
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, status: Boolean(checked) }))}
                >
                  Status
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Select
              value={selectedViewId}
              onValueChange={(value) => {
                setSelectedViewId(value);
                if (value === 'none') return;
                const view = savedViews.find((item) => item.id === value);
                if (view) applyViewConfig(view.config);
              }}
            >
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder="Saved views" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No saved view</SelectItem>
                {savedViews.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="gap-2" onClick={handleSaveView}>
              <Save className="h-4 w-4" />
              Save Current View
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDeleteView} disabled={selectedViewId === 'none'}>
              <Trash2 className="h-4 w-4" />
              Delete View
            </Button>
            <Button variant="outline" className="gap-2 lg:ml-auto" onClick={handleClearFilters}>
              <Filter className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Shortcuts: <kbd className="rounded bg-muted px-1 py-0.5">/</kbd> search, <kbd className="rounded bg-muted px-1 py-0.5">Alt+E</kbd> export, <kbd className="rounded bg-muted px-1 py-0.5">Alt+R</kbd> resolve selected.
          </p>
        </div>

        {selectedExceptions.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Badge variant="outline">{selectedExceptions.length} selected</Badge>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleMarkResolved}>
              <CheckCheck className="h-4 w-4" />
              Bulk Resolve
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('In Review')}>
              In Review
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleMarkUnresolved}>
              <Filter className="h-4 w-4" />
              Mark Unresolved
            </Button>
            {directionFilter === 'AP' && (
              <>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('In Review', 'REQUEST_VENDOR_CORRECTION')}>
                  Request Vendor Correction
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('Resolved', 'DUPLICATE_REJECT')}>
                  Duplicate Reject
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('Waived', 'MARK_NON_RECOVERABLE')}>
                  Mark Non-Recoverable
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('Resolved', 'ACCEPT_WITH_VARIANCE')}>
                  Accept With Variance
                </Button>
              </>
            )}
            {directionFilter === 'AR' && (
              <>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('In Review', 'REISSUE_INVOICE')}>
                  Reissue Invoice
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('In Review', 'CREDIT_NOTE_NEEDED')}>
                  Credit Note Needed
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyWorkflowAction('Resolved', 'CORRECT_BUYER_DATA_AND_RESEND')}>
                  Correct Buyer Data
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export Selected
            </Button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/70 shadow-sm animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-4">
                    <Checkbox
                      checked={
                        filteredAndSortedExceptions.length > 0 &&
                        selectedIds.size === filteredAndSortedExceptions.length
                      }
                      onCheckedChange={(checked) => handleSelectAllVisible(Boolean(checked))}
                      aria-label="Select all visible rows"
                    />
                  </th>
                  {visibleColumns.severity && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Severity</th>}
                  {visibleColumns.check && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Check</th>}
                  {visibleColumns.invoice && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Invoice #</th>}
                  {visibleColumns.seller && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Seller TRN</th>}
                  {visibleColumns.buyer && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Buyer ID</th>}
                  {visibleColumns.direction && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Direction</th>}
                  {visibleColumns.message && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Message</th>}
                  {visibleColumns.status && <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>}
                  <th className="p-4 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedExceptions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Object.values(visibleColumns).filter(Boolean).length + 2}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No exceptions match your filters
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedExceptions.map((exception) => {
                    const status = getExceptionStatus(exception);
                    const reasonCode = workflowState[exception.id]?.reasonCode || exception.reasonCode;
                    const isChecked = selectedIds.has(exception.id);
                    return (
                      <tr key={exception.id} className="border-b transition-colors hover:bg-muted/20">
                        <td className="p-4">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => handleToggleSelected(exception.id, Boolean(checked))}
                            aria-label={`Select exception ${exception.id}`}
                          />
                        </td>
                        {visibleColumns.severity && (
                          <td className="p-4">
                            <SeverityBadge severity={exception.severity} />
                          </td>
                        )}
                        {visibleColumns.check && (
                          <td className="max-w-[240px] p-4 text-sm font-medium text-foreground">
                            <div className="truncate">{exception.checkName}</div>
                          </td>
                        )}
                        {visibleColumns.invoice && (
                          <td className="p-4 font-mono text-sm text-muted-foreground">{exception.invoiceNumber || '-'}</td>
                        )}
                        {visibleColumns.seller && (
                          <td className="p-4 font-mono text-sm text-muted-foreground">{exception.sellerTrn || '-'}</td>
                        )}
                        {visibleColumns.buyer && (
                          <td className="p-4 font-mono text-sm text-muted-foreground">{exception.buyerId || '-'}</td>
                        )}
                        {visibleColumns.direction && (
                          <td className="p-4">
                            <Badge variant="outline">{exception.direction || direction}</Badge>
                          </td>
                        )}
                        {visibleColumns.message && (
                          <td className="max-w-[320px] p-4 text-sm text-muted-foreground">
                            <div className="truncate">{exception.message}</div>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="p-4">
                            <div className="space-y-1">
                              <Badge variant={isResolvedState(status) ? 'secondary' : 'outline'}>{status}</Badge>
                              {reasonCode && <div className="text-[11px] text-muted-foreground">{reasonCode}</div>}
                            </div>
                          </td>
                        )}
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setActiveException(exception)}>
                              <Eye className="h-4 w-4" />
                              Details
                            </Button>
                            {exception.invoiceId && (
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/invoice/${exception.invoiceId}`)}>
                                Invoice
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(activeException)} onOpenChange={(open) => !open && setActiveException(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Exception Drill-down</DialogTitle>
            <DialogDescription>Summary to row to field-level context for fast investigation.</DialogDescription>
          </DialogHeader>
          {activeException && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <SeverityBadge severity={activeException.severity} />
                  <span className="font-medium text-foreground">{activeException.checkName}</span>
                </div>
                <p className="text-muted-foreground">{activeException.message}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Invoice Number</p>
                  <p className="font-mono text-foreground">{activeException.invoiceNumber || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Seller TRN</p>
                  <p className="font-mono text-foreground">{activeException.sellerTrn || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Buyer ID</p>
                  <p className="font-mono text-foreground">{activeException.buyerId || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Line ID</p>
                  <p className="font-mono text-foreground">{activeException.lineId || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Direction</p>
                  <p className="font-mono text-foreground">{activeException.direction || direction}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Validation Run</p>
                  <p className="font-mono text-foreground">{activeException.validationRunId || '-'}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Field-Level Details</p>
                <div className="space-y-2">
                  <p><span className="text-muted-foreground">Field:</span> <span className="font-mono">{activeException.field || '-'}</span></p>
                  <p><span className="text-muted-foreground">Expected:</span> <span className="font-mono">{String(activeException.expectedValue ?? '-')}</span></p>
                  <p><span className="text-muted-foreground">Actual:</span> <span className="font-mono">{String(activeException.actualValue ?? '-')}</span></p>
                </div>
              </div>
              {activeException.invoiceId && (
                <div className="flex justify-end">
                  <Button onClick={() => navigate(`/invoice/${activeException.invoiceId}`)}>Open Invoice Detail</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
