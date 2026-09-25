'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RichMediaViewer, type RichMediaItem } from './RichMediaViewer';
import { buildCloudflareImageUrl } from '../../lib/r2-image';

export interface CarouselMediaItem extends RichMediaItem {
  id: string;
  label?: string;
  tag?: string;
}

export interface MediaCarouselProps {
  items: CarouselMediaItem[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  idleIntervalMs?: number; // Time in ms before auto-advancing (default: 5000)
  resumeDelayMs?: number; // Time in ms of inactivity before resuming auto-advance (default: 15000)
  autoAdvance?: boolean; // Whether auto-advancing is enabled (default: true)
  aspectRatio?: 'square' | 'portrait' | 'video' | 'auto';
  className?: string;
  fallbackIcon?: React.ReactNode;
  topBadges?: React.ReactNode;
  showThumbnails?: boolean;
  showControls?: boolean;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  items,
  selectedIndex,
  onSelectIndex,
  idleIntervalMs = 5000,
  resumeDelayMs = 15000,
  autoAdvance = true,
  aspectRatio = 'square',
  className = '',
  fallbackIcon,
  topBadges,
  showThumbnails = true,
  showControls = true,
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = selectedIndex !== undefined ? selectedIndex : internalIndex;

  const handleSelect = useCallback(
    (index: number) => {
      const normalized = (index + items.length) % items.length;
      if (onSelectIndex) {
        onSelectIndex(normalized);
      } else {
        setInternalIndex(normalized);
      }
    },
    [items.length, onSelectIndex]
  );

  const markUserInteraction = useCallback(() => {
    setIsUserInteracting(true);
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
    resumeTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, resumeDelayMs);
  }, [resumeDelayMs]);

  const advanceNext = useCallback(() => {
    if (items.length <= 1) return;
    handleSelect(activeIndex + 1);
  }, [activeIndex, handleSelect, items.length]);

  const advancePrev = useCallback(() => {
    if (items.length <= 1) return;
    handleSelect(activeIndex - 1);
  }, [activeIndex, handleSelect, items.length]);

