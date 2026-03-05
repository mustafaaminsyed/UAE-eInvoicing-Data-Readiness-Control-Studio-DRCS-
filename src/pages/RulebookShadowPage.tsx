import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, FileWarning, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCompliance } from '@/context/ComplianceContext';
import {
  isMofRulebookEnabled,
  isMofRulebookShadowModeEnabled,
  loadMofRulebookBundle,
} from '@/lib/rulebook/loader';
import { runRulebookShadowChecks } from '@/lib/rulebook/shadowRunner';
import { buildMofRuleTraceability } from '@/lib/rulebook/traceability';
import { getControlsForDR } from '@/lib/registry/controlsRegistry';

type ShadowSummaryRow = {
  exceptionCode: string;
  count: number;
  uniqueInvoices: number;
  uniqueRules: number;
};

type ControlImpactRow = {
  controlId: string;
  hitCount: number;
  linkedRules: number;
};

type MonetaryMismatchRow = {
  ruleId: string;
  invoiceId: string;
  lineId: string;
  message: string;
};

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvCell).join(',');
  const body = rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(','));
  return [headerLine, ...body].join('\n');
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function RulebookShadowPage() {
  const { buyers, headers, lines, isDataLoaded, pintAEExceptions } = useCompliance();

  const mofRulebookEnabled = useMemo(() => isMofRulebookEnabled(), []);
  const mofShadowModeEnabled = useMemo(() => isMofRulebookShadowModeEnabled(), []);
  const rulebookBundle = useMemo(() => {
    if (!mofRulebookEnabled && !mofShadowModeEnabled) return null;
    try {
      return loadMofRulebookBundle();
    } catch {
      return null;
    }
  }, [mofRulebookEnabled, mofShadowModeEnabled]);

  const diagnostics = useMemo(() => {
    if (!rulebookBundle || !isDataLoaded) return null;

    const buyerMap = new Map(buyers.map((b) => [b.buyer_id, b]));
    const headerMap = new Map(headers.map((h) => [h.invoice_id, h]));
    const linesByInvoice = new Map<string, typeof lines>();
    lines.forEach((line) => {
      if (!linesByInvoice.has(line.invoice_id)) linesByInvoice.set(line.invoice_id, []);
      linesByInvoice.get(line.invoice_id)!.push(line);
    });

    const dataContext = { buyers, headers, lines, buyerMap, headerMap, linesByInvoice };
    const shadow = runRulebookShadowChecks(
      dataContext,
      rulebookBundle.rulebook,
      rulebookBundle.adapted.checks
    );

    const legacyKeys = new Set(
      pintAEExceptions.map((e) => `${e.invoice_id || '-'}|${e.line_id || '-'}|${e.field_name || '-'}|${e.check_id}`)
    );
    const shadowKeys = new Set(
      shadow.exceptions.map((e) => `${e.invoiceId || '-'}|${e.lineId || '-'}|${e.field || '-'}|${e.ruleId}`)
    );
    let overlap = 0;
    shadowKeys.forEach((key) => {
      if (legacyKeys.has(key)) overlap++;
    });

    const ruleTrace = buildMofRuleTraceability(rulebookBundle.rulebook);
    const drIdsByRuleId = new Map(ruleTrace.map((entry) => [entry.rule_id, entry.affected_dr_ids]));

    const codeCount = new Map<string, number>();
    const codeInvoices = new Map<string, Set<string>>();
    const codeRules = new Map<string, Set<string>>();
    const controlHits = new Map<string, { hitCount: number; linkedRules: Set<string> }>();

    shadow.exceptions.forEach((ex) => {
      const code = ex.exceptionCode || 'UNKNOWN';
      codeCount.set(code, (codeCount.get(code) ?? 0) + 1);
      if (!codeInvoices.has(code)) codeInvoices.set(code, new Set<string>());
      if (!codeRules.has(code)) codeRules.set(code, new Set<string>());
      if (ex.invoiceId) codeInvoices.get(code)!.add(ex.invoiceId);
      codeRules.get(code)!.add(ex.ruleId);

      const drIds = drIdsByRuleId.get(ex.ruleId) || [];
      drIds.forEach((drId) => {
        getControlsForDR(drId).forEach((control) => {
          if (!controlHits.has(control.control_id)) {
            controlHits.set(control.control_id, { hitCount: 0, linkedRules: new Set<string>() });
          }
          const entry = controlHits.get(control.control_id)!;
          entry.hitCount++;
          entry.linkedRules.add(ex.ruleId);
        });
      });
    });

    const exceptionSummaryRows: ShadowSummaryRow[] = Array.from(codeCount.entries())
      .map(([exceptionCode, count]) => ({
        exceptionCode,
        count,
        uniqueInvoices: codeInvoices.get(exceptionCode)?.size ?? 0,
        uniqueRules: codeRules.get(exceptionCode)?.size ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const controlImpactRows: ControlImpactRow[] = Array.from(controlHits.entries())
      .map(([controlId, stats]) => ({
        controlId,
        hitCount: stats.hitCount,
        linkedRules: stats.linkedRules.size,
      }))
      .sort((a, b) => b.hitCount - a.hitCount);

    const field44RuleId = 'UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY';
    const field48RuleId = 'UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY';
    const field49RuleId = 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY';

    const buildRowsForRule = (ruleId: string): MonetaryMismatchRow[] =>
      shadow.exceptions
        .filter((ex) => ex.ruleId === ruleId)
        .slice(0, 20)
        .map((ex) => ({
          ruleId: ex.ruleId,
          invoiceId: ex.invoiceId || '-',
          lineId: ex.lineId || '-',
          message: ex.message,
        }));

    const field44Rows = buildRowsForRule(field44RuleId);
    const field48Rows = buildRowsForRule(field48RuleId);
    const field49Rows = buildRowsForRule(field49RuleId);
    const monetaryRows = [...field44Rows, ...field48Rows, ...field49Rows].slice(0, 60);

    return {
      shadow,
      overlap,
      exceptionSummaryRows,
      controlImpactRows,
      field44MismatchCount: field44Rows.length,
      field48MismatchCount: field48Rows.length,
      field49MismatchCount: field49Rows.length,
      monetaryRows,
    };
  }, [rulebookBundle, isDataLoaded, buyers, headers, lines, pintAEExceptions]);

  const handleExportCsv = () => {
    if (!diagnostics) return;
    const summaryCsv = toCsv(
      diagnostics.exceptionSummaryRows.map((row) => ({
        exception_code: row.exceptionCode,
        count: row.count,
        unique_invoices: row.uniqueInvoices,
        unique_rules: row.uniqueRules,
      }))
    );
    const controlsCsv = toCsv(
      diagnostics.controlImpactRows.map((row) => ({
        control_id: row.controlId,
        shadow_hits: row.hitCount,
        linked_rules: row.linkedRules,
      }))
    );
    const findingsCsv = toCsv(
      diagnostics.shadow.exceptions.slice(0, 2000).map((row) => ({
        rule_id: row.ruleId,
        exception_code: row.exceptionCode,
        invoice_id: row.invoiceId || '',
        line_id: row.lineId || '',
        field: row.field || '',
        message: row.message,
      }))
    );

    downloadFile('mof_shadow_exception_summary.csv', summaryCsv, 'text/csv;charset=utf-8;');
    downloadFile('mof_shadow_impacted_controls.csv', controlsCsv, 'text/csv;charset=utf-8;');
    downloadFile('mof_shadow_findings_sample.csv', findingsCsv, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    if (!diagnostics) return;
    const payload = {
      exported_at: new Date().toISOString(),
      mode: mofRulebookEnabled ? 'enforced+shadow' : 'shadow',
      summary: diagnostics.exceptionSummaryRows,
      impacted_controls: diagnostics.controlImpactRows,
      findings_sample: diagnostics.shadow.exceptions.slice(0, 2000),
    };
    downloadFile('mof_shadow_diagnostics.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;');
  };

  if (!mofRulebookEnabled && !mofShadowModeEnabled) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="container max-w-5xl py-8 md:py-10">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rulebook diagnostics disabled</AlertTitle>
            <AlertDescription>
              Enable <code>VITE_RULEBOOK_SHADOW_MODE=true</code> (or <code>VITE_USE_MOF_RULEBOOK=true</code>) to view this page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10 space-y-6">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">MoF Shadow Diagnostics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Side-by-side visibility of UAE rulebook exception taxonomy and control impact.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Badge variant="outline">{mofRulebookEnabled ? 'Enforced + Shadow' : 'Shadow Only'}</Badge>
            <Badge variant="outline">{rulebookBundle?.versionLabel || 'Unknown rulebook version'}</Badge>
          </div>
          {diagnostics && (
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportCsv} className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportJson} className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </Button>
            </div>
          )}
        </div>

        {!isDataLoaded && (
          <Alert>
            <FileWarning className="h-4 w-4" />
            <AlertTitle>No data loaded</AlertTitle>
            <AlertDescription>
              Upload files first on <Link to="/upload" className="underline">Upload</Link> to generate diagnostics.
            </AlertDescription>
          </Alert>
        )}

        {diagnostics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <MetricCard label="Shadow Exceptions" value={String(diagnostics.shadow.exceptions.length)} />
              <MetricCard label="Executed Rules" value={String(diagnostics.shadow.executedRules)} />
              <MetricCard label="Skipped Rules" value={String(diagnostics.shadow.skippedRules)} />
              <MetricCard label="Legacy (Last Run)" value={String(pintAEExceptions.length)} />
              <MetricCard label="Overlap" value={String(diagnostics.overlap)} />
            </div>

            <Card className="surface-glass border-white/70">
              <CardHeader>
                <CardTitle>Exception Code Summary</CardTitle>
                <CardDescription>
                  Distribution by MoF <code>EINV_*</code> taxonomy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exception Code</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Rules</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostics.exceptionSummaryRows.map((row) => (
                      <TableRow key={row.exceptionCode}>
                        <TableCell className="font-mono text-xs">{row.exceptionCode}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">{row.uniqueInvoices}</TableCell>
                        <TableCell className="text-right">{row.uniqueRules}</TableCell>
                      </TableRow>
                    ))}
                    {diagnostics.exceptionSummaryRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No shadow exceptions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="surface-glass border-white/70">
              <CardHeader>
                <CardTitle>Monetary Consistency Spotlight (Fields 44, 48, 49)</CardTitle>
                <CardDescription>
                  Quick view of consistency findings for gross price and AED monetary fields.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <MetricCard label="Field 44 Mismatches" value={String(diagnostics.field44MismatchCount)} />
                  <MetricCard label="Field 48 Mismatches" value={String(diagnostics.field48MismatchCount)} />
                  <MetricCard label="Field 49 Mismatches" value={String(diagnostics.field49MismatchCount)} />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostics.monetaryRows.map((row, idx) => (
                      <TableRow key={`${row.ruleId}-${row.invoiceId}-${row.lineId}-${idx}`}>
                        <TableCell className="font-mono text-xs">{row.ruleId}</TableCell>
                        <TableCell>{row.invoiceId}</TableCell>
                        <TableCell>{row.lineId}</TableCell>
                        <TableCell className="max-w-[560px] truncate" title={row.message}>
                          {row.message}
                        </TableCell>
                      </TableRow>
                    ))}
                    {diagnostics.monetaryRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No monetary consistency mismatches found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="surface-glass border-white/70">
              <CardHeader>
                <CardTitle>Impacted Controls</CardTitle>
                <CardDescription>
                  Controls inferred from DR overlap with shadow exceptions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Control ID</TableHead>
                      <TableHead className="text-right">Shadow Hits</TableHead>
                      <TableHead className="text-right">Linked Rules</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostics.controlImpactRows.map((row) => (
                      <TableRow key={row.controlId}>
                        <TableCell className="font-mono text-xs">{row.controlId}</TableCell>
                        <TableCell className="text-right">{row.hitCount}</TableCell>
                        <TableCell className="text-right">{row.linkedRules}</TableCell>
                      </TableRow>
                    ))}
                    {diagnostics.controlImpactRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No impacted controls inferred.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="surface-glass border-white/70">
              <CardHeader>
                <CardTitle>Sample Shadow Findings</CardTitle>
                <CardDescription>First 20 rows for quick triage and walkthrough.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostics.shadow.exceptions.slice(0, 20).map((ex, idx) => (
                      <TableRow key={`${ex.ruleId}-${idx}`}>
                        <TableCell className="font-mono text-xs">{ex.ruleId}</TableCell>
                        <TableCell className="font-mono text-xs">{ex.exceptionCode}</TableCell>
                        <TableCell>{ex.invoiceId || '-'}</TableCell>
                        <TableCell>{ex.lineId || '-'}</TableCell>
                        <TableCell>{ex.field || '-'}</TableCell>
                        <TableCell className="max-w-[420px] truncate" title={ex.message}>{ex.message}</TableCell>
                      </TableRow>
                    ))}
                    {diagnostics.shadow.exceptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No shadow findings for current data.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
