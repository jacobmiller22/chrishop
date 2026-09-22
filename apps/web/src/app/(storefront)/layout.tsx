import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Header, Footer } from '@chrishop/ui';
import '../globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

import { defaultStorefrontMetadata } from '@/lib/metadata';

export const metadata: Metadata = defaultStorefrontMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#0F1215] text-[#E7E4DC] antialiased selection:bg-[#E55B24] selection:text-white overflow-x-hidden">
        {/* WCAG 2.1 AA Accessible Skip Navigation */}
        <nav aria-label="Skip navigation" className="text-xs">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-[#E55B24] text-white px-4 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider font-bold shadow-2xl focus:outline-none focus:ring-2 focus:ring-white min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            Skip to main content
          </a>
        </nav>

        <Header
          title="BankBeaters"
          subtitle="Adventure Gear · Curiosity > Fear"
          navItems={[
            { label: 'Active Drops', href: '/' },
            { label: 'Drop Schedule', href: '/drops' },
            { label: 'Field Gear', href: '/products' },
            { label: 'The Maker’s Story', href: '/about' },
            { label: 'The Maker’s Bench', href: '/#makers-bench' },
          ]}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none"
        >
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

