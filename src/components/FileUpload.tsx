import { useCallback, useState } from 'react';
import { Upload, FileText, Check, X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { buyersSample, headersSample, linesSample, downloadSampleCSV } from '@/lib/sampleData';

interface FileUploadProps {
  label: string;
  description: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  sampleType: 'buyers' | 'headers' | 'lines';
}

const sampleData = {
  buyers: { content: buyersSample, filename: 'buyers_sample.csv' },
  headers: { content: headersSample, filename: 'invoices_header_sample.csv' },
  lines: { content: linesSample, filename: 'invoices_lines_sample.csv' },
};

export function FileUpload({ label, description, file, onFileSelect, sampleType }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && droppedFile.type === 'text/csv') {
        onFileSelect(droppedFile);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        onFileSelect(selectedFile);
      }
    },
    [onFileSelect]
  );

  const handleDownloadSample = () => {
    const sample = sampleData[sampleType];
    downloadSampleCSV(sample.filename, sample.content);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadSample}
          className="text-primary hover:text-primary/80"
        >
          <Download className="w-4 h-4 mr-1" />
          Sample
        </Button>
      </div>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-all duration-200',
          'hover:border-primary/50 hover:bg-primary/5',
          isDragging && 'border-primary bg-primary/10',
          file ? 'border-success bg-success-bg' : 'border-border'
        )}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center text-center">
          {file ? (
            <>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-success" />
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-success" />
                <span className="font-medium text-foreground">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect(null);
                  }}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
