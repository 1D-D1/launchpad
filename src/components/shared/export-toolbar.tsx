'use client';

import { useState, useRef, useEffect } from 'react';

interface ExportToolbarProps {
  projectId: string;
  csvTypes?: { label: string; value: string }[];
  showPdf?: boolean;
  pdfType?: string;
}

const defaultCsvTypes = [
  { label: 'Project Report', value: 'project' },
  { label: 'Content Performance', value: 'content' },
  { label: 'Ads Performance', value: 'ads' },
  { label: 'Email Campaigns', value: 'emails' },
  { label: 'Leads Export', value: 'leads' },
];

export default function ExportToolbar({
  projectId,
  csvTypes = defaultCsvTypes,
  showPdf = true,
  pdfType = 'project',
}: ExportToolbarProps) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCsvOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function downloadCsv(type: string) {
    setCsvOpen(false);
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/csv?type=${type}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${projectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('CSV export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function openPdfReport() {
    setExporting(true);
    try {
      const url = `/api/projects/${projectId}/export/pdf?type=${pdfType}`;
      window.open(url, '_blank');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* CSV Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setCsvOpen(!csvOpen)}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {csvOpen && (
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
            {csvTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => downloadCsv(t.value)}
                className="block w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PDF Button */}
      {showPdf && (
        <button
          onClick={openPdfReport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Export PDF
        </button>
      )}
    </div>
  );
}
