'use client';

import React from 'react';
import type { StorefrontProduct } from '@/lib/catalog';

interface NoirMinimalLayoutProps {
  products: StorefrontProduct[];
}

export const NoirMinimalLayout: React.FC<NoirMinimalLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans-noir">
      {/* 1. Bespoke Noir Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-black/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              className="group flex items-center gap-2 cursor-pointer"
            >
              <span className="font-serif-editorial text-xl sm:text-2xl tracking-[0.2em] sm:tracking-[0.25em] uppercase text-white font-bold group-hover:text-zinc-300 transition-colors">
                BANKBEATERS
              </span>
            </a>
            <span className="hidden lg:inline-block text-[10px] tracking-[0.35em] text-zinc-500 uppercase font-light border-l border-white/10 pl-6">
              Leadville, CO · Elev 10,152 FT
            </span>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] font-light text-zinc-400">
            <a href="#archive" className="hover:text-white transition-colors hidden xs:inline">
              Archive
            </a>
            <a href="#workshop-ethic" className="hover:text-white transition-colors hidden sm:inline">
              Workshop
            </a>
            <div
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border border-white/20 text-white flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-default select-none"
            >
              <span className="text-[10px] sm:text-[11px]">Bag</span>
              <span className="text-[9px] sm:text-[10px] text-zinc-400">0</span>
            </div>
          </nav>
        </div>
      </header>

      {/* 2. Full-Screen 100vh Viewport Hero */}
      <section className="relative w-full min-h-[580px] h-auto sm:h-screen flex flex-col justify-between overflow-hidden bg-black">
        {/* Authentic Cloudflare R2 Hero Photograph Full-Bleed */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/hero/bank-beaters-hero.jpg"
          alt="BankBeaters Angler in High Alpine River Canyon"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.65] contrast-[1.2] transform scale-105 transition-transform duration-1000 ease-out"
        />

        {/* Ambient Dark Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/40 hidden md:block" />

        {/* Top Eyebrow */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 pt-6 sm:pt-16 flex justify-between items-center text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.35em] uppercase text-zinc-400 font-light">
          <span>Hand-Patterned &amp; Sewn in Colorado</span>
          <span className="hidden sm:inline">Small-Batch Serialized Editions</span>
        </div>

        {/* Center / Bottom Editorial Typography */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:pb-20 space-y-6 sm:space-y-8">
          <div className="space-y-3 sm:space-y-4 max-w-3xl">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] text-zinc-400 block font-light">
              BankBeaters Adventure Gear
            </span>
            <h1 className="font-serif-editorial text-4xl sm:text-6xl lg:text-9xl font-bold uppercase tracking-tight text-white leading-none break-words">
              Curiosity &gt; Fear.
            </h1>
            <p className="text-sm sm:text-xl text-zinc-300 font-light leading-relaxed max-w-2xl pt-1 sm:pt-2">
              Technical foul-weather outerwear, reinforced guide pants, and modular carry systems.
              Crafted by Chris for backcountry anglers and explorers who work the bank on foot.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6">
            <a
              href="#archive"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-4 bg-white text-black font-medium text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all duration-300 hover:bg-zinc-200"
            >
              Explore Equipment ({products.length})
            </a>
            <a
              href="#workshop-ethic"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-4 border border-white/40 text-white font-medium text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all duration-300 hover:border-white hover:bg-white/10"
            >
              The Maker&apos;s Story
            </a>
          </div>
        </div>

        {/* Delicate Bottom Scroll Cue */}
        <div className="relative z-10 pb-8 hidden sm:flex flex-col items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-[0.3em]">
          <span>Scroll</span>
          <div className="w-[1px] h-8 bg-gradient-to-b from-zinc-400 to-transparent animate-pulse" />
        </div>
      </section>

      {/* 3. Editorial Brand Statement */}
      <section id="workshop-ethic" className="py-14 sm:py-28 px-4 sm:px-6 lg:px-12 border-b border-white/10 bg-black">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 text-center">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-zinc-500 font-light block">
            Craftsmanship Philosophy
          </span>

          <blockquote className="font-serif-editorial text-2xl sm:text-4xl lg:text-6xl font-light text-zinc-100 uppercase tracking-tight leading-snug">
            &ldquo;We do not build for drift boats or manicured access trails. We craft for remote
            canyons, torrential squalls, and miles on foot.&rdquo;
          </blockquote>

          <div className="w-16 h-[1px] bg-white/30 mx-auto" />

          <p className="text-xs sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto font-light">
            Every piece is drafted by hand on the cutting bench in Leadville, Colorado. Chris sews
            each seam with single-needle industrial lockstitching and heavy bonded nylon. No
            offshore mass-production. If your gear tears on wild willow branches, send it back for a
            lifetime repair.
          </p>
        </div>
      </section>

      {/* 4. Three Minimalist Pillars */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 border-b border-white/10 bg-[#050505]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 border-l border-white/15 pl-4 sm:pl-6">
            <span className="text-xs font-mono tracking-widest text-zinc-500 block uppercase">
              01 / Workshop Provenance
            </span>
            <h3 className="font-serif-editorial text-lg sm:text-xl font-bold uppercase tracking-wide text-white">
              Single-Needle Craft
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              Patterned, cut, and assembled by Chris on a refurbished Juki lockstitch machine. Each
              run is restricted to 2 to 6 serialized pieces.
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4 border-l border-white/15 pl-4 sm:pl-6">
            <span className="text-xs font-mono tracking-widest text-zinc-500 block uppercase">
              02 / Material Resilience
            </span>
            <h3 className="font-serif-editorial text-lg sm:text-xl font-bold uppercase tracking-wide text-white">
              Bombproof Textiles
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              Toray 3-layer waterproof membranes, 500D/1000D Cordura scuff plates, and salvaged
              deadstock textiles that shrug off dense alder thickets.
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4 border-l border-white/15 pl-4 sm:pl-6">
            <span className="text-xs font-mono tracking-widest text-zinc-500 block uppercase">
              03 / Lifetime Stewardship
            </span>
            <h3 className="font-serif-editorial text-lg sm:text-xl font-bold uppercase tracking-wide text-white">
              Perpetual Repair
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              No warranty forms or purchase receipts required. If a bramble shreds a seam, mail it
              back to the workshop for free re-stitching.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Curated Monochrome Equipment Gallery */}
      <section id="archive" className="py-12 sm:py-28 px-4 sm:px-6 lg:px-12 bg-black">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 sm:gap-4 border-b border-white/10 pb-4 sm:pb-8">
            <div>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-zinc-500 block font-light">
                Curated Work
              </span>
              <h2 className="font-serif-editorial text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-white">
                Equipment Archive
              </h2>
            </div>
            <span
              className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-400 select-none"
            >
              Archive Roster ({products.length}) · Serialized
            </span>
          </div>

          {/* Clean Editorial Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {products.map((product) => {
              const displayImage =
                product.hero_image || product.featured_image || '/media/hero/bank-beaters-hero.jpg';
              const activeVariation = product.variations?.[0];

              return (
                <div
                  key={product.id}
                  className="group block space-y-4 sm:space-y-5 cursor-default"
                >
                  <div className="aspect-[4/5] bg-zinc-950 overflow-hidden relative border border-white/10 group-hover:border-white/30 transition-colors duration-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center filter contrast-105 group-hover:scale-105 transition-transform duration-700 ease-out"
                    />

                    {activeVariation?.edition_badge && (
                      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 bg-black/90 backdrop-blur-md px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-300 border border-white/15">
                        {activeVariation.edition_badge}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 pt-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-serif-editorial text-base sm:text-lg font-bold uppercase tracking-wide text-white group-hover:text-zinc-300 transition-colors">
                        {product.title}
                      </h4>
                      <span className="text-sm font-light text-zinc-300 tracking-wider">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 font-light leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 flex items-center gap-1.5 font-light select-none">
                      <span>Serialized Spec // Verified</span>
                      <span>·</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Bespoke Noir Footer */}
      <footer className="border-t border-white/10 py-12 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#050505]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 font-light text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4">
            <span className="font-serif-editorial text-sm font-bold text-white tracking-widest">
              BANKBEATERS
            </span>
            <span className="hidden sm:inline">·</span>
            <span>Leadville, Colorado</span>
            <span className="hidden sm:inline">·</span>
            <span>Curiosity &gt; Fear</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters. Single-Needle Lockstitched. Lifetime Repair.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
