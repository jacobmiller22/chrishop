'use client';

import React from 'react';
import Link from 'next/link';

export type StorefrontVibe = 'field_workshop' | 'alpine_minimal' | 'hardware_vault';

interface VibeSwitcherBarProps {
  activeVibe: StorefrontVibe;
  onSelectVibe: (vibe: StorefrontVibe) => void;
}

const VIBE_METADATA: Record<
  StorefrontVibe,
  { label: string; icon: string; subtitle: string; tag: string }
> = {
  field_workshop: {
    label: 'Option A: Field Workshop',
    icon: '🏕️',
    subtitle: 'Asymmetric editorial split hero, Leadville workshop tags, craft narrative & staggered drop cards',
    tag: 'Filson · Topo Designs · Mystery Ranch',
  },
  alpine_minimal: {
    label: 'Option B: Alpine Minimal',
    icon: '🏔️',
    subtitle: 'Full-bleed panoramic R2 hero banner, precision monospace spec matrices & high-contrast obsidian base',
    tag: 'Arc’teryx Veilance · Hyperlite Mountain Gear',
  },
  hardware_vault: {
    label: 'Option C: Hardware Vault',
    icon: '⚡',
    subtitle: 'Dense blueprint catalog at top fold, live batch stock meters & telemetry (R2 hero anchored in /about)',
    tag: 'Vollebak · Acronym · Teenage Engineering',
  },
};

export const VibeSwitcherBar: React.FC<VibeSwitcherBarProps> = ({ activeVibe, onSelectVibe }) => {
  const currentMeta = VIBE_METADATA[activeVibe] || VIBE_METADATA.field_workshop;

  return (
    <aside aria-label="Storefront Design Vibe Switcher" className="sticky top-16 z-40 w-full bg-[#0F1215]/95 backdrop-blur-md border-b border-stone-800/90 shadow-2xl py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Switcher Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5 mr-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#E55B24] animate-pulse" />
            Vibe Switcher:
          </span>

          {(['field_workshop', 'alpine_minimal', 'hardware_vault'] as const).map((vibe) => {
            const meta = VIBE_METADATA[vibe];
            const isActive = activeVibe === vibe;
            return (
              <button
                key={vibe}
                onClick={() => onSelectVibe(vibe)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#E55B24] text-stone-950 font-bold border-[#E55B24] shadow-md shadow-orange-950/50 scale-[1.02]'
                    : 'bg-stone-900/80 text-stone-300 border-stone-800 hover:border-stone-700 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Current Vibe Context & About Us Shortcut */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden lg:flex items-center gap-2 text-stone-400">
            <span className="text-stone-300 font-semibold">{currentMeta.subtitle}</span>
            <span className="text-stone-600">|</span>
            <span className="text-stone-500 italic">Ref: {currentMeta.tag}</span>
          </div>

          <Link
            href="/about"
            className="text-stone-400 hover:text-[#E55B24] transition-colors whitespace-nowrap flex items-center gap-1 underline underline-offset-4"
          >
            <span>The Maker&apos;s Story (/about) →</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};