  // Auto-advance idle progression timer
  useEffect(() => {
    if (!autoAdvance || isManuallyPaused || isUserInteracting || items.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      handleSelect(activeIndex + 1);
    }, idleIntervalMs);

    return () => clearInterval(timer);
  }, [autoAdvance, isManuallyPaused, isUserInteracting, activeIndex, items.length, idleIntervalMs, handleSelect]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      markUserInteraction();
      advancePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      markUserInteraction();
      advanceNext();
    } else if (e.key === ' ' || e.key === 'k') {
      // Space or 'k' toggles pause if focused directly on the container (not buttons)
      if (e.target === containerRef.current) {
        e.preventDefault();
        setIsManuallyPaused((prev) => !prev);
      }
    }
  };

  // Touch / Swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    markUserInteraction();
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = () => {
    markUserInteraction();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (diff > 50) {
      // Swiped left -> Next
      advanceNext();
    } else if (diff < -50) {
      // Swiped right -> Prev
      advancePrev();
    }
    touchStartXRef.current = null;
    markUserInteraction();
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'portrait'
        ? 'aspect-[4/5]'
        : aspectRatio === 'video'
          ? 'aspect-video'
          : '';

  if (!items || items.length === 0) {
    return (
      <div
        className={`w-full rounded-2xl bg-[#15191E] border border-stone-800 overflow-hidden flex items-center justify-center p-8 text-center ${aspectClass} ${className}`}
      >
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-xl border border-stone-800 bg-[#101317] flex items-center justify-center text-stone-500">
            {fallbackIcon || (
              <svg className="w-8 h-8 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-[#E55B24]">Workbench Silhouette Preview</p>
            <p className="text-[11px] font-mono text-stone-500">Field documentation in progress</p>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = items[activeIndex] || items[0];

  return (
    <div
      ref={containerRef}
      className={`space-y-4 select-none ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Product Media Gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={markUserInteraction}
      onMouseMove={markUserInteraction}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Screen Reader Live Region for WCAG accessibility */}
      <div className="sr-only" aria-live={isManuallyPaused ? 'off' : 'polite'} aria-atomic="true">
        Slide {activeIndex + 1} of {items.length}: {currentItem?.label || currentItem?.alt || ''}
      </div>

      {/* Main Slide Viewer Container */}
      <div
        className={`relative w-full ${aspectClass} rounded-2xl bg-[#15191E] border border-stone-800 overflow-hidden shadow-2xl group focus:outline-none focus:ring-2 focus:ring-[#E55B24]/60`}
        role="group"
        aria-roledescription="slide"
        aria-label={`Slide ${activeIndex + 1} of ${items.length}`}
      >
        <RichMediaViewer
          key={currentItem.id || currentItem.url}
          media={currentItem}
          aspectRatio={aspectRatio}
          priority={activeIndex === 0}
        />

        {/* Top Badges Overlay Slot */}
        {topBadges && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
            {topBadges}
          </div>
        )}

        {/* Bottom Tag Overlay */}
        {currentItem.tag && (
          <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
            <span className="bg-[#15191E]/90 text-stone-300 border border-stone-700/80 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md">
              {currentItem.tag}
            </span>
          </div>
        )}

        {/* Slide Counter Indicator */}
        {items.length > 1 && (
          <div className="absolute bottom-4 right-4 z-20 bg-stone-950/70 border border-stone-800/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-stone-300 flex items-center gap-2 pointer-events-none">
            <span>
              {activeIndex + 1} / {items.length}
            </span>
            {isUserInteracting && (
              <span className="text-[9px] text-[#E55B24] uppercase font-bold tracking-tight">
                Interacting
              </span>
            )}
            {isManuallyPaused && (
              <span className="text-[9px] text-amber-400 uppercase font-bold tracking-tight">
                Paused
              </span>
            )}
          </div>
        )}

        {/* Prev / Next Navigation Arrows (Visible on hover or keyboard focus) */}
        {showControls && items.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={(e) => {
                e.stopPropagation();
                markUserInteraction();
                advancePrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-stone-950/60 hover:bg-stone-900/90 text-stone-200 border border-stone-700/60 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity min-w-[44px] min-h-[44px]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Next slide"
              onClick={(e) => {
                e.stopPropagation();
                markUserInteraction();
                advanceNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-stone-950/60 hover:bg-stone-900/90 text-stone-200 border border-stone-700/60 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity min-w-[44px] min-h-[44px]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Control Bar: WCAG Pause/Play Toggle & Slide Indicators */}
      {showControls && items.length > 1 && (
        <div className="flex items-center justify-between text-xs font-mono text-stone-400 px-1">
          <button
            type="button"
            aria-label={isManuallyPaused ? 'Play carousel auto-advance' : 'Pause carousel auto-advance'}
            aria-pressed={isManuallyPaused}
            onClick={() => setIsManuallyPaused((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900/80 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-[#E55B24] transition-colors min-h-[44px]"
          >
            {isManuallyPaused ? (
              <>
                <span className="text-[12px]">▶</span>
                <span>Resume Auto-Play</span>
              </>
            ) : (
              <>
                <span className="text-[12px]">⏸</span>
                <span>Pause Auto-Play</span>
              </>
            )}
          </button>

          <span className="text-[11px] text-stone-500">
            {isUserInteracting ? 'Paused on interaction' : isManuallyPaused ? 'Paused' : 'Auto-advancing'}
          </span>
        </div>
      )}

      {/* Gallery Thumbnail Strip */}
      {showThumbnails && items.length > 1 && (
        <div
          className="flex items-center gap-3 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Product media thumbnails"
        >
          {items.map((item, idx) => {
            const isSelected = activeIndex === idx;
            const thumbUrl = item.posterUrl || item.url;
            const isVideo = item.mediaType === 'video' || item.url.match(/\.(mp4|webm|mov)$/i);
            const isGif = item.mediaType === 'gif' || item.url.match(/\.gif$/i);

            const optimizedThumb =
              thumbUrl.startsWith('/media/') || thumbUrl.startsWith('https://')
                ? buildCloudflareImageUrl(thumbUrl, {
                    width: 160,
                    quality: 75,
                    format: 'auto',
                    fit: 'cover',
                    onerror: 'redirect',
                  })
                : thumbUrl;

            return (
              <button
                key={item.id || `${item.url}-${idx}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={item.label || `Go to slide ${idx + 1}`}
                onClick={() => {
                  markUserInteraction();
                  handleSelect(idx);
                }}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 min-h-[44px] min-w-[44px] bg-[#101317] ${
                  isSelected
                    ? 'border-[#E55B24] shadow-md shadow-orange-500/20'
                    : 'border-stone-800 opacity-60 hover:opacity-100 hover:border-stone-600'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={optimizedThumb}
                  alt={item.label || ''}
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />

                {/* Video / GIF Indicator Badge on Thumbnail */}
                {isVideo && (
                  <span className="absolute top-1 right-1 bg-black/80 text-[8px] font-mono text-[#E55B24] px-1 rounded uppercase font-bold">
                    Vid
                  </span>
                )}
                {isGif && !isVideo && (
                  <span className="absolute top-1 right-1 bg-black/80 text-[8px] font-mono text-stone-300 px-1 rounded uppercase">
                    Gif
                  </span>
                )}

                {item.tag && (
                  <span className="absolute bottom-0 inset-x-0 bg-stone-950/80 text-[9px] font-mono text-stone-300 truncate px-1 text-center">
                    {item.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
