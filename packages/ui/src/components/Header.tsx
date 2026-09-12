import React from 'react';

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
    { label: 'Adventure Gear', href: '/products' },
    { label: 'Outerwear', href: '/products?category=outerwear' },
    { label: 'Packs & Carry', href: '/products?category=packs-carry' },
    { label: 'Field Accessories', href: '/products?category=field-accessories' },
    { label: 'The Maker’s Bench', href: '/#makers-bench' },
  ],
  cartCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-800/80 bg-[#15191E]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-black tracking-wider uppercase font-mono text-[#E55B24] group-hover:text-orange-400 transition-colors">
              {title}
            </span>
          </a>
          {subtitle && (
            <span className="hidden md:inline-block text-xs text-stone-400 font-mono border-l border-stone-800 pl-3">
              {subtitle}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-stone-300 hover:text-[#E55B24] transition-colors"
            >
              {item.label}
            </a>
          ))}
          <a
            href="/cart"
            className="relative group block"
            aria-label={`View Gear Roll cart with ${cartCount} items`}
          >
            <span className="text-sm font-medium text-stone-200 bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800 flex items-center gap-2 group-hover:border-[#E55B24]/50 transition-colors">
              <span>🎒 Gear Roll</span>
              <span className="bg-[#E55B24] text-white font-bold min-w-[1.25rem] h-5 px-1 rounded-full text-xs inline-flex items-center justify-center">
                {cartCount}
              </span>
            </span>
          </a>
        </nav>
      </div>
    </header>
  );
};
