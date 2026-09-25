'use client';

import React, { useState } from 'react';
import { MobileNav } from './MobileNav';

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
}

export interface SiteHeaderProps {
  title?: string;
  subtitle?: string;
  navItems?: NavItem[];
  cartCount?: number;
  className?: string;
  logoSrc?: string;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  title = 'BankBeaters',
  subtitle = 'Adventure Gear · Curiosity > Fear',
  navItems = [
    { label: 'Field Gear', href: '/products' },
    { label: 'The Workshop', href: '/about' },
    { label: 'Drop Schedule', href: '/drops' },
  ],
  cartCount = 0,
  className = '',
  logoSrc = '/media/hero/bank-beaters-logo-white.png',
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header
        className={`sticky top-0 z-30 w-full border-b border-[#3A2E24]/70 bg-[#1E1813]/95 backdrop-blur-md transition-colors ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Wordmark */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2 group min-h-[44px] min-w-[44px] py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8472A] rounded-lg"
              aria-label="BankBeaters Adventure Gear Home"
            >
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={title}
                  className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
                />
              ) : null}
              <span className={logoSrc ? "sr-only" : "text-xl font-black tracking-wider uppercase font-mono text-[#A8472A] group-hover:text-amber-400 transition-colors"}>
                {title}
              </span>
            </a>
            {subtitle && (
              <span className="hidden lg:inline-block text-xs text-[#DDD0BE]/60 font-mono border-l border-[#3A2E24] pl-3">
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
                className="text-sm font-mono uppercase tracking-wider text-[#EFE8DC] hover:text-[#A8472A] transition-colors py-2 min-h-[44px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8472A] rounded"
              >
                {item.label}
              </a>
            ))}
            <a
              href="/cart"
              data-testid="header-cart-button"
              className="relative group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8472A] rounded-lg"
              aria-label={`View Gear Roll cart with ${cartCount} items`}
            >
              <span className="text-sm font-medium text-[#EFE8DC] bg-[#2A211A] px-3.5 py-2 rounded-lg border border-[#3A2E24] flex items-center gap-2 group-hover:border-[#A8472A]/60 transition-colors min-h-[44px]">
                <span className="font-mono text-xs uppercase tracking-wider font-semibold text-[#EFE8DC]">Gear Roll</span>
                <span className="bg-[#A8472A] text-white font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs inline-flex items-center justify-center font-mono">
                  {cartCount}
                </span>
              </span>
            </a>
          </nav>

          {/* Mobile Action Controls (Cart + Hamburger) */}
          <div className="flex items-center gap-3 md:hidden">
            <a
              href="/cart"
              data-testid="header-cart-button"
              className="relative flex items-center justify-center min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-[#2A211A] border border-[#3A2E24] text-[#EFE8DC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8472A]"
              aria-label={`View Gear Roll cart with ${cartCount} items`}
            >
              <span className="font-mono text-xs uppercase tracking-wider font-bold text-[#A8472A]">ROLL</span>
              <span className="absolute -top-1 -right-1 bg-[#A8472A] text-white font-bold min-w-[1.125rem] h-4.5 px-1 rounded-full text-[10px] inline-flex items-center justify-center font-mono">
                {cartCount}
              </span>
            </a>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-[#2A211A] border border-[#3A2E24] text-[#DDD0BE] hover:text-white hover:border-[#A8472A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8472A]"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-storefront-menu"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        navItems={navItems}
        cartCount={cartCount}
        title={title}
        subtitle={subtitle}
        logoSrc={logoSrc}
      />
    </>
  );
};

// Backwards compatibility alias
export const Header = SiteHeader;
