import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileClock, RefreshCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCompliance } from "@/context/ComplianceContext";
import {
  clearUploadAuditLogs,
  deleteUploadAuditLog,
  getUploadAuditLogs,
  type UploadAuditLogEntry,
} from "@/lib/uploadAudit";

export default function UploadAuditPage() {
  const { isDataLoaded, headers, buyers, lines, clearData } = useCompliance();
  const [logs, setLogs] = useState<UploadAuditLogEntry[]>(() => getUploadAuditLogs());

  const totals = useMemo(() => {
    const totalRows = logs.reduce(
      (acc, log) => acc + log.buyersCount + log.headersCount + log.linesCount,
      0
    );
    const totalFiles = logs.reduce((acc, log) => acc + log.datasets.length, 0);
    return {
      sessions: logs.length,
      totalRows,
      totalFiles,
      latestAt: logs[0]?.createdAt ?? null,
    };
  }, [logs]);

  const handleDeleteOne = (id: string) => {
    const ok = window.confirm("Delete this upload audit record?");
    if (!ok) return;
    deleteUploadAuditLog(id);
    setLogs(getUploadAuditLogs());
  };

  const handleClearAllLogs = () => {
    const ok = window.confirm("Delete all upload audit records?");
    if (!ok) return;
    clearUploadAuditLogs();
    setLogs([]);
  };

  const handleClearCurrentData = () => {
    const ok = window.confirm("Clear currently loaded buyers/headers/lines from the app state?");
    if (!ok) return;
    clearData();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
            <FileClock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Upload Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track uploaded datasets and validation state for audit and refresh operations.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Upload Sessions" value={String(totals.sessions)} />
          <SummaryCard label="Files Logged" value={String(totals.totalFiles)} />
          <SummaryCard label="Rows Uploaded" value={String(totals.totalRows)} />
          <SummaryCard
            label="Latest Upload"
            value={totals.latestAt ? formatDate(totals.latestAt) : "None"}
          />
        </div>

        <Card className="border mb-6">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-foreground">Current Active Dataset</p>
              {isDataLoaded ? (
                <p className="text-muted-foreground text-xs mt-1">
                  buyers: {buyers.length} | headers: {headers.length} | lines: {lines.length}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs mt-1">No dataset currently loaded.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={handleClearCurrentData}
                disabled={!isDataLoaded}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Clear Active Data
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={handleClearAllLogs}
                disabled={logs.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Audit Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {logs.length === 0 ? (
          <Card className="border">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No upload records available yet.</p>
              <Button asChild size="sm">
                <Link to="/upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Files
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id} className="border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Uploaded</p>
                      <p className="text-sm font-semibold text-foreground">{formatDateTime(log.createdAt)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => handleDeleteOne(log.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <MetricPill label="Buyers" value={log.buyersCount} />
                    <MetricPill label="Headers" value={log.headersCount} />
                    <MetricPill label="Lines" value={log.linesCount} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {log.datasets.map((dataset) => (
                      <div key={`${log.id}-${dataset.dataset}`} className="rounded-md border bg-muted/20 p-2.5">
                        <p className="text-xs font-medium text-foreground capitalize">{dataset.dataset}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-1">{dataset.fileName}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {dataset.rowCount} rows | {dataset.columnCount} cols
                        </p>
                        {dataset.requiredMissing.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {dataset.requiredMissing.slice(0, 4).map((col) => (
                              <Badge key={col} variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                                Missing: {col}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] mt-2 border-[hsl(var(--success))]/30 text-[hsl(var(--success))]">
                            Required columns present
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {log.relationalChecks.length > 0 && (
                    <div className="rounded-md border bg-muted/20 p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                        Relational Integrity Snapshot
                      </p>
                      <div className="space-y-1.5">
                        {log.relationalChecks.map((check) => (
                          <div key={`${log.id}-${check.label}`} className="flex items-center justify-between text-[11px]">
                            <span className="text-foreground">{check.label}</span>
                            <span className="text-muted-foreground">
                              {check.matchPct.toFixed(0)}% match ({check.unmatchedCount} unmatched)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
