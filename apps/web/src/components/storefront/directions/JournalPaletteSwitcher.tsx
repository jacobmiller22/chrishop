'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type JournalPalette = 'sailcloth' | 'spruce' | 'cedar' | 'granite' | 'nocturne';

export interface JournalPaletteSwitcherProps {
  currentPalette: JournalPalette;
  onSelectPalette?: (palette: JournalPalette) => void;
}

export interface PaletteDef {
  id: JournalPalette;
  name: string;
  tagline: string;
  canvas: string;
  ink: string;
  accent: string;
}

export const JOURNAL_PALETTES: PaletteDef[] = [
  {
    id: 'sailcloth',
    name: 'Sailcloth Ecru',
    tagline: 'Warm Cotton & Clay',
    canvas: '#F6F3EC',
    ink: '#1A2421',
    accent: '#C85A32',
  },
  {
    id: 'spruce',
    name: 'Blue Spruce',
    tagline: 'Glacial Mist & Trout Amber',
    canvas: '#F0F4F4',
    ink: '#0F2224',
    accent: '#D96B27',
  },
  {
    id: 'cedar',
    name: 'Waxed Cedar',
    tagline: 'Weathered Pine & Russet',
    canvas: '#F8F5EE',
    ink: '#2B2118',
    accent: '#A8472A',
  },
  {
    id: 'granite',
    name: 'Leadville Granite',
    tagline: 'Shale Slate & Signal Orange',
    canvas: '#ECEFF1',
    ink: '#151B20',
    accent: '#E55B24',
  },
  {
    id: 'nocturne',
    name: 'Timberline Nocturne',
    tagline: 'Alpine Night & Campfire',
    canvas: '#121615',
    ink: '#F4F1EA',
    accent: '#E66838',
  },
];

export const JournalPaletteSwitcher: React.FC<JournalPaletteSwitcherProps> = ({
  currentPalette,
  onSelectPalette,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (paletteId: JournalPalette) => {
    if (onSelectPalette) {
      onSelectPalette(paletteId);
    }
    if (typeof document !== 'undefined') {
      document.cookie = `bb_journal_palette=${paletteId}; path=/; max-age=604800; SameSite=Lax`;
    }
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('palette', paletteId);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  return (
    <div
      aria-label="Direction A Color Palette Selector"
      className="w-full rounded-2xl p-4 sm:p-5 border shadow-sm transition-all"
      style={{
        backgroundColor: 'var(--journal-surface)',
        borderColor: 'var(--journal-border)',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-sans font-bold uppercase tracking-[0.15em]"
              style={{ color: 'var(--journal-accent)' }}
            >
              Direction A Colorways
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold"
              style={{
                borderColor: 'var(--journal-border)',
                color: 'var(--journal-muted)',
              }}
            >
              5 Landscapes
            </span>
          </div>
          <p
            className="text-xs font-sans"
            style={{ color: 'var(--journal-muted)' }}
          >
            Explore different Colorado outfitter atmospheres. Click any palette to preview live.
          </p>
        </div>

        {/* Palette Pill Options */}
        <div className="flex flex-wrap items-center gap-2">
          {JOURNAL_PALETTES.map((p) => {
            const isSelected = currentPalette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p.id)}
                aria-pressed={isSelected}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 shadow-sm'
                    : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--journal-canvas)' : 'transparent',
                  borderColor: isSelected ? 'var(--journal-accent)' : 'var(--journal-border)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {/* 3-Dot Swatch Matrix: Canvas, Ink, Accent */}
                <span className="flex items-center -space-x-1 shrink-0">
                  <span
                    className="w-3 h-3 rounded-full border border-black/10 inline-block shadow-xs"
                    style={{ backgroundColor: p.canvas }}
                    title={`Canvas: ${p.canvas}`}
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-black/10 inline-block shadow-xs"
                    style={{ backgroundColor: p.ink }}
                    title={`Ink: ${p.ink}`}
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-black/10 inline-block shadow-xs"
                    style={{ backgroundColor: p.accent }}
                    title={`Accent: ${p.accent}`}
                  />
                </span>

                <div className="leading-tight">
                  <span
                    className="text-xs font-sans font-bold block"
                    style={{
                      color: isSelected ? 'var(--journal-accent)' : 'var(--journal-ink)',
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="text-[10px] font-sans block"
                    style={{ color: 'var(--journal-muted)' }}
                  >
                    {p.tagline}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
