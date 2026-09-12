'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface StorefrontLayoutShellProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

export const StorefrontLayoutShell: React.FC<StorefrontLayoutShellProps> = ({
  header,
  children,
}) => {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  if (isHomepage) {
    // The homepage owns the entire screen from pixel 0 to footer
    // with its own bespoke archetype header, full-bleed hero, and archetype footer.
    return <>{children}</>;
  }

  // Non-homepage catalog routes (/products, /about, /cart, etc.)
  // render the standard @chrishop/ui Header, container, and footer.
  return (
    <div className="min-h-screen flex flex-col bg-[#15191E] text-stone-100 antialiased">
      {header}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
      <footer className="border-t border-stone-800/80 py-8 text-center text-xs text-stone-500 space-y-2 bg-[#101317]">
        <div className="flex items-center justify-center gap-3 font-mono text-stone-400">
          <span className="font-bold text-[#E55B24]">BANKBEATERS</span>
          <span>·</span>
          <span>Hand-Crafted Technical Outdoor Gear</span>
          <span>·</span>
          <span className="italic">Curiosity &gt; Fear</span>
        </div>
        <p>© {new Date().getFullYear()} BankBeaters Adventure Gear. All pieces hand-sewn in workshop. Lifetime repair guarantee.</p>
      </footer>
    </div>
  );
};
