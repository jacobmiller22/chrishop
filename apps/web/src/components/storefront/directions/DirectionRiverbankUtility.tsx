import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';
import { getAssetUrl } from '@/lib/catalog';

export interface DirectionRiverbankUtilityProps {
  products: StorefrontProduct[];
  featuredProduct?: StorefrontProduct | null;
}

export const DirectionRiverbankUtility: React.FC<DirectionRiverbankUtilityProps> = ({
  products,
  featuredProduct: _featuredProduct,
}) => {
  const displayProducts = products.slice(0, 6);

  return (
    <div className="direction-theme-b -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 space-y-20 transition-colors">
      {/* 1. OUTFITTER HERO: Honest Utility Banner */}
      <section className="border border-[#2D353F] bg-[#1D2228] p-6 sm:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-bold">
                Leadville, Colorado · Elev. 10,152 FT
              </span>
              <span className="text-stone-600">|</span>
              <span className="text-xs font-mono text-stone-400 uppercase">
                Handcrafted Small Batches
              </span>
            </div>

            <div className="max-w-[280px] sm:max-w-[360px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/hero/bank-beaters-logo-white.png"
                alt="BankBeaters Adventure Gear"
                className="w-full h-auto drop-shadow-md"
              />
            </div>

            <h1 className="text-2xl sm:text-4xl font-sans font-black uppercase tracking-tight text-[#ECE9E2]">
              Single-Needle Outdoor Gear Built for the Bank.
            </h1>

            <p className="text-[#88939E] text-sm sm:text-base leading-relaxed font-sans max-w-xl">
              We cut, stitch, and inspect every piece by hand on an industrial lockstitch machine.
              No factory lines. If you tear it on barbed wire or rock riprap, Chris repairs it for free.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 bg-[#C05621] hover:bg-[#a84919] text-white font-mono text-xs uppercase tracking-wider font-bold transition-colors"
              >
                Inspect Gear Roster ({products.length})
              </Link>
              <Link
                href="/about"
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 border border-[#2D353F] hover:border-stone-500 text-stone-300 font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Workshop Origin &amp; Warranty
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="border border-[#2D353F] bg-[#161A1E] p-2">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler Field Testing"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3 text-[11px] font-mono text-stone-400 flex items-center justify-between border-t border-[#2D353F] mt-2">
                <span>Field Specimen No. 01</span>
                <span className="text-[#C05621]">Colorado River Testing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TABULAR OUTFITTER CATALOG: Mail-Order Simplicity */}
      <section className="space-y-6">
        <div className="flex items-end justify-between border-b border-[#2D353F] pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#C05621] font-bold block mb-1">
              Active Inventory
            </span>
            <h2 className="text-xl sm:text-2xl font-mono font-bold uppercase tracking-wider text-[#ECE9E2]">
              Equipment Roster
            </h2>
          </div>
          <Link
            href="/products"
            className="min-h-[44px] inline-flex items-center text-xs font-mono uppercase tracking-wider text-[#C05621] hover:underline px-1"
          >
            All Silhouettes →
          </Link>
        </div>

        {/* Tabular Roster Grid with clean rectangular styling */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayProducts.map((item) => {
            const imageUrl = getAssetUrl(item.featured_image || item.hero_image);
            const price = item.base_price;

            return (
              <article
                key={item.id}
                className="border border-[#2D353F] bg-[#1D2228] p-4 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <Link
                    href={`/products/${item.slug}`}
                    className="block relative aspect-[4/3] w-full bg-[#161A1E] border border-[#2D353F] overflow-hidden"
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-mono text-xs text-stone-500">
                        Silhouette Spec
                      </div>
                    )}
                  </Link>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono text-stone-400">
                      <span>{item.category?.name || 'General Equipment'}</span>
                      <span className="text-[#C05621] font-bold">${Number(price).toFixed(2)}</span>
                    </div>
                    <h3 className="font-mono text-sm font-bold uppercase text-[#ECE9E2]">
                      <Link href={`/products/${item.slug}`} className="min-h-[44px] inline-flex items-center hover:text-[#C05621] transition-colors py-1">
                        {item.title}
                      </Link>
                    </h3>
                  </div>

                  <p className="text-xs text-[#88939E] font-sans line-clamp-2 leading-relaxed">
                    {item.description || ''}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#2D353F] flex items-center justify-between">
                  <span className="text-[11px] font-mono text-stone-500 uppercase">
                    Small-Batch Build
                  </span>
                  <Link
                    href={`/products/${item.slug}`}
                    className="min-h-[44px] inline-flex items-center text-xs font-mono font-bold uppercase text-[#C05621] hover:underline px-1"
                  >
                    Inspect Build →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. HONEST WORKSHOP DISPATCH */}
      <section className="border border-[#2D353F] bg-[#161A1E] p-6 sm:p-10 space-y-6">
        <div className="max-w-2xl space-y-3">
          <span className="text-xs font-mono uppercase tracking-widest text-[#C05621] font-bold block">
            Craftsmanship Policy
          </span>
          <h2 className="text-2xl font-mono font-bold uppercase text-[#ECE9E2]">
            Lifetime Stitch Guarantee
          </h2>
          <p className="text-sm text-[#88939E] leading-relaxed">
            Gear is made to get dirty and work riverbanks. We don&apos;t use delicate materials. Every seam is
            bar-tacked and reinforced with bonded nylon thread. If a seam blows out on your watch, send it to
            our Leadville workshop for field repair.
          </p>
          <div className="pt-2">
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center text-xs font-mono uppercase tracking-wider text-[#C05621] hover:underline px-1"
            >
              The Maker&apos;s Story &amp; Provenance →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
