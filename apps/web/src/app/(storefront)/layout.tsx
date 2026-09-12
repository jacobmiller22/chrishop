import type React from 'react';
import type { Metadata } from 'next';
import { Header } from '@chrishop/ui';
import '../globals.css';

export const metadata: Metadata = {
  title: "Chris's Shop | Exclusive Art & Limited Drops",
  description: 'Handcrafted sculptures, prints, and exclusive art drops by Chris.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
        <Header
          navItems={[
            { label: 'Featured', href: '/' },
            { label: 'Shop Catalog', href: '/products' },
            { label: 'Sculptures', href: '/products?category=sculptures' },
            { label: 'Prints', href: '/products?category=prints' },
            { label: 'Wearables', href: '/products?category=wearables' },
          ]}
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Chris&apos;s Shop. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
