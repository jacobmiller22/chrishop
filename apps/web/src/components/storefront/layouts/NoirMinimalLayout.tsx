'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface NoirMinimalLayoutProps {
  products: StorefrontProduct[];
}

export const NoirMinimalLayout: React.FC<NoirMinimalLayoutProps> = ({ products }) => {
  return (
    <div className="w-full bg-black text-white selection:bg-white selection:text-black">
      {/* 1. Full-Viewport Edge-to-Edge Cinematic Hero */}
      <section className="relative left-1/2 -translate-x-1/2 w-screen min-h-[92vh] sm:min-h-screen -mt-8 flex flex-col justify-between overflow-hidden bg-black">
        {/* Full-Bleed Authentic Cloudflare R2 Hero Photograph */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/hero/bank-beaters-hero.jpg"
          alt="BankBeaters Angler Working Remote River Bank on Foot"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.15] transform scale-105 transition-transform duration-1000 ease-out"
        />

        {/* Ambient Noir Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/40 hidden md:block" />

        {/* Top Header Eyebrow */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 sm:px-12 pt-12 flex justify-between items-center text-xs tracking-[0.3em] uppercase text-zinc-400 font-light">
          <span>Leadville, Colorado · 10,152 FT</span>
          <span className="hidden sm:inline">Crafted in Small Batches</span>
        </div>

        {/* Center/Lower Hero Typography */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 sm:px-12 pb-16 space-y-8">
          <div className="space-y-4 max-w-3xl">
            <span className="text-xs uppercase tracking-[0.35em] text-zinc-400 block font-light">
              BankBeaters Adventure Gear
            </span>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tight text-white leading-none">
              Curiosity &gt; Fear.
            </h1>
            <p className="text-base sm:text-xl text-zinc-300 font-light leading-relaxed max-w-2xl pt-2">
              Technical foul-weather outerwear, reinforced guide pants, and modular carry systems.
              Hand-patterned and sewn by Chris for anglers and explorers who work the bank on foot.
            </p>
          </div>

          {/* Minimalist Ghost Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-5">
            <a
              href="#archive"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-medium text-xs uppercase tracking-[0.25em] transition-all duration-300 hover:bg-zinc-200"
            >
              Explore Equipment ({products.length})
            </a>
            <Link
              href="/about"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-white/40 text-white font-medium text-xs uppercase tracking-[0.25em] transition-all duration-300 hover:border-white hover:bg-white/10"
            >
              The Maker&apos;s Story
            </Link>
          </div>
        </div>

        {/* Delicate Bottom Scroll Cue */}
        <div className="relative z-10 pb-8 flex flex-col items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-[0.3em]">
          <span>Scroll</span>
          <div className="w-[1px] h-6 bg-gradient-to-b from-zinc-500 to-transparent animate-pulse" />
        </div>
      </section>

      {/* 2. Editorial Brand Statement (Zero Tech Clutter) */}
      <section className="py-24 px-4 sm:px-8 border-b border-white/10 bg-black">
        <div className="max-w-4xl mx-auto space-y-12 text-center">
          <span className="text-xs uppercase tracking-[0.35em] text-zinc-500 font-light block">
            Craftsmanship Philosophy
          </span>

          <blockquote className="text-2xl sm:text-4xl lg:text-5xl font-light text-zinc-100 uppercase tracking-tight leading-snug">
            &ldquo;We do not build for drift boats or manicured access trails. We craft for remote
            canyons, torrential squalls, and miles on foot.&rdquo;
          </blockquote>

          <div className="w-16 h-[1px] bg-white/30 mx-auto" />

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto font-light">
            Every piece is drafted by hand on the cutting bench in Leadville, Colorado. Chris sews
            each seam with single-needle industrial lockstitching and heavy bonded nylon. No
            offshore mass-production. If your gear tears on wild willow branches, send it back for a
            lifetime repair.
          </p>
        </div>
      </section>

      {/* 3. Three Minimalist Pillars */}
      <section className="py-20 px-4 sm:px-8 border-b border-white/10 bg-[#050505]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-8">
          <div className="space-y-4 border-l border-white/15 pl-6">
            <span className="text-xs font-mono tracking-widest text-zinc-500 block uppercase">
              01 / Workshop Provenance
            </span>
            <h3 className="text-lg font-bold uppercase tracking-wide text-white">
              Single-Needle Craft
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              Patterned, cut, and assembled by Chris on a refurbished Juki lockstitch machine. Each
              run is restricted to 2 to 6 serialized pieces.
            </p>
          </div>

          <div className="space-y-4 border-l border-white/15 pl-6">
            <span className="text-xs font-mono tracking-widest text-zinc-500 block uppercase">
              02 / Material Resilience
            </span>
            <h3 className="text-lg font-bold uppercase tracking-wide text-white">
              Bombproof Textiles
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              Toray 3-layer waterproof membranes, 500D/1000D Cordura scuff plates, and salvaged
              deadstock textiles that shrug off dense alder thickets.
            </p>
          </div>

          <div className="space-y-4 border-l border-white/15 pl-6">
            <span className="text-xs font-mono tracking-widest text-zinc-500 block uppercase">
              03 / Lifetime Stewardship
            </span>
            <h3 className="text-lg font-bold uppercase tracking-wide text-white">
              Perpetual Repair
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              No warranty forms or purchase receipts required. If a bramble shreds a seam, mail it
              back to the workshop for free re-stitching.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Curated Monochrome Equipment Showcase */}
      <section id="archive" className="py-24 px-4 sm:px-8 bg-black">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 border-b border-white/10 pb-6">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 block font-light">
                Selected Work
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight text-white">
                Equipment Archive
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-white transition-colors"
            >
              View Full Catalog ({products.length}) →
            </Link>
          </div>

          {/* Clean Editorial Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-8">
            {products.map((product) => {
              const displayImage =
                product.hero_image || product.featured_image || '/media/hero/bank-beaters-hero.jpg';
              const activeVariation = product.variations?.[0];

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group block space-y-4"
                >
                  {/* Image Container with Quiet Border and Subtle Zoom */}
                  <div className="aspect-[4/5] bg-zinc-950 overflow-hidden relative border border-white/10 group-hover:border-white/30 transition-colors duration-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center filter contrast-105 group-hover:scale-105 transition-transform duration-700 ease-out"
                    />

                    {/* Subtle Edition Micro-Label */}
                    {activeVariation?.edition_badge && (
                      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-2.5 py-1 text-[10px] uppercase tracking-widest text-zinc-300 font-mono border border-white/10">
                        {activeVariation.edition_badge}
                      </div>
                    )}
                  </div>

                  {/* Minimalist Details */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-base font-bold uppercase tracking-wide text-white group-hover:text-zinc-300 transition-colors">
                        {product.title}
                      </h4>
                      <span className="text-sm font-light text-zinc-300 tracking-wider">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 font-light leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors flex items-center gap-1">
                      <span>Inspect Piece</span>
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Minimalist Workshop Gateway */}
      <section className="py-24 px-4 sm:px-8 border-t border-white/10 bg-[#050505]">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-xs uppercase tracking-[0.35em] text-zinc-500 font-light block">
            Direct Provenance
          </span>
          <h3 className="text-3xl sm:text-5xl font-bold uppercase tracking-tight text-white">
            Built by Hand in Colorado
          </h3>
          <p className="text-sm sm:text-base text-zinc-400 font-light max-w-xl mx-auto leading-relaxed">
            Read how BankBeaters began on a bench vise in Leadville, our philosophy on technical
            materials, and our lifetime stitch guarantee.
          </p>
          <div className="pt-4">
            <Link
              href="/about"
              className="inline-flex items-center justify-center px-10 py-4 bg-white text-black font-medium text-xs uppercase tracking-[0.25em] transition-all duration-300 hover:bg-zinc-200"
            >
              Read The Maker&apos;s Story (/about)
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
