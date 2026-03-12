'use client';

import { useState, useRef, useCallback } from 'react';

interface UploadedFile {
  url: string;
  assetId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface FileUploadProps {
  projectId: string;
  onUpload?: (file: UploadedFile) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  accept?: string;
  multiple?: boolean;
}

const DEFAULT_ACCEPT = 'image/*,application/pdf,.doc,.docx';

export default function FileUpload({
  projectId,
  onUpload,
  onError,
  maxSizeMB = 10,
  accept = DEFAULT_ACCEPT,
  multiple = true,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number; url?: string; error?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        const errMsg = `${file.name} exceeds ${maxSizeMB}MB limit`;
        onError?.(errMsg);
        setUploads((prev) => [...prev, { name: file.name, progress: 0, error: errMsg }]);
        return;
      }

      setUploads((prev) => [...prev, { name: file.name, progress: 10 }]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        // Simulate progress
        setUploads((prev) =>
          prev.map((u) => (u.name === file.name && !u.url ? { ...u, progress: 50 } : u))
        );

        const res = await fetch('/api/upload', { method: 'POST', body: formData });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data: UploadedFile = await res.json();

        setUploads((prev) =>
          prev.map((u) => (u.name === file.name && !u.url ? { ...u, progress: 100, url: data.url } : u))
        );

        onUpload?.(data);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploads((prev) =>
          prev.map((u) => (u.name === file.name && !u.url ? { ...u, progress: 0, error: errMsg } : u))
        );
        onError?.(errMsg);
      }
    },
    [projectId, maxSizeMB, onUpload, onError]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  function isImage(name: string) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-500 hover:bg-zinc-800/50'
        }`}
      >
        <svg className="h-10 w-10 text-zinc-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-zinc-400">
          <span className="font-medium text-blue-400">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Images, PDF, DOC up to {maxSizeMB}MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, idx) => (
            <div
              key={`${upload.name}-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3"
            >
              {/* Preview */}
              {upload.url && isImage(upload.name) ? (
                <img src={upload.url} alt={upload.name} className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-700 text-xs text-zinc-400">
                  {upload.name.split('.').pop()?.toUpperCase() || 'FILE'}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-zinc-300">{upload.name}</p>
                {upload.error ? (
                  <p className="text-xs text-red-400">{upload.error}</p>
                ) : upload.progress < 100 ? (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400">Uploaded</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
