import React from 'react';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  navItems?: Array<{ label: string; href: string }>;
  cartCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title = "Chris's Shop",
  subtitle = "Exclusive drops & limited edition art",
  navItems = [
    { label: 'Shop Drops', href: '#' },
    { label: 'About Chris', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  cartCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            {title}
          </span>
          {subtitle && (
            <span className="hidden md:inline-block text-xs text-slate-400 border-l border-slate-800 pl-3">
              {subtitle}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors"
            >
              {item.label}
            </a>
          ))}
          <div className="relative">
            <span className="text-sm font-medium text-slate-200 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
              <span>🛒 Cart</span>
              <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-xs">
                {cartCount}
              </span>
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
};
