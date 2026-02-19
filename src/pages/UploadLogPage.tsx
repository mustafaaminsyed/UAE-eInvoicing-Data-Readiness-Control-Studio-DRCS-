import { Trash2, FileClock, Database, CalendarClock, Files, RotateCcw } from 'lucide-react';
import { useCompliance } from '@/context/ComplianceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[i]}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function UploadLogPage() {
  const { uploadLogs, deleteUploadLogEntry, clearUploadLogs } = useCompliance();

  const totalUploads = uploadLogs.length;
  const totalFiles = uploadLogs.reduce((sum, log) => sum + log.fileCount, 0);
  const totalRows = uploadLogs.reduce((sum, log) => sum + log.summary.totalRows, 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container py-8 max-w-7xl">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
            <FileClock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Upload Activity Log</h1>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            Online record of ingested files, upload timestamps, file names, and ingestion summary statistics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Card className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Database className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Upload Events</span></div>
              <p className="text-2xl font-semibold">{totalUploads}</p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Files className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Files Uploaded</span></div>
              <p className="text-2xl font-semibold">{totalFiles}</p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><CalendarClock className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Total Rows Ingested</span></div>
              <p className="text-2xl font-semibold">{totalRows}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Ingestion Log Entries</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={clearUploadLogs}
                disabled={uploadLogs.length === 0}
              >
                <RotateCcw className="w-3 h-3" />
                Clear Log
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {uploadLogs.length === 0 ? (
              <div className="rounded-lg border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No upload logs yet. Upload and ingest files from the Upload page to create entries.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>File Names</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDateTime(log.uploadedAt)}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{log.fileCount} file(s)</div>
                          <div className="text-xs text-muted-foreground">
                            {log.files.reduce((sum, file) => sum + file.fileSize, 0) > 0
                              ? formatBytes(log.files.reduce((sum, file) => sum + file.fileSize, 0))
                              : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {log.files.map((file) => (
                              <div key={`${log.id}-${file.dataset}`} className="text-xs">
                                <Badge variant="outline" className="mr-2 text-[11px]">{file.dataset}</Badge>
                                <span className="font-mono">{file.fileName}</span>
                                <span className="text-muted-foreground ml-2">({file.rowCount} rows)</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <div>Buyers: <span className="font-medium">{log.summary.buyersCount}</span></div>
                            <div>Headers: <span className="font-medium">{log.summary.headersCount}</span></div>
                            <div>Lines: <span className="font-medium">{log.summary.linesCount}</span></div>
                            <div>Total Rows: <span className="font-medium">{log.summary.totalRows}</span></div>
                            {log.summary.direction && (
                              <div>
                                Direction: <Badge variant="outline" className="text-[11px]">{log.summary.direction}</Badge>
                              </div>
                            )}
                            {log.summary.scenario && (
                              <div>
                                Mode: <Badge variant="secondary" className="text-[11px] capitalize">{log.summary.scenario}</Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive gap-1"
                            onClick={() => deleteUploadLogEntry(log.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
