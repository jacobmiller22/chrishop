import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Header, Footer } from '@chrishop/ui';
import '../globals.css';
import { WebVitalsReporter } from '../../components/storefront/WebVitalsReporter';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

import { defaultStorefrontMetadata } from '@/lib/metadata';

export const metadata: Metadata = defaultStorefrontMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="waxed-cedar-theme">
      <body className="min-h-screen flex flex-col bg-[#F8F5EE] text-[#2B2118] antialiased selection:bg-[#A8472A] selection:text-white overflow-x-hidden">
        {/* WCAG 2.1 AA Accessible Skip Navigation */}
        <nav aria-label="Skip navigation" className="text-xs">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-[#A8472A] text-white px-4 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider font-bold shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#2B2118] min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            Skip to main content
          </a>
        </nav>

        <Header
          title="BankBeaters"
          subtitle="Adventure Gear · Curiosity > Fear"
          navItems={[
            { label: 'Equipment Vault', href: '/products' },
            { label: 'The Workshop', href: '/about' },
            { label: 'Drop Schedule', href: '/drops' },
          ]}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none"
        >
          {children}
        </main>
        <WebVitalsReporter />
        <Footer />
      </body>
    </html>
  );
}

