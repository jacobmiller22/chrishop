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
    { label: 'Equipment Vault', href: '/products' },
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
      className="fixed inset-0 z-40 md:hidden"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xs bg-[#101317] border-l border-stone-800 p-6 pt-20 shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform ease-in-out duration-300">
        <div className="space-y-6">
          {/* Drawer Header with Title and Accessible Close Button */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-800/80">
            <div>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={title}
                  className="h-7 w-auto object-contain mb-1.5"
                />
              ) : null}
              <span className={logoSrc ? "sr-only" : "text-lg font-black uppercase font-mono text-[#E55B24] tracking-wider block"}>
                {title}
              </span>
              <span className="text-[11px] font-mono text-stone-500 uppercase tracking-widest block">
                {subtitle}
              </span>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-[#15191E] border border-stone-800 text-stone-400 hover:text-white hover:border-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24]"
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
                className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider font-mono text-stone-200 hover:bg-[#15191E] hover:text-[#E55B24] transition-colors min-h-[44px]"
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-mono bg-orange-950/80 text-[#E55B24] border border-orange-800/80 px-2 py-0.5 rounded">
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
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#15191E] border border-stone-800 text-stone-100 hover:border-[#E55B24]/50 transition-colors min-h-[44px]"
              aria-label={`View Gear Roll cart with ${cartCount} items`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#E55B24]">
                  [ ROLL ]
                </span>
                <span className="text-sm font-mono font-bold uppercase tracking-wider text-stone-200">
                  Gear Roll
                </span>
              </div>
              <span className="bg-[#E55B24] text-white font-bold min-w-[1.5rem] h-6 px-2 rounded-full text-xs inline-flex items-center justify-center font-mono">
                {cartCount}
              </span>
            </a>
          </div>
        </div>

        {/* Drawer Footer with Craft Origin */}
        <div className="pt-6 border-t border-stone-800/80 space-y-2 text-xs font-mono text-stone-400">
          <div className="flex items-center justify-between">
            <span className="text-stone-500 uppercase tracking-widest text-[10px]">Origin</span>
            <span className="text-stone-300">Leadville, CO · 10,152 FT</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500 uppercase tracking-widest text-[10px]">Motto</span>
            <span className="text-[#E55B24] font-bold">Curiosity &gt; Fear</span>
          </div>
        </div>
      </div>
    </div>
  );
};
