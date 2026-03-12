'use client';

import { useState } from 'react';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
      <span className="mr-1">🧪</span>
      <span>
        <strong>Demo Mode</strong> — Use{' '}
        <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs text-amber-200">
          demo@launchpad.io
        </code>{' '}
        /{' '}
        <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs text-amber-200">
          Demo2026!
        </code>{' '}
        to explore
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-amber-400 hover:bg-amber-500/20 hover:text-amber-200 transition-colors"
        aria-label="Dismiss demo banner"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
