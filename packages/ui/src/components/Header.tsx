'use client';

import React, { useState } from 'react';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  navItems?: Array<{ label: string; href: string }>;
  cartCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'BankBeaters',
  subtitle = 'Adventure Gear · Curiosity > Fear',
  navItems = [
    { label: 'Active Drops', href: '/' },
    { label: 'Field Gear', href: '/products' },
    { label: 'The Maker’s Story', href: '/about' },
    { label: 'The Maker’s Bench', href: '/#makers-bench' },
  ],
  cartCount = 0,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-800/80 bg-[#15191E]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 group min-h-[44px] min-w-[44px] py-2"
            aria-label="BankBeaters Adventure Gear Home"
          >
            <span className="text-xl font-black tracking-wider uppercase font-mono text-[#E55B24] group-hover:text-orange-400 transition-colors">
              {title}
            </span>
          </a>
          {subtitle && (
            <span className="hidden lg:inline-block text-xs text-stone-400 font-mono border-l border-stone-800 pl-3">
              {subtitle}
            </span>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-stone-300 hover:text-[#E55B24] transition-colors py-2 min-h-[44px] flex items-center"
            >
              {item.label}
            </a>
          ))}
          <a
            href="/cart"
            className="relative group block"
            aria-label={`View Gear Roll cart with ${cartCount} items`}
          >
            <span className="text-sm font-medium text-stone-200 bg-[#101317] px-3.5 py-2 rounded-lg border border-stone-800 flex items-center gap-2 group-hover:border-[#E55B24]/50 transition-colors min-h-[44px]">
              <span>🎒 Gear Roll</span>
              <span className="bg-[#E55B24] text-white font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs inline-flex items-center justify-center">
                {cartCount}
              </span>
            </span>
          </a>
        </nav>

        {/* Mobile Action Controls (Cart + Hamburger) */}
        <div className="flex items-center gap-3 md:hidden">
          <a
            href="/cart"
            className="relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-[#101317] border border-stone-800 text-stone-200"
            aria-label={`View Gear Roll cart with ${cartCount} items`}
          >
            <span className="text-base">🎒</span>
            <span className="absolute -top-1 -right-1 bg-[#E55B24] text-white font-bold min-w-[1.125rem] h-4.5 px-1 rounded-full text-[10px] inline-flex items-center justify-center">
              {cartCount}
            </span>
          </a>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-[#101317] border border-stone-800 text-stone-300 hover:text-white hover:border-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24]"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-storefront-menu"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-storefront-menu"
          className="md:hidden border-t border-stone-800/80 bg-[#101317] px-4 pt-3 pb-6 space-y-2 shadow-2xl animate-in slide-in-from-top duration-200"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-base font-medium text-stone-200 hover:bg-[#15191E] hover:text-[#E55B24] transition-colors min-h-[44px] flex items-center"
            >
              {item.label}
            </a>
          ))}
          <div className="pt-3 border-t border-stone-800/60 flex items-center justify-between text-xs font-mono text-stone-400 px-3">
            <span>Leadville, CO · Elev. 10,152 ft</span>
            <span className="text-[#E55B24] font-bold">Curiosity &gt; Fear</span>
          </div>
        </div>
      )}
    </header>
  );
};
