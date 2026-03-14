import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { NewUploadLogEntry, UploadLogEntry } from '@/types/uploadLog';

interface UploadLogContextType {
  uploadLogs: UploadLogEntry[];
  addUploadLogEntry: (entry: NewUploadLogEntry) => void;
  deleteUploadLogEntry: (id: string) => void;
  clearUploadLogs: () => void;
}

const UploadLogContext = createContext<UploadLogContextType | undefined>(undefined);

const UPLOAD_LOGS_STORAGE_KEY = 'drcs_upload_logs_v1';

export function UploadLogProvider({ children }: { children: ReactNode }) {
  const [uploadLogs, setUploadLogs] = useState<UploadLogEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UPLOAD_LOGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UploadLogEntry[];
      if (Array.isArray(parsed)) {
        setUploadLogs(parsed);
      }
    } catch (error) {
      console.warn('[Compliance] Failed to load upload logs:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UPLOAD_LOGS_STORAGE_KEY, JSON.stringify(uploadLogs));
    } catch (error) {
      console.warn('[Compliance] Failed to persist upload logs:', error);
    }
  }, [uploadLogs]);

  const addUploadLogEntry = (entry: NewUploadLogEntry) => {
    const newEntry: UploadLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uploadedAt: new Date().toISOString(),
    };
    setUploadLogs((prev) => [newEntry, ...prev]);
  };

  const deleteUploadLogEntry = (id: string) => {
    setUploadLogs((prev) => prev.filter((entry) => entry.id !== id));
  };

  const clearUploadLogs = () => {
    setUploadLogs([]);
  };

  const value = useMemo(
    () => ({
      uploadLogs,
      addUploadLogEntry,
      deleteUploadLogEntry,
      clearUploadLogs,
    }),
    [uploadLogs]
  );

  return <UploadLogContext.Provider value={value}>{children}</UploadLogContext.Provider>;
}

export function useUploadLogs() {
  const context = useContext(UploadLogContext);
  if (context === undefined) throw new Error('useUploadLogs must be used within an UploadLogProvider');
  return context;
}
