'use client';

import React from 'react';
import Link from 'next/link';
import { DropCountdown } from '@chrishop/ui';
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
    <div className="space-y-12">
      {/* 1. EDITORIAL HERO: Full Bleed Riverbank Photography + Floating Heritage Mark */}
      <section
        className="relative w-full rounded-3xl overflow-hidden shadow-xl border transition-colors duration-500"
        style={{
          borderColor: 'var(--journal-border)',
          backgroundColor: 'var(--journal-surface)',
        }}
      >
        <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/bank-beaters-hero.jpg"
            alt="BankBeaters Angler Field Testing along Colorado Riverbank"
            className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.03]"
            loading="eager"
            fetchPriority="high"
          />

          {/* Dynamic palette hero gradient */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background:
                'linear-gradient(to top, var(--journal-hero-overlay) 0%, rgba(10, 16, 14, 0.45) 50%, transparent 100%)',
            }}
          />

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
                className="min-h-[44px] inline-flex items-center justify-center px-8 py-3.5 rounded-full text-white font-sans text-sm font-semibold tracking-wide shadow-md transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'var(--journal-accent)',
                }}
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

      {/* Workshop Drop Countdown Banner */}
      <div className="flex justify-center -mt-4">
        <DropCountdown title="Workshop Drop Countdown" />
      </div>

      {/* 2. UN-BOXED GEAR ROSTER: Clean, Borderless Floating Silhouettes */}
      <section className="space-y-10">
        <div
          className="flex flex-col sm:flex-row sm:items-end justify-between border-b pb-6 gap-4 transition-colors"
          style={{ borderColor: 'var(--journal-border)' }}
        >
          <div className="space-y-1">
            <span
              className="text-xs uppercase font-sans tracking-[0.2em] font-bold"
              style={{ color: 'var(--journal-accent)' }}
            >
              Small-Batch Outfitter Roster
            </span>
            <h2
              className="text-3xl sm:text-4xl font-journal-serif italic"
              style={{ color: 'var(--journal-ink)' }}
            >
              Current Field Builds
            </h2>
          </div>
          <Link
            href="/products"
            className="min-h-[44px] inline-flex items-center text-sm font-sans font-semibold gap-1 px-1 hover:underline"
            style={{ color: 'var(--journal-accent)' }}
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
                  className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border shadow-sm transition-transform duration-500 group-hover:-translate-y-1"
                  style={{
                    backgroundColor: 'var(--journal-surface)',
                    borderColor: 'var(--journal-border)',
                  }}
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
                    <div
                      className="w-full h-full flex items-center justify-center font-sans text-xs"
                      style={{ color: 'var(--journal-muted)' }}
                    >
                      Field Silhouette
                    </div>
                  )}

                  {item.category?.name && (
                    <span
                      className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-sans font-medium backdrop-blur-sm border shadow-xs"
                      style={{
                        backgroundColor: 'var(--journal-canvas)',
                        color: 'var(--journal-ink)',
                        borderColor: 'var(--journal-border)',
                      }}
                    >
                      {item.category.name}
                    </span>
                  )}
                </Link>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-journal-serif">
                      <Link
                        href={`/products/${item.slug}`}
                        className="min-h-[44px] inline-flex items-center transition-colors py-1 hover:underline"
                        style={{ color: 'var(--journal-ink)' }}
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <span
                      className="text-sm font-sans font-bold"
                      style={{ color: 'var(--journal-ink)' }}
                    >
                      ${Number(price).toFixed(2)}
                    </span>
                  </div>
                  <p
                    className="text-xs font-sans line-clamp-2 leading-relaxed"
                    style={{ color: 'var(--journal-muted)' }}
                  >
                    {typeof item.description === 'string' ? item.description : ''}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. EDITORIAL STORY DISPATCH: The Maker's Workshop */}
      <section
        className="border-t pt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center transition-colors"
        style={{ borderColor: 'var(--journal-border)' }}
      >
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <span
              className="text-xs uppercase font-sans tracking-[0.2em] font-bold"
              style={{ color: 'var(--journal-accent)' }}
            >
              Provenance &amp; Field Repair
            </span>
            <h2
              className="text-3xl sm:text-4xl font-journal-serif italic"
              style={{ color: 'var(--journal-ink)' }}
            >
              The Leadville Cutting Bench
            </h2>
          </div>

          <p
            className="font-journal-serif text-base sm:text-lg leading-relaxed"
            style={{ color: 'var(--journal-ink)' }}
          >
            In angling and outdoor culture, a <em>Bank Beater</em> is anyone who reaches water on foot.
            There are no cushioned casting decks—only miles through brambles, willows, and cold riverbanks.
          </p>

          <p
            className="text-sm font-sans leading-relaxed"
            style={{ color: 'var(--journal-muted)' }}
          >
            Every garment and carry rig is constructed from 500D Cordura®, X-Pac® sailcloth, and bonded
            nylon thread on an industrial lockstitch machine. If you ever tear a seam or puncture a pocket
            in the field, send it back to the workshop. Chris repairs all BankBeaters gear for life.
          </p>

          <div className="pt-2">
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center text-sm font-sans font-semibold gap-1 px-1 hover:underline"
              style={{ color: 'var(--journal-accent)' }}
            >
              Read the Full Origin Essay →
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div
            className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border"
            style={{
              borderColor: 'var(--journal-border)',
              backgroundColor: 'var(--journal-surface)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero/bank-beaters-hero.jpg"
              alt="Leadville Colorado Workshop"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl backdrop-blur-md border text-xs font-sans shadow-md"
              style={{
                backgroundColor: 'var(--journal-surface)',
                borderColor: 'var(--journal-border)',
                color: 'var(--journal-muted)',
              }}
            >
              <span
                className="font-bold block mb-0.5"
                style={{ color: 'var(--journal-ink)' }}
              >
                Single-Needle Craftsmanship
              </span>
              Guaranteed for the lifetime of your field adventures.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

