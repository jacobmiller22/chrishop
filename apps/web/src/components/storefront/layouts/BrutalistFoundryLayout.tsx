'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface BrutalistFoundryLayoutProps {
  products: StorefrontProduct[];
}

export const BrutalistFoundryLayout: React.FC<BrutalistFoundryLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#111315] text-[#F1F3F5] selection:bg-[#FACC15] selection:text-black font-mono-industrial">
      {/* 1. Bespoke Heavy Industrial Foundry Header */}
      <header className="sticky top-0 z-40 w-full bg-[#111315]/95 backdrop-blur-md border-b-2 border-white/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="group flex items-center gap-3">
              <div className="w-8 h-8 bg-[#FACC15] text-black font-display-brutalist text-xl flex items-center justify-center font-bold tracking-tighter">
                BF
              </div>
              <div className="flex flex-col">
                <span className="font-display-brutalist text-2xl uppercase tracking-wider text-white group-hover:text-[#FACC15] transition-colors leading-none">
                  BANKBEATERS // FOUNDRY
                </span>
                <span className="text-[10px] tracking-widest text-[#94A3B8] uppercase pt-1">
                  Adventure Gear · Leadville Plant 10,152&apos;
                </span>
              </div>
            </Link>
            <div className="hidden xl:flex items-center gap-2 text-[11px] text-[#64748B] border-l-2 border-white/20 pl-6 uppercase">
              <span className="w-2 h-2 bg-[#FACC15]" />
              <span>SPEC: HEAVY_DUTY // SHALE &amp; ALDER RATED</span>
            </div>
          </div>

          <nav className="flex items-center gap-8 text-xs uppercase tracking-wider text-[#CBD5E1]">
            <a href="#equipment-spec" className="hover:text-[#FACC15] transition-colors">
              [SPECS]
            </a>
            <Link href="/products?category=outerwear" className="hover:text-[#FACC15] transition-colors hidden sm:inline">
              [OUTERWEAR]
            </Link>
            <Link href="/products?category=packs-carry" className="hover:text-[#FACC15] transition-colors hidden md:inline">
              [RIGS]
            </Link>
            <Link href="/about" className="hover:text-[#FACC15] transition-colors">
              [FOUNDRY_LOG]
            </Link>
            <Link
              href="/cart"
              className="px-3.5 py-1.5 border-2 border-[#FACC15] bg-[#FACC15] text-black font-bold hover:bg-white hover:border-white transition-all flex items-center gap-2"
            >
              <span className="text-[11px]">GEAR ROLL</span>
              <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-none font-mono">0</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Wall-to-Wall Brutalist Hero */}
      <section className="relative w-full border-b-2 border-white/20 bg-[#16191D] py-16 lg:py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Foundry Narrative */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-3 bg-[#20252C] border-2 border-[#374151] px-3.5 py-1.5">
              <span className="text-xs uppercase tracking-widest text-[#FACC15] font-bold">
                HEAVY INDUSTRIAL TOOLING // RATED FOR ABRASION
              </span>
            </div>

            <div className="space-y-4">
              <span className="text-xs uppercase tracking-[0.25em] text-[#94A3B8] block font-semibold">
                Option F · The Brutalist Foundry Archetype
              </span>
              <h1 className="font-display-brutalist text-6xl sm:text-8xl lg:text-9xl uppercase tracking-tight text-white leading-none">
                CURIOSITY &gt; FEAR.
              </h1>
              <p className="text-sm sm:text-base text-[#CBD5E1] leading-relaxed max-w-xl pt-2">
                Technical foul-weather outerwear, reinforced guide trousers, and convertible chest rigs.
                Hand-patterned and sewn by Chris on an industrial Juki lockstitch machine in Leadville, Colorado
                for backcountry anglers who bushwhack the bank on foot.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-5">
              <a
                href="#equipment-spec"
                className="px-8 py-4 bg-[#FACC15] hover:bg-yellow-400 text-black font-display-brutalist text-lg uppercase tracking-wider transition-all duration-200 border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
              >
                Explore Gear Roster ({products.length})
              </a>
              <Link
                href="/about"
                className="px-8 py-4 border-2 border-white/40 hover:border-[#FACC15] bg-[#111315] hover:bg-[#1A1D22] text-white font-display-brutalist text-lg uppercase tracking-wider transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]"
              >
                Foundry Dossier (/about)
              </Link>
            </div>

            {/* Industrial Stamped Ratings */}
            <div className="pt-6 border-t-2 border-white/10 grid grid-cols-3 gap-6 text-xs text-[#94A3B8]">
              <div>
                <span className="block text-[#FACC15] font-bold text-sm font-display-brutalist uppercase">
                  140 LBF
                </span>
                <span className="text-[11px]">Tear Resistance</span>
              </div>
              <div>
                <span className="block text-[#FACC15] font-bold text-sm font-display-brutalist uppercase">
                  85 PSI
                </span>
                <span className="text-[11px]">Seam Burst Rating</span>
              </div>
              <div>
                <span className="block text-[#FACC15] font-bold text-sm font-display-brutalist uppercase">
                  10,152 FT
                </span>
                <span className="text-[11px]">Leadville Assembly</span>
              </div>
            </div>
          </div>

          {/* Right Heavy Frame: Authentic Cloudflare R2 Hero Photo with Stamped Steel Border */}
          <div className="lg:col-span-5">
            <div className="relative bg-[#111315] border-2 border-white p-3 shadow-2xl group">
              {/* Corner Industrial Crosshairs */}
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8] border-b-2 border-white/20 pb-2 mb-3">
                <span className="text-[#FACC15] font-bold">+ HEAVY_PROOF_SPECIMEN 01 +</span>
                <span>ELEV 10,152&apos;</span>
              </div>

              <div className="aspect-[4/5] relative overflow-hidden bg-black border-2 border-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler Heavy Duty Field Testing in Alpine River"
                  className="w-full h-full object-cover object-center filter contrast-125 brightness-90 group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute top-3 left-3 bg-[#FACC15] text-black font-display-brutalist text-xs uppercase px-2 py-0.5">
                  ANVIL RATED
                </div>
              </div>

              {/* Stamped Metal Spec Tag */}
              <div className="mt-3 p-3 bg-[#1C2026] border-2 border-white/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-white font-bold block text-[11px]">LEADVILLE BENCH // LOT 01/24</span>
                  <span className="text-[10px] text-[#94A3B8]">Toray 3L + 500D Cordura Shield</span>
                </div>
                <span className="text-[10px] font-bold bg-[#FACC15] text-black px-2 py-1">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three Industrial Engineering Standards */}
      <section className="py-20 px-6 lg:px-12 border-b-2 border-white/20 bg-[#14171B]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase tracking-[0.3em] text-[#FACC15] font-bold">
              Foundry Proof Standards
            </span>
            <h2 className="font-display-brutalist text-4xl sm:text-6xl uppercase tracking-tight text-white">
              DESTRUCTION TESTING
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              No glued tape welds or disposable offshore components. Built to withstand granite abrasion and frozen willow branches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#191D23] border-2 border-white/20 p-8 space-y-4">
              <span className="text-xs font-bold text-[#FACC15] tracking-widest block uppercase">
                {'// 01. Single-Needle Lockstitch'}
              </span>
              <h3 className="font-display-brutalist text-3xl uppercase text-white">
                HEAVY BONDED NYLON
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Assembled on a vintage Juki DDL series lockstitch machine with bonded continuous filament nylon thread.
                Seams are felled to ensure sharp river stone won&apos;t shred your garment.
              </p>
            </div>

            <div className="bg-[#191D23] border-2 border-white/20 p-8 space-y-4">
              <span className="text-xs font-bold text-[#FACC15] tracking-widest block uppercase">
                {'// 02. Cordura Abrasion Plates'}
              </span>
              <h3 className="font-display-brutalist text-3xl uppercase text-white">
                500D/1000D OVERLAYS
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Elbows, knees, seat, and cuffs are reinforced with textured mil-spec nylon scuff guards
                that prevent punctures when portaging through dense brush.
              </p>
            </div>

            <div className="bg-[#191D23] border-2 border-white/20 p-8 space-y-4">
              <span className="text-xs font-bold text-[#FACC15] tracking-widest block uppercase">
                {'// 03. Direct Depot Servicing'}
              </span>
              <h3 className="font-display-brutalist text-3xl uppercase text-white">
                FREE OVERHAUL BENCH
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                If barbed wire or a heavy fall tears a seam, mail it back to the Leadville workshop.
                Chris overhauls and re-stitches every piece on the original bench for life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Dense Factory Equipment Spec Sheets */}
      <section id="equipment-spec" className="py-24 px-6 lg:px-12 bg-[#111315]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 border-b-2 border-white/20 pb-6">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#FACC15] font-bold block">
                Leadville Plant Inventory
              </span>
              <h2 className="font-display-brutalist text-5xl sm:text-6xl uppercase tracking-tight text-white">
                EQUIPMENT SPEC SHEETS
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs uppercase tracking-widest text-[#FACC15] hover:text-white transition-colors flex items-center gap-2 font-bold"
            >
              <span>[VIEW ALL SPEC SHEETS // {products.length}]</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, idx) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group block bg-[#181C22] border-2 border-white/20 hover:border-[#FACC15] transition-all duration-300 p-5 space-y-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]"
                >
                  <div className="flex items-center justify-between text-xs border-b-2 border-white/10 pb-2 text-[#94A3B8]">
                    <span className="font-bold text-[#FACC15]">SPEC-0{idx + 1}</span>
                    <span className="uppercase text-white">{product.category?.name || 'HEAVY TOOLING'}</span>
                  </div>

                  <div className="aspect-[4/4] bg-black overflow-hidden relative border-2 border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-display-brutalist text-2xl uppercase text-white group-hover:text-[#FACC15] transition-colors truncate">
                        {product.title}
                      </h4>
                      <span className="text-base font-bold text-[#FACC15]">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-xs uppercase tracking-wider text-white group-hover:text-[#FACC15] flex items-center justify-between font-bold border-t-2 border-white/10">
                      <span>[INSPECT SPEC SHEET]</span>
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke Brutalist Footer */}
      <footer className="border-t-2 border-white/20 py-16 px-6 lg:px-12 bg-[#0E1012]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-4">
            <span className="font-display-brutalist text-lg text-[#FACC15] tracking-wider uppercase">
              BANKBEATERS INDUSTRIAL FOUNDRY
            </span>
            <span>·</span>
            <span>LEADVILLE, CO (10,152 FT)</span>
            <span>·</span>
            <span>CURIOSITY &gt; FEAR</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters Adventure Gear. Heavy Duty Lockstitched. Lifetime Repair.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
