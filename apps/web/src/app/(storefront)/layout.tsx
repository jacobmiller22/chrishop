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
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

