import React from 'react';

export interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer className={`border-t border-stone-800/80 bg-[#101317] text-stone-400 py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono uppercase tracking-wider text-[#E55B24]">
                BankBeaters
              </span>
              <span className="text-xs font-mono text-stone-500 uppercase">Adventure Gear</span>
            </div>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-sm">
              Patagonia-grade technical outerwear, convertible carry rigs, and field accessories
              hand-sewn by Chris in Leadville, Colorado (Elevation 10,152 ft).
            </p>
            <div className="text-xs font-mono text-stone-500 pt-1">
              <span>Motto: </span>
              <strong className="text-stone-300 italic font-semibold">&ldquo;Curiosity &gt; Fear&rdquo;</strong>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-200 font-bold">
              Field Equipment
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="/products" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  Complete Catalog
                </a>
              </li>
              <li>
                <a href="/products?category=outerwear" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  Waterproof Shells
                </a>
              </li>
              <li>
                <a href="/products?category=packs-carry" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  Packs &amp; Carry Systems
                </a>
              </li>
              <li>
                <a href="/products?category=field-accessories" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  Field Tools &amp; Accessories
                </a>
              </li>
            </ul>
          </div>

          {/* Workshop & Provenance */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-200 font-bold">
              Craft &amp; Origin
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="/about" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  The Maker&apos;s Story
                </a>
              </li>
              <li>
                <a href="/#makers-bench" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  The Workbench &amp; Juki Rig
                </a>
              </li>
              <li>
                <a href="/about#guarantee" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  Lifetime Repair Guarantee
                </a>
              </li>
              <li>
                <a href="/cart" className="hover:text-[#E55B24] transition-colors py-1 inline-block">
                  Gear Roll (Cart)
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-stone-500">
          <div>
            © {new Date().getFullYear()} BankBeaters Adventure Gear LLC · Leadville, CO · Single-Needle Lockstitched
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <span>Toray 3-Layer</span>
            <span>·</span>
            <span>500D Cordura®</span>
            <span>·</span>
            <span>X-Pac® VX21</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
