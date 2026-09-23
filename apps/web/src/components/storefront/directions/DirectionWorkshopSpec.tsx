import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';
import { getAssetUrl } from '@/lib/catalog';

export interface DirectionWorkshopSpecProps {
  products: StorefrontProduct[];
  featuredProduct?: StorefrontProduct | null;
}

export const DirectionWorkshopSpec: React.FC<DirectionWorkshopSpecProps> = ({
  products,
  featuredProduct: _featuredProduct,
}) => {
  const displayProducts = products.slice(0, 6);

  return (
    <div className="direction-theme-c -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 space-y-16 transition-colors">
      {/* 1. DRAFTING BOARD HERO: 1px Hairline Quadrants */}
      <section className="border border-[#2A323D] bg-[#121519] divide-y lg:divide-y-0 lg:divide-x divide-[#2A323D] grid grid-cols-1 lg:grid-cols-12 shadow-2xl">
        {/* Left Quadrant: Brand Seal & Narrative */}
        <div className="lg:col-span-7 p-6 sm:p-10 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-[#E55B24] uppercase font-bold tracking-wider">
              Drawing Board // Leadville, CO
            </span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-400">Elev. 10,152 FT</span>
          </div>

          <div className="max-w-[280px] sm:max-w-[340px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero/bank-beaters-logo-white.png"
              alt="BankBeaters Adventure Gear"
              className="w-full h-auto drop-shadow-md"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
              Workshop Bench Specification
            </span>
            <h1 className="text-3xl sm:text-5xl font-mono font-black uppercase text-[#E2E8F0] tracking-tight">
              Curiosity &gt; Fear.
            </h1>
          </div>

          <p className="text-stone-400 text-sm sm:text-base font-sans leading-relaxed max-w-xl">
            Technical outerwear, convertible carry rigs, and stream accessories hand-sewn by Chris
            using Cordura®, X-Pac®, and bonded nylon thread. Micro-batches of 2–4 serialized builds.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/products"
              className="min-h-[44px] inline-flex items-center justify-center px-6 py-3.5 bg-[#E55B24] hover:bg-orange-600 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-lg transition-colors"
            >
              Deploy Gear ({products.length}) →
            </Link>
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center justify-center px-6 py-3.5 border border-[#2A323D] hover:border-stone-500 text-stone-300 font-mono text-xs uppercase tracking-wider transition-colors"
            >
              Workshop Origin &amp; Provenance
            </Link>
          </div>
        </div>

        {/* Right Quadrant: Photographic Specimen & Blueprint Data */}
        <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between space-y-6 bg-[#0E1114]">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-[#2A323D] bg-stone-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero/bank-beaters-hero.jpg"
              alt="BankBeaters Colorado Riverbank Specimen"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-4 border-t border-[#2A323D]">
            <div>
              <span className="text-stone-500 uppercase text-[10px] block">Sewing Rig</span>
              <span className="text-stone-200 font-semibold">Juki Lockstitch</span>
            </div>
            <div>
              <span className="text-stone-500 uppercase text-[10px] block">Thread Spec</span>
              <span className="text-stone-200 font-semibold">Bonded Nylon V-69</span>
            </div>
            <div>
              <span className="text-stone-500 uppercase text-[10px] block">Batch Run</span>
              <span className="text-stone-200 font-semibold">2–4 Serialized</span>
            </div>
            <div>
              <span className="text-stone-500 uppercase text-[10px] block">Warranty</span>
              <span className="text-[#E55B24] font-semibold">Lifetime Field Repair</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SPECIFICATION ROSTER */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#2A323D] pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block mb-1">
              Active Inventory
            </span>
            <h2 className="text-xl sm:text-2xl font-mono font-bold uppercase text-[#E2E8F0]">
              Equipment Catalog
            </h2>
          </div>
          <Link
            href="/products"
            className="min-h-[44px] inline-flex items-center text-xs font-mono uppercase tracking-wider text-[#E55B24] hover:underline px-1"
          >
            All Hardware ({products.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayProducts.map((item) => {
            const imageUrl = getAssetUrl(item.featured_image || item.hero_image);
            const price = item.base_price;

            return (
              <article
                key={item.id}
                className="border border-[#2A323D] bg-[#121519] p-4 flex flex-col justify-between space-y-4 hover:border-[#E55B24]/50 transition-colors"
              >
                <div className="space-y-3">
                  <Link
                    href={`/products/${item.slug}`}
                    className="block relative aspect-[4/3] w-full bg-[#0E1114] border border-[#2A323D] overflow-hidden"
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
                        Spec Blueprint
                      </div>
                    )}
                  </Link>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-stone-400">{item.category?.name || 'Gear Spec'}</span>
                      <span className="text-[#E55B24] font-bold">${Number(price).toFixed(2)}</span>
                    </div>
                    <h3 className="font-mono text-sm font-bold uppercase text-[#E2E8F0]">
                      <Link href={`/products/${item.slug}`} className="min-h-[44px] inline-flex items-center hover:text-[#E55B24] transition-colors py-1">
                        {item.title}
                      </Link>
                    </h3>
                  </div>

                  <p className="text-xs text-stone-400 font-sans line-clamp-2 leading-relaxed">
                    {item.description || ''}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#2A323D] flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-500 text-[11px] uppercase">
                    Leadville Built
                  </span>
                  <Link
                    href={`/products/${item.slug}`}
                    className="min-h-[44px] inline-flex items-center font-bold uppercase text-[#E55B24] hover:underline px-1"
                  >
                    View Spec →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. WORKBENCH PROVENANCE */}
      <section className="border border-[#2A323D] bg-[#121519] p-6 sm:p-10 space-y-4">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-brand-serif text-lg font-bold text-stone-100 tracking-wide">
              BankBeaters
            </span>
            <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest font-bold">
              Adventure Gear
            </span>
            <span className="text-xs font-mono text-stone-500">·</span>
            <span className="text-xs font-mono text-stone-400 uppercase tracking-wider">
              Curiosity &gt; Fear
            </span>
          </div>
          <h2 className="text-2xl font-mono font-bold uppercase text-[#E2E8F0]">
            The Maker&apos;s Bench
          </h2>
          <p className="text-sm text-stone-400 leading-relaxed">
            In angling and bushwhacking culture, a <strong>Bank Beater</strong> is someone who explores
            shorelines, cut-banks, and remote canyon pools on foot. Chris sews gear by hand using bombproof
            Cordura® and X-Pac® sailcloth with bonded nylon thread. If you shred an elbow crawling through
            briars, send it back for field repair.
          </p>
          <div className="pt-2">
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center text-xs font-mono uppercase tracking-wider text-[#E55B24] hover:underline px-1"
            >
              The Maker&apos;s Story &amp; Provenance →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
