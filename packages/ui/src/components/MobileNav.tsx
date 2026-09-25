'use client';

import React, { useEffect, useRef } from 'react';

export interface MobileNavItem {
  label: string;
  href: string;
  badge?: string;
}

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navItems?: MobileNavItem[];
  cartCount?: number;
  title?: string;
  subtitle?: string;
  logoSrc?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  navItems = [
    { label: 'Field Gear', href: '/products' },
    { label: 'The Workshop', href: '/about' },
    { label: 'Drop Schedule', href: '/drops' },
  ],
  cartCount = 0,
  title = 'BankBeaters',
  subtitle = 'Leadville, CO · Elev. 10,152 ft',
  logoSrc = '/media/hero/bank-beaters-logo-white.png',
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Auto focus the close button when opened
      closeButtonRef.current?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
      id="mobile-storefront-menu"
      className="fixed inset-0 z-[70] md:hidden"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-xs bg-[#1A1613] border-l border-[#3A2E24] p-6 pt-20 shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform ease-in-out duration-300">
        <div className="space-y-6">
          {/* Drawer Header with Title and Accessible Close Button */}
          <div className="flex items-center justify-between pb-4 border-b border-[#3A2E24]/80">
            <div>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={title}
                  className="h-7 w-auto object-contain mb-1.5"
                />
              ) : null}
              <span className={logoSrc ? "sr-only" : "text-lg font-black uppercase font-mono text-[#A8472A] tracking-wider block"}>
                {title}
              </span>
              <span className="text-[11px] font-mono text-[#DDD0BE]/60 uppercase tracking-widest block">
                {subtitle}
              </span>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-[#2A211A] border border-[#3A2E24] text-[#DDD0BE] hover:text-white hover:border-[#A8472A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8472A]"
              aria-label="Close navigation menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Mobile Site Links">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider font-mono text-[#EFE8DC] hover:bg-[#2A211A] hover:text-[#A8472A] transition-colors min-h-[44px]"
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-mono bg-amber-950/60 text-[#A8472A] border border-[#A8472A]/50 px-2 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>

          {/* Gear Roll (Cart) Link */}
          <div className="pt-2">
            <a
              href="/cart"
              onClick={onClose}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2A211A] border border-[#3A2E24] text-[#EFE8DC] hover:border-[#A8472A]/60 transition-colors min-h-[44px]"
              aria-label={`View Gear Roll cart with ${cartCount} items`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A8472A]">
                  [ ROLL ]
                </span>
                <span className="text-sm font-mono font-bold uppercase tracking-wider text-[#EFE8DC]">
                  Gear Roll
                </span>
              </div>
              <span className="bg-[#A8472A] text-white font-bold min-w-[1.5rem] h-6 px-2 rounded-full text-xs inline-flex items-center justify-center font-mono">
                {cartCount}
              </span>
            </a>
          </div>
        </div>

        {/* Drawer Footer with Craft Origin */}
        <div className="pt-6 border-t border-[#3A2E24]/80 space-y-2 text-xs font-mono text-[#DDD0BE]/70">
          <div className="flex items-center justify-between">
            <span className="text-[#DDD0BE]/50 uppercase tracking-widest text-[10px]">Origin</span>
            <span className="text-[#EFE8DC]">Leadville, CO · 10,152 FT</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#DDD0BE]/50 uppercase tracking-widest text-[10px]">Motto</span>
            <span className="text-[#A8472A] font-bold">Curiosity &gt; Fear</span>
          </div>
        </div>
      </div>
    </div>
  );
};
