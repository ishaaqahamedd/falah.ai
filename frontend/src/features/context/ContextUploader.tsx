import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';

interface UploadedFile {
  name: string;
  size: number | null;
  id?: string;
}

interface ContextUploaderProps {
  personaId: string;
  onUploadComplete?: () => void;
}

export function ContextUploader({ personaId, onUploadComplete }: ContextUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch previously uploaded documents on mount
  useEffect(() => {
    if (!personaId) return;
    const fetchExisting = async () => {
      try {
        const res = await apiClient.get('/context/documents', { params: { persona_id: personaId } });
        const existing = res.data.map((d: { filename: string; id: string }) => ({ name: d.filename, size: null, id: d.id }));
        setUploadedFiles(existing);
      } catch {
        // Silently fail — not critical
      }
    };
    fetchExisting();
  }, [personaId]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (personaId) {
        formData.append('persona_id', personaId);
      }
      formData.append('content_type', 'document');
      formData.append('metadata_json', JSON.stringify({ original_name: file.name }));

      await apiClient.post('/context/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadedFiles(prev => [...prev, { name: file.name, size: file.size }]);
      if (onUploadComplete) onUploadComplete();
    } catch (e) {
      console.error('Upload failed:', e);
      setError(`Failed to upload "${file.name}". Make sure it's a text file.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-text-secondary flex justify-between items-center">
        <span>📎 Upload Context Documents</span>
        {uploadedFiles.length > 0 && (
          <span className="text-emerald-400 text-xs font-mono">{uploadedFiles.length} uploaded</span>
        )}
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-border-primary bg-surface-secondary/50 hover:border-border-primary/80'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,.json,.eml"
          onChange={handleFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="text-blue-400 animate-pulse">
            <svg className="w-8 h-8 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">Embedding document...</span>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 text-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-text-secondary">Drag & drop emails, transcripts, or notes</p>
            <p className="text-xs text-text-muted mt-1">.txt, .md, .csv, .json, .eml</p>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-1.5 max-h-24 overflow-y-auto">
          {uploadedFiles.map((f, i) => (
            <div key={f.id || i} className="flex items-center space-x-2 text-xs text-text-secondary bg-surface-secondary/50 rounded-lg px-3 py-1.5">
              <span className="text-emerald-500">✓</span>
              <span className="truncate flex-1">{f.name}</span>
              {f.size && <span className="text-text-muted">{(f.size / 1024).toFixed(1)}KB</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
