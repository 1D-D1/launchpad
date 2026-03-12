'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CarouselSlide {
  slideNumber: number;
  headline: string;
  body: string;
  visualPrompt: string;
}

interface CarouselPreviewProps {
  slides: CarouselSlide[];
  platform?: string;
}

// ---------------------------------------------------------------------------
// Platform gradients
// ---------------------------------------------------------------------------

const PLATFORM_GRADIENT: Record<string, string> = {
  LINKEDIN: 'from-blue-700 to-blue-900',
  INSTAGRAM: 'from-pink-600 via-purple-600 to-orange-500',
  FACEBOOK: 'from-blue-600 to-blue-800',
  TIKTOK: 'from-zinc-900 to-zinc-800',
  TWITTER: 'from-sky-600 to-sky-800',
};

const DEFAULT_GRADIENT = 'from-blue-600 to-indigo-800';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CarouselPreview({ slides, platform }: CarouselPreviewProps) {
  const [current, setCurrent] = useState(0);
  const gradient = (platform && PLATFORM_GRADIENT[platform]) || DEFAULT_GRADIENT;

  if (!slides || slides.length === 0) return null;

  const slide = slides[current];

  const goTo = (index: number) => {
    if (index >= 0 && index < slides.length) setCurrent(index);
  };

  return (
    <div className="w-full">
      {/* Slide display */}
      <div
        className={clsx(
          'relative rounded-lg bg-gradient-to-br p-5 aspect-square max-h-52 flex flex-col justify-center items-center text-center overflow-hidden cursor-pointer select-none',
          gradient,
        )}
        onClick={() => goTo((current + 1) % slides.length)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo((current + 1) % slides.length);
          if (e.key === 'ArrowLeft') goTo((current - 1 + slides.length) % slides.length);
        }}
      >
        {/* Slide counter */}
        <div className="absolute top-2 right-2 rounded-full bg-black/30 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur-sm">
          {current + 1}/{slides.length}
        </div>

        {/* Content */}
        <h3 className="text-sm font-bold text-white leading-tight mb-2 drop-shadow-sm">
          {slide.headline}
        </h3>
        <p className="text-xs text-white/80 leading-relaxed max-w-[90%]">
          {slide.body}
        </p>

        {/* Navigation arrows */}
        {current > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goTo(current - 1); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white/70 hover:bg-black/50 hover:text-white transition-colors backdrop-blur-sm"
            aria-label="Previous slide"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        {current < slides.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goTo(current + 1); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white/70 hover:bg-black/50 hover:text-white transition-colors backdrop-blur-sm"
            aria-label="Next slide"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Dots navigation */}
      <div className="flex justify-center gap-1.5 mt-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={clsx(
              'h-1.5 rounded-full transition-all',
              idx === current
                ? 'w-4 bg-blue-400'
                : 'w-1.5 bg-zinc-600 hover:bg-zinc-500',
            )}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Horizontal slide thumbnails */}
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-thin">
        {slides.map((s, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={clsx(
              'flex-shrink-0 rounded-md px-2 py-1 text-left transition-colors border',
              idx === current
                ? 'border-blue-500/50 bg-blue-600/10'
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700',
            )}
            style={{ minWidth: '80px', maxWidth: '120px' }}
          >
            <p className="text-[10px] font-medium text-zinc-300 truncate">{s.headline}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
