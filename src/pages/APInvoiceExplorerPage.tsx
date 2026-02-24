import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompliance } from '@/context/ComplianceContext';
import { buildScenarioLensInvoices } from '@/modules/scenarioLens/selectors';
import {
  FuzzyStrictness,
  rankFuzzyCandidates,
  RankedFuzzyResult,
} from '@/lib/search/fuzzy';

type ValidationStatus = 'Pass' | 'Fail' | 'Warnings';

type APInvoiceRow = {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  currency: string;
  total: number;
  vat: number;
  vendorName: string;
  sellerTrn: string;
  status: ValidationStatus;
  scenarioTags: string[];
};

const PAGE_SIZE = 25;

export default function APInvoiceExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getDataForDataset, hasDatasetLoaded, exceptions, investigationFlags } = useCompliance();

  const [query, setQuery] = useState('');
  const [strictness, setStrictness] = useState<FuzzyStrictness>('balanced');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ValidationStatus>('all');
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const apData = getDataForDataset('AP');
  const apLoaded = hasDatasetLoaded('AP');
  const apExceptions = exceptions.filter((exception) => (exception.datasetType || 'AR') === 'AP');
  const apFlags = investigationFlags.filter((flag) => flag.datasetType === 'AP');

  const exceptionMap = useMemo(() => {
    const map = new Map<string, typeof apExceptions>();
    apExceptions.forEach((exception) => {
      if (!exception.invoiceId) return;
      if (!map.has(exception.invoiceId)) map.set(exception.invoiceId, []);
      map.get(exception.invoiceId)!.push(exception);
    });
    return map;
  }, [apExceptions]);

  const flagsMap = useMemo(() => {
    const map = new Map<string, typeof apFlags>();
    apFlags.forEach((flag) => {
      if (!flag.invoiceId) return;
      if (!map.has(flag.invoiceId)) map.set(flag.invoiceId, []);
      map.get(flag.invoiceId)!.push(flag);
    });
    return map;
  }, [apFlags]);

  const scenarioMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const scenarioInvoices = buildScenarioLensInvoices(apData.headers, apData.lines, apData.buyers);
    scenarioInvoices.forEach((invoice) => {
      const tags = [
        invoice.classification.documentType,
        ...invoice.classification.vatTreatments,
        ...invoice.classification.businessScenarios.filter((scenario) => scenario !== 'None'),
      ];
      map.set(invoice.invoiceId, tags.filter(Boolean));
    });
    return map;
  }, [apData]);

  const invoiceRows = useMemo<APInvoiceRow[]>(() => {
    return apData.headers.map((header) => {
      const relatedExceptions = exceptionMap.get(header.invoice_id) || [];
      const relatedFlags = flagsMap.get(header.invoice_id) || [];
      const hasFail = relatedExceptions.some(
        (exception) => exception.severity === 'Critical' || exception.severity === 'High'
      );
      const hasWarn = !hasFail && (relatedExceptions.length > 0 || relatedFlags.length > 0);
      const status: ValidationStatus = hasFail ? 'Fail' : hasWarn ? 'Warnings' : 'Pass';

      return {
        invoiceId: header.invoice_id,
        invoiceNumber: header.invoice_number || header.invoice_id,
        issueDate: header.issue_date || '',
        currency: header.currency || '-',
        total: header.total_incl_vat ?? header.total_excl_vat ?? 0,
        vat: header.vat_total ?? 0,
        vendorName: header.seller_name || 'Unknown vendor',
        sellerTrn: header.seller_trn || '-',
        status,
        scenarioTags: scenarioMap.get(header.invoice_id) || [],
      };
    });
  }, [apData.headers, exceptionMap, flagsMap, scenarioMap]);

  const vendorOptions = useMemo(
    () =>
      Array.from(new Set(invoiceRows.map((row) => row.vendorName)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [invoiceRows]
  );

  const currencyOptions = useMemo(
    () =>
      Array.from(new Set(invoiceRows.map((row) => row.currency)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [invoiceRows]
  );

  const exceptionTypeOptions = useMemo(
    () =>
      Array.from(new Set(apExceptions.map((exception) => exception.checkName))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [apExceptions]
  );

  const filteredRows = useMemo(() => {
    const minAmount = amountMin ? Number(amountMin) : null;
    const maxAmount = amountMax ? Number(amountMax) : null;
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const scoped = invoiceRows.filter((row) => {
      if (vendorFilter !== 'all' && row.vendorName !== vendorFilter) return false;
      if (currencyFilter !== 'all' && row.currency !== currencyFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (minAmount !== null && row.total < minAmount) return false;
      if (maxAmount !== null && row.total > maxAmount) return false;

      if (fromDate || toDate) {
        const current = row.issueDate ? new Date(row.issueDate) : null;
        if (!current || Number.isNaN(current.getTime())) return false;
        if (fromDate && current < fromDate) return false;
        if (toDate && current > toDate) return false;
      }

      if (exceptionTypeFilter !== 'all') {
        const hasType = (exceptionMap.get(row.invoiceId) || []).some(
          (exception) => exception.checkName === exceptionTypeFilter
        );
        if (!hasType) return false;
      }

      return true;
    });

    if (!query.trim()) {
      return scoped.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    }

    const ranked = rankFuzzyCandidates(
      query,
      scoped.map((row) => ({
        id: row.invoiceId,
        vendorName: row.vendorName,
        invoiceNumber: row.invoiceNumber,
        trn: row.sellerTrn,
        reference: row.invoiceId,
      })),
      strictness
    );

    const rankMap = new Map<string, number>();
    ranked.forEach((entry) => rankMap.set(entry.item.id, entry.score));

    return scoped
      .filter((row) => rankMap.has(row.invoiceId))
      .sort((a, b) => (rankMap.get(b.invoiceId) || 0) - (rankMap.get(a.invoiceId) || 0));
  }, [
    invoiceRows,
    vendorFilter,
    currencyFilter,
    statusFilter,
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    exceptionTypeFilter,
    query,
    strictness,
    exceptionMap,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    query,
    strictness,
    vendorFilter,
    currencyFilter,
    statusFilter,
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    exceptionTypeFilter,
  ]);

  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    if (!invoiceId) return;
    if (!invoiceRows.some((row) => row.invoiceId === invoiceId)) return;
    setSelectedInvoiceId(invoiceId);
  }, [searchParams, invoiceRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedInvoice = invoiceRows.find((row) => row.invoiceId === selectedInvoiceId);
  const selectedExceptions = selectedInvoiceId ? exceptionMap.get(selectedInvoiceId) || [] : [];
  const selectedFlags = selectedInvoiceId ? flagsMap.get(selectedInvoiceId) || [] : [];

  const similarInvoices = useMemo<RankedFuzzyResult<{ id: string; invoiceNumber: string; vendorName: string }>[]>(() => {
    if (!selectedInvoice) return [];
    const peers = invoiceRows.filter((row) => row.invoiceId !== selectedInvoice.invoiceId);
    const seed = `${selectedInvoice.vendorName} ${selectedInvoice.invoiceNumber} ${selectedInvoice.sellerTrn}`;
    return rankFuzzyCandidates(
      seed,
      peers.map((row) => ({
        id: row.invoiceId,
        vendorName: row.vendorName,
        invoiceNumber: row.invoiceNumber,
        trn: row.sellerTrn,
        reference: row.invoiceId,
      })),
      'balanced'
    )
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        item: {
          id: entry.item.id,
          invoiceNumber:
            invoiceRows.find((row) => row.invoiceId === entry.item.id)?.invoiceNumber || entry.item.id,
          vendorName:
            invoiceRows.find((row) => row.invoiceId === entry.item.id)?.vendorName || 'Unknown vendor',
        },
      }));
  }, [selectedInvoice, invoiceRows]);

  const closeDetail = () => {
    setSelectedInvoiceId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('invoiceId');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10 space-y-6">
        <div className="animate-fade-in">
          <h1 className="font-display text-3xl font-semibold text-foreground">AP Invoice Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Explore inbound vendor invoices, exceptions, and investigation flags.
          </p>
        </div>

        {!apLoaded && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              No AP dataset uploaded yet. Upload Vendor Invoices (AP / Inbound) to use this explorer.
            </CardContent>
          </Card>
        )}

        {apLoaded && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Search & Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Fuzzy search vendor, invoice number, TRN, references..."
                      className="pl-10"
                    />
                  </div>
                  <Select value={strictness} onValueChange={(value) => setStrictness(value as FuzzyStrictness)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strict">Strict</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="loose">Loose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                  <Input
                    type="number"
                    placeholder="Min total"
                    value={amountMin}
                    onChange={(event) => setAmountMin(event.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Max total"
                    value={amountMax}
                    onChange={(event) => setAmountMax(event.target.value)}
                  />
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All vendors</SelectItem>
                      {vendorOptions.map((vendor) => (
                        <SelectItem key={vendor} value={vendor}>
                          {vendor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All currencies</SelectItem>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as 'all' | ValidationStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Pass">Pass</SelectItem>
                      <SelectItem value="Fail">Fail</SelectItem>
                      <SelectItem value="Warnings">Warnings</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={exceptionTypeFilter} onValueChange={setExceptionTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Exception type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All exception types</SelectItem>
                      {exceptionTypeOptions.map((checkName) => (
                        <SelectItem key={checkName} value={checkName}>
                          {checkName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      setStrictness('balanced');
                      setDateFrom('');
                      setDateTo('');
                      setAmountMin('');
                      setAmountMax('');
                      setVendorFilter('all');
                      setCurrencyFilter('all');
                      setStatusFilter('all');
                      setExceptionTypeFilter('all');
                    }}
                    className="gap-2"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Reset Filters
                  </Button>
                </div>

                {invoiceRows.length > 2000 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                    Large AP dataset detected ({invoiceRows.length} invoices). Fuzzy search is client-side and may feel slower.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="text-left p-3">Vendor (Seller)</th>
                        <th className="text-left p-3">Invoice #</th>
                        <th className="text-left p-3">Issue Date</th>
                        <th className="text-left p-3">Currency</th>
                        <th className="text-right p-3">Total</th>
                        <th className="text-right p-3">VAT</th>
                        <th className="text-left p-3">Validation Status</th>
                        <th className="text-left p-3">Scenario Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            No AP invoices match your filters.
                          </td>
                        </tr>
                      ) : (
                        pagedRows.map((row) => (
                          <tr
                            key={row.invoiceId}
                            className="border-b hover:bg-muted/20 cursor-pointer"
                            onClick={() => setSelectedInvoiceId(row.invoiceId)}
                          >
                            <td className="p-3">
                              <div className="font-medium text-foreground">{row.vendorName}</div>
                              <div className="text-xs text-muted-foreground">{row.sellerTrn}</div>
                            </td>
                            <td className="p-3 font-mono text-muted-foreground">{row.invoiceNumber}</td>
                            <td className="p-3 text-muted-foreground">{row.issueDate || '-'}</td>
                            <td className="p-3">{row.currency}</td>
                            <td className="p-3 text-right">{row.total.toFixed(2)}</td>
                            <td className="p-3 text-right">{row.vat.toFixed(2)}</td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={
                                  row.status === 'Fail'
                                    ? 'border-destructive/30 text-destructive'
                                    : row.status === 'Warnings'
                                    ? 'border-amber-500/30 text-amber-700'
                                    : 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]'
                                }
                              >
                                {row.status}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {row.scenarioTags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.scenarioTags.slice(0, 3).map((tag) => (
                                    <Badge key={`${row.invoiceId}-${tag}`} variant="secondary" className="text-[10px]">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredRows.length)} of{' '}
                {filteredRows.length}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Vendor (Seller): {selectedInvoice?.vendorName} | TRN: {selectedInvoice?.sellerTrn}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>Issue date: {selectedInvoice.issueDate || '-'}</p>
                  <p>Currency: {selectedInvoice.currency}</p>
                  <p>Total: {selectedInvoice.total.toFixed(2)}</p>
                  <p>VAT: {selectedInvoice.vat.toFixed(2)}</p>
                  <p>Status: {selectedInvoice.status}</p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Validation Exceptions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedExceptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hard validation exceptions for this invoice.</p>
                  ) : (
                    selectedExceptions.map((exception) => (
                      <div key={exception.id} className="rounded-md border p-2.5 text-sm">
                        <p className="font-medium text-foreground">{exception.checkName}</p>
                        <p className="text-muted-foreground">{exception.message}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Investigation Flags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedFlags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No investigation flags generated yet. Run AP Search Checks from Run Checks page.
                    </p>
                  ) : (
                    selectedFlags.map((flag) => (
                      <div key={flag.id} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm">
                        <p className="font-medium text-amber-800">{flag.checkName}</p>
                        <p className="text-amber-700">{flag.message}</p>
                        {typeof flag.confidenceScore === 'number' && (
                          <p className="text-xs text-amber-700 mt-1">
                            Confidence: {flag.confidenceScore.toFixed(0)}%
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Similar Invoices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {similarInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No similar invoices detected.</p>
                  ) : (
                    similarInvoices.map((item) => (
                      <div key={item.item.id} className="rounded-md border p-2 text-xs">
                        <p className="font-medium text-foreground">{item.item.invoiceNumber}</p>
                        <p className="text-muted-foreground">{item.item.vendorName}</p>
                        <p className="text-muted-foreground mt-1">
                          Similarity: {(item.score * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
