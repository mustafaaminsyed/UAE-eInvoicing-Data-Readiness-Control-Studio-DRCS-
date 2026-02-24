import { Direction } from './direction';

export interface UploadLogFileMeta {
  dataset: 'buyers' | 'headers' | 'lines';
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
}

export interface UploadLogSummary {
  buyersCount: number;
  headersCount: number;
  linesCount: number;
  totalRows: number;
  scenario?: 'positive' | 'negative' | 'customer';
  direction?: Direction;
}

export interface UploadLogEntry {
  id: string;
  uploadedAt: string;
  uploadSessionId?: string;
  uploadManifestId?: string;
  fileCount: number;
  files: UploadLogFileMeta[];
  summary: UploadLogSummary;
}

export type NewUploadLogEntry = Omit<UploadLogEntry, 'id' | 'uploadedAt'>;
