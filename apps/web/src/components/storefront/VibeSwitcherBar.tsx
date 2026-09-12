'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export type StorefrontVibe =
  | 'field_workshop'
  | 'alpine_minimal'
  | 'hardware_vault'
  | 'noir_minimal'
  | 'cartographer_dispatch'
  | 'brutalist_foundry'
  | 'wabi_sabi'
  | 'swiss_modernist'
  | 'seventies_retro';

interface VibeSwitcherBarProps {
  activeVibe: StorefrontVibe;
  onSelectVibe: (vibe: StorefrontVibe) => void;
}

interface VibeMeta {
  label: string;
  name: string;
  icon: string;
  fontBadge: string;
  paletteBadge: string;
  summary: string;
  reference: string;
}

const VIBE_METADATA: Record<StorefrontVibe, VibeMeta> = {
  noir_minimal: {
    label: 'Option D',
    name: 'Noir Minimalist',
    icon: '🖤',
    fontBadge: 'Playfair Display + Plus Jakarta Sans',
    paletteBadge: '100% Pure Black (#000000) & Stark White',
    summary: 'Full-screen 100vh viewport hero, zero tech clutter, stark luxury editorial serif & borderless gallery.',
    reference: 'Veilance · High-End Minimalist Luxury Editorial',
  },
  field_workshop: {
    label: 'Option A',
    name: 'Field Workshop',
    icon: '🏕️',
    fontBadge: 'Oswald + Courier Prime',
    paletteBadge: 'Canvas Tan & Blaze Orange',
    summary: 'Asymmetric editorial craft hero, workshop tag stamps, stitched product cards & maker bench.',
    reference: 'Filson · Topo Designs · Mystery Ranch',
  },
  alpine_minimal: {
    label: 'Option B',
    name: 'Alpine Minimal',
    icon: '🏔️',
    fontBadge: 'Space Grotesk + JetBrains Mono',
    paletteBadge: 'Glacier Obsidian & Technical Cyan',
    summary: 'Panoramic high-contrast hero banner, monospace telemetry ticker & 3-column spec matrices (20k/20k).',
    reference: 'Arc’teryx Veilance · Hyperlite Mountain Gear',
  },
  hardware_vault: {
    label: 'Option C',
    name: 'Hardware Vault',
    icon: '⚡',
    fontBadge: 'Chakra Petch + Share Tech Mono',
    paletteBadge: 'Tarmac & High-Voltage Amber',
    summary: 'Top-fold blueprint catalog, live batch telemetry & cut countdown bar, and stock level progress meters.',
    reference: 'Vollebak · Acronym · Teenage Engineering',
  },
  cartographer_dispatch: {
    label: 'Option E',
    name: 'Cartographer & Field Dispatch',
    icon: '📜',
    fontBadge: 'Fraunces + Special Elite',
    paletteBadge: 'Archival Charcoal & Topo Green',
    summary: 'Split-page expedition dispatch journal, brass pins, surveyor coordinates & topographic isolines.',
    reference: 'Field Notes · USGS Surveys · Archival Field Journals',
  },
  brutalist_foundry: {
    label: 'Option F',
    name: 'The Brutalist Foundry',
    icon: '🏗️',
    fontBadge: 'Anton + Chivo Mono',
    paletteBadge: 'Cast Concrete & Safety Yellow',
    summary: 'Wall-to-wall massive headlines, raw industrial crop marks, stamped tensile psi ratings & steel badges.',
    reference: 'Carhartt WIP · Heavy Machinery Manuals · Architectural Brutalism',
  },
  wabi_sabi: {
    label: 'Option G',
    name: 'Wabi-Sabi Mountain Sanctuary',
    icon: '🎋',
    fontBadge: 'Shippori Mincho + Plus Jakarta',
    paletteBadge: 'Natural Plant Indigo & Raw Linen',
    summary: 'Meditative negative space, sashiko stitching accents, contemplative slow craft & mountain solitude.',
    reference: 'Visvim · And Wander · Snow Peak · Engineered Garments',
  },
  swiss_modernist: {
    label: 'Option H',
    name: 'Swiss International Grid',
    icon: '📐',
    fontBadge: 'Space Grotesk + IBM Plex Mono',
    paletteBadge: 'Deep Slate, Pure White & Klein Blue',
    summary: 'Strict 8-column mathematical poster grid, 7:5 modular ratio R2 hero & extreme typographic contrast.',
    reference: 'Josef Müller-Brockmann · Dieter Rams (Braun) · Vignelli',
  },
  seventies_retro: {
    label: 'Option I',
    name: '1970s Golden Era Backcountry',
    icon: '🏔️',
    fontBadge: 'Fraunces 900 + Courier Prime',
    paletteBadge: 'Vintage Dark Forest, Mustard & Rust',
    summary: '1974 vintage catalog cover layout, tri-color retro stripe ribbon, Kodachrome film grade & clean climbing ethos.',
    reference: 'Chouinard 1972 Clean Climbing · Early Patagonia · 70s Yosemite',
  },
};

