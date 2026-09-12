import type React from 'react';
import type { Metadata } from 'next';
import { Header } from '@chrishop/ui';
import '../globals.css';
import { StorefrontLayoutShell } from '@/components/storefront/StorefrontLayoutShell';

export const metadata: Metadata = {
  title: 'BankBeaters Adventure Gear | Curiosity > Fear',
  description:
    'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris for anglers and explorers who work the bank on foot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col antialiased bg-black text-white selection:bg-white selection:text-black">
        <StorefrontLayoutShell
          header={
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
          }
        >
          <main className="w-full flex-1">
            {children}
          </main>
        </StorefrontLayoutShell>
      </body>
    </html>
  );
}
