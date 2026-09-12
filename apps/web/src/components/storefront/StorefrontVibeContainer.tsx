'use client';

import React, { useState, useEffect } from 'react';
import type { StorefrontProduct } from '@/lib/catalog';
import { VibeSwitcherBar, type StorefrontVibe } from './VibeSwitcherBar';
import { FieldWorkshopLayout } from './layouts/FieldWorkshopLayout';
import { AlpineMinimalLayout } from './layouts/AlpineMinimalLayout';
import { HardwareVaultLayout } from './layouts/HardwareVaultLayout';
import { NoirMinimalLayout } from './layouts/NoirMinimalLayout';
import { CartographerDispatchLayout } from './layouts/CartographerDispatchLayout';
import { BrutalistFoundryLayout } from './layouts/BrutalistFoundryLayout';
import { WabiSabiLayout } from './layouts/WabiSabiLayout';
import { SwissModernistLayout } from './layouts/SwissModernistLayout';
import { SeventiesRetroLayout } from './layouts/SeventiesRetroLayout';

const VALID_VIBES: Set<StorefrontVibe> = new Set([
  'field_workshop',
  'alpine_minimal',
  'hardware_vault',
  'noir_minimal',
  'cartographer_dispatch',
  'brutalist_foundry',
  'wabi_sabi',
  'swiss_modernist',
  'seventies_retro',
]);

interface StorefrontVibeContainerProps {
  products: StorefrontProduct[];
  initialVibe?: StorefrontVibe;
}

export const StorefrontVibeContainer: React.FC<StorefrontVibeContainerProps> = ({
  products,
  initialVibe = 'field_workshop',
}) => {
  const [activeVibe, setActiveVibe] = useState<StorefrontVibe>(initialVibe);

  useEffect(() => {
    // Check URL searchParams for ?vibe=
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlVibe = params.get('vibe') as StorefrontVibe | null;
      if (urlVibe && VALID_VIBES.has(urlVibe)) {
        setActiveVibe(urlVibe);
        return;
      }

      // Check cookie for persistent vibe preference
      const cookieMatch = document.cookie.match(/(?:^|;\s*)chrishop_storefront_vibe=([^;]+)/);
      const cookieVibe = cookieMatch?.[1] as StorefrontVibe | undefined;
      if (cookieVibe && VALID_VIBES.has(cookieVibe)) {
        setActiveVibe(cookieVibe);
      }
    }
  }, []);

  const handleSelectVibe = (vibe: StorefrontVibe) => {
    setActiveVibe(vibe);
    if (typeof window !== 'undefined') {
      // Update cookie
      document.cookie = `chrishop_storefront_vibe=${vibe};path=/;max-age=31536000`;

      // Update URL query param cleanly without reloading
      const url = new URL(window.location.href);
      url.searchParams.set('vibe', vibe);
      window.history.pushState({}, '', url.toString());
    }
  };

  return (
    <div className="min-h-screen w-full relative">
      {/* Interactive Minimizable Switcher Dock */}
      <VibeSwitcherBar activeVibe={activeVibe} onSelectVibe={handleSelectVibe} />

      {/* Render Active Archetype */}
      {activeVibe === 'field_workshop' && <FieldWorkshopLayout products={products} />}
      {activeVibe === 'alpine_minimal' && <AlpineMinimalLayout products={products} />}
      {activeVibe === 'hardware_vault' && <HardwareVaultLayout products={products} />}
      {activeVibe === 'noir_minimal' && <NoirMinimalLayout products={products} />}
      {activeVibe === 'cartographer_dispatch' && <CartographerDispatchLayout products={products} />}
      {activeVibe === 'brutalist_foundry' && <BrutalistFoundryLayout products={products} />}
      {activeVibe === 'wabi_sabi' && <WabiSabiLayout products={products} />}
      {activeVibe === 'swiss_modernist' && <SwissModernistLayout products={products} />}
      {activeVibe === 'seventies_retro' && <SeventiesRetroLayout products={products} />}
    </div>
  );
};
