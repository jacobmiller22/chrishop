'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type DesignDirection = 'a' | 'b' | 'c';

export interface DirectionSwitcherProps {
  currentDirection: DesignDirection;
}

export const DirectionSwitcher: React.FC<DirectionSwitcherProps> = ({ currentDirection }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setDirection = (dir: DesignDirection) => {
    // Set cookie for persistence across navigation
    if (typeof document !== 'undefined') {
      document.cookie = `bb_design_direction=${dir}; path=/; max-age=604800; SameSite=Lax`;
    }
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('direction', dir);
    router.push(`/?${params.toString()}`);
  };

  const directions: { id: DesignDirection; label: string; badge: string; desc: string }[] = [
    {
      id: 'a',
      label: 'Direction A',
      badge: 'Alpine Journal',
      desc: 'Warm Ecru · Kinfolk Craft',
    },
    {
      id: 'b',
      label: 'Direction B',
      badge: 'Riverbank Utility',
      desc: 'Washed Granite · Mail-Order Outfitter',
    },
    {
      id: 'c',
      label: 'Direction C',
      badge: 'Workshop Spec',
      desc: 'Leadville Charcoal · Blueprint Cutting Board',
    },
  ];

  return (
    <aside
      aria-label="Design Direction Switcher"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[95%] sm:w-auto"
    >
      <div className="bg-[#121518]/95 backdrop-blur-xl border border-stone-700/80 rounded-2xl p-1.5 sm:p-2 shadow-2xl flex items-center justify-between sm:justify-center gap-1 sm:gap-2">
        <div className="hidden sm:flex items-center gap-2 pl-2 pr-1 border-r border-stone-800 text-[11px] font-mono uppercase tracking-wider text-stone-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Preview Mode</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
          {directions.map((d) => {
            const isActive = currentDirection === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirection(d.id)}
                className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-mono transition-all text-center ${
                  isActive
                    ? 'bg-[#E55B24] text-white font-bold shadow-lg shadow-orange-950/40 ring-1 ring-orange-400/50'
                    : 'bg-stone-900/60 text-stone-300 hover:text-white hover:bg-stone-800/80'
                }`}
              >
                <div className="font-bold uppercase tracking-wider leading-none text-[11px] sm:text-xs">
                  {d.label}
                </div>
                <div className="text-[10px] opacity-80 font-normal truncate mt-0.5">
                  {d.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
