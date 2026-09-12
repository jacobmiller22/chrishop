'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface FieldWorkshopLayoutProps {
  products: StorefrontProduct[];
}

export const FieldWorkshopLayout: React.FC<FieldWorkshopLayoutProps> = ({ products }) => {
  const flagship = products.find((p) => p.slug === 'bushwhack-storm-anorak') || products[0];

  return (
    <div className="w-full min-h-screen bg-[#101311] text-[#EBE6DD] selection:bg-[#E55B24] selection:text-white font-mono-workshop">
      {/* 1. Bespoke Field Workshop Header */}
      <header className="sticky top-0 z-40 w-full bg-[#101311]/95 backdrop-blur-md border-b border-[#2A342D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="group flex items-center gap-2.5 sm:gap-3">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-[#E55B24] flex items-center justify-center font-display-workshop text-base sm:text-lg font-black text-black tracking-tighter shrink-0">
                BB
              </span>
              <div className="flex flex-col">
                <span className="font-display-workshop text-xl sm:text-2xl uppercase tracking-wider text-[#F5EFEB] group-hover:text-[#E55B24] transition-colors leading-none font-bold">
                  BANKBEATERS
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-[0.15em] sm:tracking-[0.2em] text-[#8C9A8E] uppercase font-mono-workshop pt-1 truncate">
                  Adventure Gear · Field Workshop
                </span>
              </div>
            </Link>
            <span className="hidden xl:inline-block text-[10px] tracking-widest text-[#6E7B70] uppercase border-l border-[#2A342D] pl-6">
              LEADVILLE, CO · ELEV 10,152 FT
            </span>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest font-mono-workshop text-[#A2B1A4]">
            <a href="#bench-builds" className="hover:text-[#E55B24] transition-colors hidden xs:inline">
              Bench Builds
            </a>
            <Link href="/products?category=outerwear" className="hover:text-[#E55B24] transition-colors hidden sm:inline">
              Outerwear
            </Link>
            <Link href="/products?category=packs-carry" className="hover:text-[#E55B24] transition-colors hidden md:inline">
              Carry Rigs
            </Link>
            <Link href="/about" className="hover:text-[#E55B24] transition-colors hidden sm:inline">
              Maker&apos;s Story
            </Link>
            <Link
              href="/cart"
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border border-[#445348] hover:border-[#E55B24] bg-[#171D18] text-[#EBE6DD] hover:text-[#E55B24] transition-all flex items-center gap-1.5 sm:gap-2 rounded-xs shrink-0"
            >
              <span className="text-[10px] sm:text-[11px] font-bold">Gear Roll</span>
              <span className="text-[9px] sm:text-[10px] bg-[#222C24] px-1.5 py-0.5 rounded text-[#D4A373]">0</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Asymmetric Craftsman Hero */}
      <section className="relative w-full border-b border-[#2A342D] bg-[#121614] py-10 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left Hero Narrative */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[#1C241F] border border-[#354338] px-3 sm:px-3.5 py-1.5 rounded-sm">
              <span className="w-2 h-2 rounded-full bg-[#E55B24] animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#D4A373] font-bold">
                Small-Batch Drop Live // 3 to 6 Units Per Silhouette
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#8C9A8E] block font-semibold">
                Option A · Field Workshop Archetype
              </span>
              <h1 className="font-display-workshop text-4xl sm:text-6xl lg:text-8xl font-bold uppercase tracking-tight text-[#F7F2EB] leading-[0.95] break-words">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-xs sm:text-base text-[#B8C5BA] leading-relaxed max-w-xl pt-1 sm:pt-2">
                Technical foul-weather outerwear, reinforced guide trousers, and convertible chest rigs.
                Hand-patterned and sewn by Chris on an industrial Juki lockstitch machine in Leadville, Colorado
                for backcountry anglers who bushwhack the bank on foot.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
              <a
                href="#bench-builds"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 bg-[#E55B24] hover:bg-[#F26E38] text-[#101311] font-display-workshop text-sm sm:text-base uppercase font-bold tracking-wider transition-all duration-200 rounded-sm shadow-lg shadow-[#E55B24]/20"
              >
                Explore Gear Roster ({products.length})
              </a>
              <Link
                href="/about"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 border border-[#445348] hover:border-[#D4A373] bg-[#171D18] hover:bg-[#1C241F] text-[#EBE6DD] font-display-workshop text-sm sm:text-base uppercase font-bold tracking-wider transition-all duration-200 rounded-sm"
              >
                The Maker&apos;s Bench
              </Link>
            </div>

            {/* Quick Workbench Metrics */}
            <div className="pt-6 border-t border-[#252E27] grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-xs text-[#8C9A8E]">
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start border-b sm:border-b-0 border-[#252E27] pb-2 sm:pb-0">
                <span className="block text-[#D4A373] font-bold text-xs sm:text-sm font-display-workshop uppercase">
                  10,152 FT
                </span>
                <span className="text-[10px] sm:text-[11px]">Leadville Workshop</span>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start border-b sm:border-b-0 border-[#252E27] pb-2 sm:pb-0">
                <span className="block text-[#D4A373] font-bold text-xs sm:text-sm font-display-workshop uppercase">
                  Toray 3-Layer
                </span>
                <span className="text-[10px] sm:text-[11px]">20,000mm Membrane</span>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                <span className="block text-[#D4A373] font-bold text-xs sm:text-sm font-display-workshop uppercase">
                  Perpetual
                </span>
                <span className="text-[10px] sm:text-[11px]">Bench Repair Guarantee</span>
              </div>
            </div>
          </div>

          {/* Right Hero Image: Authentic Cloudflare R2 Hero Photo with Archival Workshop Tag */}
          <div className="lg:col-span-5">
            <div className="relative bg-[#171D18] border-2 border-[#354338] p-3 shadow-2xl rounded-sm group">
              <div className="aspect-[4/5] relative overflow-hidden bg-[#0D100E]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler Bushwhacking in Colorado High Alpine River"
                  className="w-full h-full object-cover object-center filter contrast-105 brightness-95 group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101311] via-transparent to-transparent opacity-60" />
              </div>

              {/* Archival Workshop Tag Overlay */}
              <div className="mt-3 p-3 sm:p-4 bg-[#141A15] border border-[#2D382F] rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div>
                  <span className="text-[10px] font-mono-workshop text-[#E55B24] uppercase tracking-widest block font-bold">
                    ARCHIVAL SPECIMEN 01
                  </span>
                  <span className="text-xs font-mono-workshop text-[#EBE6DD] font-semibold block">
                    High Alpine River Recon · Leadville, CO
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-[#222B24] text-[#D4A373] border border-[#3E4D41]">
                  100% Hand-Sewn
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Maker's Bench Provenance (3 Craft Pillars) */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 border-b border-[#2A342D] bg-[#141815]">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#E55B24] font-bold">
              Provenance &amp; Integrity
            </span>
            <h2 className="font-display-workshop text-2xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-[#F7F2EB]">
              The Crafting Ledger
            </h2>
            <p className="text-xs sm:text-sm text-[#A2B1A4] leading-relaxed">
              No overseas mass manufacturing, no glued heat-welds that delaminate after two seasons of dense willows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
            <div className="bg-[#171D18] border border-[#2D382F] p-5 sm:p-8 rounded-sm space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#E55B24] tracking-widest block uppercase">
                {'// 01. Single-Needle Construction'}
              </span>
              <h3 className="font-display-workshop text-xl sm:text-2xl font-bold uppercase text-[#F7F2EB]">
                Industrial Lockstitch
              </h3>
              <p className="text-xs text-[#A2B1A4] leading-relaxed">
                Assembled on a vintage Juki DDL series lockstitch machine with bonded continuous filament nylon thread.
                Seams are felled to ensure tree bark and rock faces won&apos;t tear your seams.
              </p>
            </div>

            <div className="bg-[#171D18] border border-[#2D382F] p-5 sm:p-8 rounded-sm space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#E55B24] tracking-widest block uppercase">
                {'// 02. Curated Bombproof Textiles'}
              </span>
              <h3 className="font-display-workshop text-xl sm:text-2xl font-bold uppercase text-[#F7F2EB]">
                Toray 3L &amp; Cordura
              </h3>
              <p className="text-xs text-[#A2B1A4] leading-relaxed">
                Tested against torrential high-country squalls. We pair Japanese waterproof breathable membranes
                with 500D/1000D Cordura scuff guards on high-friction strike zones.
              </p>
            </div>

            <div className="bg-[#171D18] border border-[#2D382F] p-5 sm:p-8 rounded-sm space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#E55B24] tracking-widest block uppercase">
                {'// 03. Lifetime Workshop Guarantee'}
              </span>
              <h3 className="font-display-workshop text-xl sm:text-2xl font-bold uppercase text-[#F7F2EB]">
                Perpetual Repair Bench
              </h3>
              <p className="text-xs text-[#A2B1A4] leading-relaxed">
                If you rip an arm on barbwire or blow a zipper during a backcountry portage, send it back to the
                Leadville workshop. Chris repairs every piece on the original machine for the life of the gear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Active Small-Batch Drop Roster */}
      <section id="bench-builds" className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#101311]">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 sm:gap-4 border-b border-[#2A342D] pb-4 sm:pb-6">
            <div>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#E55B24] font-bold block">
                Leadville Workbench Output
              </span>
              <h2 className="font-display-workshop text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-[#F7F2EB]">
                Active Bench Builds
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs uppercase tracking-widest text-[#D4A373] hover:text-[#E55B24] transition-colors flex items-center gap-2"
            >
              <span>View All Silhouettes ({products.length})</span>
              <span>→</span>
            </Link>
          </div>

          {/* Flagship Highlight Banner */}
          {flagship && (
            <div className="bg-[#151B16] border-2 border-[#38463B] p-5 sm:p-8 lg:p-12 rounded-sm grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-center">
              <div className="lg:col-span-5">
                <div className="aspect-[4/5] bg-[#0E120F] border border-[#2D382F] overflow-hidden relative group max-w-md mx-auto lg:max-w-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagship.featured_image || '/media/bushwhack-storm-anorak/hero.jpeg'}
                    alt={flagship.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 bg-[#E55B24] text-black font-display-workshop font-bold text-xs uppercase px-3 py-1">
                    Workbench Flagship
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4 sm:space-y-6">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                  <span className="bg-[#222C24] text-[#D4A373] px-2.5 sm:px-3 py-1 border border-[#3A4A3D] font-bold text-[10px] sm:text-xs">
                    EDITION 01/24 · 3 UNITS SEWN
                  </span>
                  <span className="text-[#8C9A8E] text-[10px] sm:text-xs">SINGLE-NEEDLE LOCKSTITCH</span>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <h3 className="font-display-workshop text-2xl sm:text-4xl lg:text-5xl font-bold uppercase text-[#F7F2EB]">
                    {flagship.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#B8C5BA] leading-relaxed">
                    {flagship.description}
                  </p>
                </div>

                {flagship.materials && (
                  <div className="p-3 sm:p-4 bg-[#111613] border border-[#273229] space-y-1 text-xs text-[#8C9A8E]">
                    <span className="text-[#E55B24] uppercase font-bold block">Workbench Material Specs:</span>
                    <p className="text-[#D4A373]">· {flagship.materials}</p>
                    {flagship.weight && <p className="text-[#8C9A8E]">· Finished Bench Weight: {flagship.weight}</p>}
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <span className="font-display-workshop text-2xl sm:text-3xl font-bold text-[#F7F2EB]">
                    ${flagship.base_price.toFixed(2)}
                  </span>
                  <Link
                    href={`/products/${flagship.slug}`}
                    className="w-full sm:w-auto text-center px-6 py-3 bg-[#E55B24] hover:bg-[#F26E38] text-black font-display-workshop uppercase font-bold text-sm tracking-wider transition-colors"
                  >
                    Examine Build Spec →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Secondary Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((product, idx) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group block bg-[#151B16] border border-[#2D382F] hover:border-[#E55B24] transition-all duration-300 p-4 sm:p-5 rounded-sm space-y-3 sm:space-y-4"
                >
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#8C9A8E] border-b border-[#252F27] pb-2">
                    <span className="font-bold text-[#E55B24]">BENCH-0{idx + 1}</span>
                    <span className="text-[#D4A373] uppercase tracking-wider">
                      {product.category?.name || 'FIELD UTILITY'}
                    </span>
                  </div>

                  <div className="aspect-[4/4] bg-[#0E120F] overflow-hidden relative border border-[#252F27]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-display-workshop text-lg sm:text-xl font-bold uppercase text-[#F7F2EB] group-hover:text-[#E55B24] transition-colors">
                        {product.title}
                      </h4>
                      <span className="text-sm font-bold text-[#D4A373]">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[#8C9A8E] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-[#A2B1A4] group-hover:text-[#E55B24] flex items-center gap-1 font-bold">
                      <span>View Specs &amp; Sizing</span>
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke Field Workshop Footer */}
      <footer className="border-t border-[#2A342D] py-12 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#0D100E]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 text-xs text-[#8C9A8E] text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
            <span className="font-display-workshop text-sm sm:text-base font-bold text-[#E55B24] tracking-wider">
              BANKBEATERS FIELD WORKSHOP
            </span>
            <span className="hidden sm:inline">·</span>
            <span>Leadville, Colorado (10,152 FT)</span>
            <span className="hidden sm:inline">·</span>
            <span>Curiosity &gt; Fear</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters Adventure Gear. Single-Needle Assembled. Free Bench Repair.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
