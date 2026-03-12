'use client';

import React from 'react';
import { clsx } from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InfographicSection {
  heading: string;
  stat: string;
  description: string;
  iconSuggestion: string;
}

interface InfographicData {
  title: string;
  subtitle?: string;
  sections: InfographicSection[];
  colorScheme?: string;
}

interface InfographicPreviewProps {
  data: InfographicData;
}

// ---------------------------------------------------------------------------
// Icon placeholders (simple geometric shapes per icon suggestion)
// ---------------------------------------------------------------------------

const SECTION_COLORS = [
  { bg: 'bg-blue-600/15', text: 'text-blue-400', stat: 'text-blue-300' },
  { bg: 'bg-emerald-600/15', text: 'text-emerald-400', stat: 'text-emerald-300' },
  { bg: 'bg-amber-600/15', text: 'text-amber-400', stat: 'text-amber-300' },
  { bg: 'bg-purple-600/15', text: 'text-purple-400', stat: 'text-purple-300' },
  { bg: 'bg-pink-600/15', text: 'text-pink-400', stat: 'text-pink-300' },
  { bg: 'bg-cyan-600/15', text: 'text-cyan-400', stat: 'text-cyan-300' },
];

function IconPlaceholder({ suggestion, className }: { suggestion: string; className?: string }) {
  // Map common icon suggestions to simple SVG paths
  const iconMap: Record<string, React.ReactNode> = {
    'trending-up': (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    'bar-chart': (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    clock: (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    rocket: (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
    target: (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
    layers: (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
      </svg>
    ),
    robot: (
      <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
  };

  // Find a matching icon or use a default
  const lower = suggestion.toLowerCase();
  const match = Object.keys(iconMap).find((key) => lower.includes(key));
  if (match) return iconMap[match];

  // Default: a simple circle
  return (
    <svg className={clsx('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InfographicPreview({ data }: InfographicPreviewProps) {
  if (!data || !data.sections?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 px-4 py-3 text-center border-b border-zinc-800">
        <h3 className="text-sm font-bold text-white">{data.title}</h3>
        {data.subtitle && (
          <p className="mt-0.5 text-xs text-zinc-400">{data.subtitle}</p>
        )}
      </div>

      {/* Sections */}
      <div className="divide-y divide-zinc-800/50">
        {data.sections.map((section, idx) => {
          const colorSet = SECTION_COLORS[idx % SECTION_COLORS.length];
          return (
            <div key={idx} className="flex items-center gap-3 px-4 py-3">
              {/* Icon */}
              <div className={clsx('flex-shrink-0 rounded-lg p-2', colorSet.bg)}>
                <IconPlaceholder
                  suggestion={section.iconSuggestion}
                  className={colorSet.text}
                />
              </div>

              {/* Stat + text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={clsx('text-lg font-bold', colorSet.stat)}>
                    {section.stat}
                  </span>
                  <span className="text-xs font-medium text-zinc-300 truncate">
                    {section.heading}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed truncate">
                  {section.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2">
        {data.colorScheme && (
          <span className="text-[10px] text-zinc-600">
            Theme: {data.colorScheme}
          </span>
        )}
        <button
          className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          onClick={() => {
            // Placeholder for download
          }}
        >
          Download as Image
        </button>
      </div>
    </div>
  );
}