const ORDERED_VIBES: StorefrontVibe[] = [
  'noir_minimal',
  'field_workshop',
  'alpine_minimal',
  'hardware_vault',
  'cartographer_dispatch',
  'brutalist_foundry',
  'wabi_sabi',
  'swiss_modernist',
  'seventies_retro',
];

export const VibeSwitcherBar: React.FC<VibeSwitcherBarProps> = ({ activeVibe, onSelectVibe }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const current = VIBE_METADATA[activeVibe] || VIBE_METADATA.field_workshop;

  // Fully minimized mode: unobtrusive tiny floating icon in bottom-right corner
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          title="Open Design Vibe Switcher"
          aria-label="Open Design Vibe Switcher"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-stone-900/95 hover:bg-stone-800 text-stone-100 border border-stone-700/80 shadow-2xl backdrop-blur-md text-xs font-mono transition-all hover:scale-105"
        >
          <span>{current.icon}</span>
          <span className="font-bold">{current.label}: {current.name}</span>
          <span className="text-[10px] text-stone-400 bg-stone-800 px-1.5 py-0.5 rounded">9 Vibes 🎨</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded Popover Modal */}
      {isOpen && (
        <div className="mb-3 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl bg-stone-950/95 border border-stone-800 shadow-2xl backdrop-blur-xl p-5 space-y-4 text-stone-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                Design Vibe Lab (9 Archetypes)
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close vibe menu"
              className="text-stone-400 hover:text-white text-xs font-mono p-1 rounded hover:bg-stone-800/60"
            >
              ✕ Close
            </button>
          </div>

          <p className="text-[11px] text-stone-400 leading-relaxed">
            Select any archetype below to instantly swap the entire storefront experience—including typography, bespoke header, full-screen hero, product catalog cards, and footer.
          </p>

          <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
            {ORDERED_VIBES.map((vibe) => {
              const meta = VIBE_METADATA[vibe];
              const isActive = activeVibe === vibe;

              return (
                <button
                  key={vibe}
                  onClick={() => {
                    onSelectVibe(vibe);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isActive
                      ? 'bg-stone-900 border-white/50 shadow-lg ring-1 ring-white/20'
                      : 'bg-stone-900/40 border-stone-800/80 hover:border-stone-700 hover:bg-stone-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span>{meta.icon}</span>
                      <span className={isActive ? 'text-white' : 'text-stone-300'}>
                        {meta.label}: {meta.name}
                      </span>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-stone-400 leading-snug">{meta.summary}</p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700/60">
                      🔤 {meta.fontBadge}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700/60">
                      🎨 {meta.paletteBadge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
            <Link
              href="/about"
              className="hover:text-white transition-colors underline underline-offset-2 flex items-center gap-1"
            >
              <span>The Maker&apos;s Story (/about) →</span>
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(true);
              }}
              className="text-stone-500 hover:text-stone-300"
            >
              Minimize Dock
            </button>
          </div>
        </div>
      )}

      {/* Sleek Floating Dock Pill */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-stone-950/90 border border-stone-700/80 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-800 text-stone-100 text-xs font-mono transition-colors"
        >
          <span>{current.icon}</span>
          <span className="font-bold">{current.label}: {current.name}</span>
          <span className="text-stone-400 text-[11px]">{isOpen ? '▲' : '▼'}</span>
        </button>

        <button
          onClick={() => setIsMinimized(true)}
          title="Minimize switcher to tiny button"
          aria-label="Minimize switcher"
          className="w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-stone-800 text-xs transition-colors"
        >
          —
        </button>
      </div>
    </div>
  );
};
