import React from 'react';

export interface SiteFooterProps {
  className?: string;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`border-t border-stone-800/80 bg-[#101317] text-stone-400 py-12 ${className}`}
      aria-label="Site Footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Provenance Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono uppercase tracking-wider text-[#E55B24]">
                BankBeaters
              </span>
              <span className="text-xs font-mono text-stone-500 uppercase">Adventure Gear</span>
            </div>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-sm">
              Patagonia-grade technical outerwear, convertible carry rigs, and field accessories
              hand-sewn by Chris in Leadville, Colorado (Elevation 10,152 ft). Built for the miles
              off-trail.
            </p>
            <div className="text-xs font-mono text-stone-400 pt-1 flex items-center gap-2">
              <span className="text-stone-500">Motto:</span>
              <strong className="text-stone-200 italic font-semibold">
                &ldquo;Curiosity &gt; Fear&rdquo;
              </strong>
            </div>

            {/* Social & Community Links */}
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-stone-500 block">
                Field Channels
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <a
                  href="https://instagram.com/bankbeaters"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                  aria-label="Follow BankBeaters on Instagram"
                >
                  Instagram ↗
                </a>
                <a
                  href="https://youtube.com/@bankbeaters"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                  aria-label="Subscribe to BankBeaters on YouTube"
                >
                  YouTube ↗
                </a>
                <a
                  href="mailto:chris@chrishop.jacobmiller22.com"
                  className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                  aria-label="Email Chris at the Leadville Workshop"
                >
                  Field Dispatch ✉
                </a>
              </div>
            </div>
          </div>

          {/* Quick Equipment Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-200 font-bold">
              Field Equipment
            </h4>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>
                <a
                  href="/products"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  Complete Catalog
                </a>
              </li>
              <li>
                <a
                  href="/drops"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  Scheduled Drops
                </a>
              </li>
              <li>
                <a
                  href="/products?category=outerwear"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  Waterproof Shells
                </a>
              </li>
              <li>
                <a
                  href="/products?category=packs-carry"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  Packs &amp; Carry Rigs
                </a>
              </li>
            </ul>
          </div>

          {/* Workshop & Provenance */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-200 font-bold">
              Craft &amp; Origin
            </h4>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>
                <a
                  href="/about"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  The Maker&apos;s Story
                </a>
              </li>
              <li>
                <a
                  href="/#makers-bench"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  The Workbench &amp; Juki Rig
                </a>
              </li>
              <li>
                <a
                  href="/about#guarantee"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  Lifetime Repair Guarantee
                </a>
              </li>
              <li>
                <a
                  href="/cart"
                  className="hover:text-[#E55B24] transition-colors py-2.5 inline-flex items-center min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55B24] rounded"
                >
                  Gear Roll (Cart)
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Technical Bar */}
        <div className="pt-8 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-stone-500">
          <div>
            © {new Date().getFullYear()} BankBeaters Adventure Gear LLC · Leadville, CO ·
            Single-Needle Lockstitch
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

// Backwards compatibility alias
export const Footer = SiteFooter;
