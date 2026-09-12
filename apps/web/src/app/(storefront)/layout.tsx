import type React from 'react';
import type { Metadata } from 'next';
import { Header } from '@chrishop/ui';
import '../globals.css';

export const metadata: Metadata = {
  title: 'BankBeaters Adventure Gear | Curiosity > Fear',
  description:
    'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris for anglers and explorers who work the bank on foot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#15191E] text-stone-100 antialiased">
        <Header
          title="BankBeaters"
          subtitle="Adventure Gear · Curiosity > Fear"
          navItems={[
            { label: 'Active Drops', href: '/' },
            { label: 'All Gear', href: '/products' },
            { label: 'Outerwear', href: '/products?category=outerwear' },
            { label: 'Packs & Carry', href: '/products?category=packs-carry' },
            { label: 'Field Accessories', href: '/products?category=field-accessories' },
            { label: "The Maker's Story", href: '/about' },
            { label: 'The Maker’s Bench', href: '/#makers-bench' },
          ]}
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
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
      </body>
    </html>
  );
}
