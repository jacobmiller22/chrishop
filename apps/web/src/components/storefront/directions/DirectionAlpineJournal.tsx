import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';
import { getAssetUrl } from '@/lib/catalog';

export interface DirectionAlpineJournalProps {
  products: StorefrontProduct[];
  featuredProduct?: StorefrontProduct | null;
}

export const DirectionAlpineJournal: React.FC<DirectionAlpineJournalProps> = ({
  products,
  featuredProduct: _featuredProduct,
}) => {
  const displayProducts = products.slice(0, 6);

  return (
    <div className="direction-theme-a -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 space-y-24 transition-colors">
      {/* 1. EDITORIAL HERO: Full Bleed Riverbank Photography + Floating Heritage Mark */}
      <section className="relative w-full rounded-3xl overflow-hidden shadow-xl border border-[#DDD7C8] bg-[#EFECE3]">
        <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/bank-beaters-hero.jpg"
            alt="BankBeaters Angler Field Testing along Colorado Riverbank"
            className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.03]"
            loading="eager"
            fetchPriority="high"
          />

          {/* Warm daylight subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A2421]/90 via-[#1A2421]/40 to-transparent" />

          {/* Floating Brand Narrative */}
          <div className="absolute bottom-8 left-6 right-6 sm:bottom-12 sm:left-12 sm:right-12 max-w-3xl space-y-4">
            <div className="max-w-[240px] sm:max-w-[320px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/hero/bank-beaters-logo-white.png"
                alt="BankBeaters Adventure Gear"
                className="w-full h-auto drop-shadow-lg"
              />
            </div>

            <p className="text-white/90 font-journal-serif text-base sm:text-xl leading-relaxed italic max-w-2xl drop-shadow">
              Hand-cut, patterned, and single-needle lockstitched at 10,152 feet in Leadville, Colorado.
              Built for anglers and bushwhackers who walk remote riverbanks on foot.
            </p>

            <div className="pt-2 flex items-center gap-4">
              <Link
                href="/products"
                className="min-h-[44px] inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#C85A32] hover:bg-[#b04d28] text-white font-sans text-sm font-semibold tracking-wide shadow-md transition-transform hover:-translate-y-0.5"
              >
                Explore Field Gear ({products.length}) →
              </Link>
              <Link
                href="/about"
                className="min-h-[44px] inline-flex items-center text-sm font-sans font-medium text-white/90 hover:text-white underline underline-offset-4 px-2"
              >
                The Maker&apos;s Origin
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. UN-BOXED GEAR ROSTER: Clean, Borderless Floating Silhouettes */}
      <section className="space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#DDD7C8] pb-6 gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-sans tracking-[0.2em] text-[#C85A32] font-bold">
              Small-Batch Outfitter Roster
            </span>
            <h2 className="text-3xl sm:text-4xl font-journal-serif italic text-[#1A2421]">
              Current Field Builds
            </h2>
          </div>
          <Link
            href="/products"
            className="min-h-[44px] inline-flex items-center text-sm font-sans font-semibold text-[#C85A32] hover:text-[#b04d28] gap-1 px-1"
          >
            Complete Equipment Vault ({products.length}) →
          </Link>
        </div>

        {/* Floating borderless grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14">
          {displayProducts.map((item) => {
            const imageUrl = getAssetUrl(item.featured_image || item.hero_image);
            const price = item.base_price;

            return (
              <article key={item.id} className="group flex flex-col space-y-4">
                <Link
                  href={`/products/${item.slug}`}
                  className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#EFECE3] border border-[#DDD7C8] shadow-sm transition-transform duration-500 group-hover:-translate-y-1"
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 font-sans text-xs">
                      Field Silhouette
                    </div>
                  )}

                  {item.category?.name && (
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-sans font-medium bg-[#F6F3EC]/90 text-[#1A2421] backdrop-blur-sm border border-[#DDD7C8]">
                      {item.category.name}
                    </span>
                  )}
                </Link>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-journal-serif text-[#1A2421]">
                      <Link href={`/products/${item.slug}`} className="min-h-[44px] inline-flex items-center hover:text-[#C85A32] transition-colors py-1">
                        {item.title}
                      </Link>
                    </h3>
                    <span className="text-sm font-sans font-bold text-[#1A2421]">
                      ${Number(price).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs font-sans text-[#5A6660] line-clamp-2 leading-relaxed">
                    {typeof item.description === 'string' ? item.description : ''}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. EDITORIAL STORY DISPATCH: The Maker's Workshop */}
      <section className="border-t border-[#DDD7C8] pt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <span className="text-xs uppercase font-sans tracking-[0.2em] text-[#C85A32] font-bold">
              Provenance &amp; Field Repair
            </span>
            <h2 className="text-3xl sm:text-4xl font-journal-serif italic text-[#1A2421]">
              The Leadville Cutting Bench
            </h2>
          </div>

          <p className="font-journal-serif text-base sm:text-lg text-[#1A2421] leading-relaxed">
            In angling and outdoor culture, a <em>Bank Beater</em> is anyone who reaches water on foot.
            There are no cushioned casting decks—only miles through brambles, willows, and cold riverbanks.
          </p>

          <p className="text-sm font-sans text-[#5A6660] leading-relaxed">
            Every garment and carry rig is constructed from 500D Cordura®, X-Pac® sailcloth, and bonded
            nylon thread on an industrial lockstitch machine. If you ever tear a seam or puncture a pocket
            in the field, send it back to the workshop. Chris repairs all BankBeaters gear for life.
          </p>

          <div className="pt-2">
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center text-sm font-sans font-semibold text-[#C85A32] hover:text-[#b04d28] gap-1 px-1"
            >
              Read the Full Origin Essay →
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-[#DDD7C8] bg-[#EFECE3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero/bank-beaters-hero.jpg"
              alt="Leadville Colorado Workshop"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-[#F6F3EC]/95 backdrop-blur-md border border-[#DDD7C8] text-xs font-sans text-[#5A6660]">
              <span className="font-bold text-[#1A2421] block mb-0.5">Single-Needle Craftsmanship</span>
              Guaranteed for the lifetime of your field adventures.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
