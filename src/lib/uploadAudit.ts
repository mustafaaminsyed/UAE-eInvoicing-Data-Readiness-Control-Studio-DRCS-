export type UploadAuditDatasetType = "buyers" | "headers" | "lines";

export interface UploadAuditDatasetMeta {
  dataset: UploadAuditDatasetType;
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  requiredMissing: string[];
  nullWarnings: Array<{ column: string; nullRate: number }>;
}

export interface UploadAuditRelationalMeta {
  label: string;
  matchPct: number;
  unmatchedCount: number;
  total: number;
}

export interface UploadAuditLogEntry {
  id: string;
  createdAt: string;
  datasetType?: "AR" | "AP";
  buyersCount: number;
  headersCount: number;
  linesCount: number;
  datasets: UploadAuditDatasetMeta[];
  relationalChecks: UploadAuditRelationalMeta[];
}

const STORAGE_KEY = "drcs.upload.audit.logs.v1";
const MAX_LOGS = 200;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isLogEntry(value: unknown): value is UploadAuditLogEntry {
  if (!value || typeof value !== "object") return false;
  const obj = value as UploadAuditLogEntry;
  return (
    typeof obj.id === "string" &&
    typeof obj.createdAt === "string" &&
    (obj.datasetType === undefined || obj.datasetType === "AR" || obj.datasetType === "AP") &&
    typeof obj.buyersCount === "number" &&
    typeof obj.headersCount === "number" &&
    typeof obj.linesCount === "number" &&
    Array.isArray(obj.datasets) &&
    Array.isArray(obj.relationalChecks)
  );
}

function readRaw(): UploadAuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLogEntry).map((entry) => ({
      ...entry,
      datasetType: entry.datasetType || "AR",
    }));
  } catch {
    return [];
  }
}

function writeRaw(entries: UploadAuditLogEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOGS)));
}

export function getUploadAuditLogs(): UploadAuditLogEntry[] {
  return readRaw().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addUploadAuditLog(
  entry: Omit<UploadAuditLogEntry, "id" | "createdAt">
): UploadAuditLogEntry {
  const next: UploadAuditLogEntry = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const existing = readRaw();
  writeRaw([next, ...existing]);
  return next;
}

export function deleteUploadAuditLog(id: string): void {
  const filtered = readRaw().filter((entry) => entry.id !== id);
  writeRaw(filtered);
}

export function clearUploadAuditLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}
