'use client';

import React from 'react';
import type { StorefrontProduct } from '@/lib/catalog';

interface SeventiesRetroLayoutProps {
  products: StorefrontProduct[];
}

export const SeventiesRetroLayout: React.FC<SeventiesRetroLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#0F1A13] text-[#F3EAD7] selection:bg-[#E5A93C] selection:text-[#0F1A13] font-mono-workshop">
      {/* 1. Bespoke 1970s Backcountry Catalog Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0F1A13]/95 backdrop-blur-md border-b-2 border-[#203426]">
        {/* Iconic 1970s Tri-Color Ribbon Stripe */}
        <div className="h-1.5 w-full flex">
          <div className="h-full w-1/3 bg-[#B84A28]" />
          <div className="h-full w-1/3 bg-[#E5A93C]" />
          <div className="h-full w-1/3 bg-[#3D6B52]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              className="group flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E5A93C] flex items-center justify-center font-display-retro font-black text-[#0F1A13] text-base sm:text-lg shadow-md shrink-0">
                74
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-display-retro text-base sm:text-2xl uppercase tracking-wider text-[#F8F2E4] group-hover:text-[#E5A93C] transition-colors leading-none font-black truncate">
                  BANKBEATERS
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest text-[#93A89A] uppercase pt-0.5 sm:pt-1 truncate">
                  Adventure Gear · Leadville Backcountry Catalog
                </span>
              </div>
            </a>
            <span className="hidden xl:inline-block text-[10px] tracking-widest text-[#6E8575] uppercase border-l border-[#203426] pl-6 font-bold">
              EST. LEADVILLE, CO · 10,152 FT
            </span>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-xs uppercase tracking-widest text-[#BDCEBF] shrink-0">
            <a href="#catalog-items" className="hover:text-[#E5A93C] transition-colors hidden sm:inline">
              The Catalog
            </a>
            <a href="#clean-angling-ethic" className="hover:text-[#E5A93C] transition-colors hidden sm:inline">
              Mountain Ethic
            </a>
            <div
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border-2 border-[#E5A93C] bg-[#16271D] text-[#F3EAD7] flex items-center gap-1.5 sm:gap-2 rounded-sm font-bold shrink-0 cursor-default select-none"
            >
              <span className="text-[10px] sm:text-[11px]">Gear Roll</span>
              <span className="text-[10px] bg-[#0F1A13] text-[#E5A93C] px-1.5 py-0.5 rounded">0</span>
            </div>
          </nav>
        </div>
      </header>

      {/* 2. 1974 Vintage Mountain Catalog Cover Hero */}
      <section className="relative w-full border-b-2 border-[#203426] bg-[#122017] py-8 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Vintage Narrative */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[#1A2E22] border border-[#2B4A37] px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-sm max-w-full">
              <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#E5A93C] animate-pulse shrink-0" />
              <span className="text-[9px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-[#E5A93C] font-bold break-words">
                DIRT-BAG MOUNTAIN ETHIC // RUN NO. 74
              </span>
            </div>

            <div className="space-y-2.5 sm:space-y-4">
              <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#93A89A] block font-bold">
                Option I · 1970s Golden Era Backcountry
              </span>
              <h1 className="font-display-retro text-3xl sm:text-6xl lg:text-8xl font-black uppercase tracking-tight text-[#FAF4E8] leading-[0.95] break-words">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-xs sm:text-base text-[#C6D5C8] leading-relaxed max-w-xl pt-1 sm:pt-2">
                Technical foul-weather outerwear, reinforced guide trousers, and convertible chest rigs.
                Hand-patterned and sewn by Chris on an industrial Juki lockstitch machine in Leadville, Colorado
                for backcountry anglers who bushwhack the bank on foot.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
              <a
                href="#catalog-items"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 bg-[#E5A93C] hover:bg-[#F2B94D] text-[#0F1A13] font-display-retro text-xs sm:text-base uppercase font-black tracking-wider transition-all duration-200 rounded-sm shadow-lg shadow-[#E5A93C]/20 border-2 border-[#C99026]"
              >
                Explore Gear Roster ({products.length})
              </a>
              <a
                href="#clean-angling-ethic"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 border-2 border-[#B84A28] hover:border-[#E5A93C] bg-[#16271D] hover:bg-[#1E3326] text-[#F3EAD7] font-display-retro text-xs sm:text-base uppercase font-black tracking-wider transition-all duration-200 rounded-sm"
              >
                The Dirtbag Manifesto
              </a>
            </div>

            {/* Vintage Tri-Spec Ledger */}
            <div className="pt-5 sm:pt-6 border-t border-[#1D3325] grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-6 text-xs text-[#93A89A]">
              <div className="flex items-center justify-between sm:block border-b sm:border-b-0 border-[#1D3325] pb-2 sm:pb-0">
                <span className="text-[11px]">Sawatch Pass Station</span>
                <span className="block text-[#E5A93C] font-bold text-sm font-display-retro uppercase">10,152 FT</span>
              </div>
              <div className="flex items-center justify-between sm:block border-b sm:border-b-0 border-[#1D3325] pb-2 sm:pb-0">
                <span className="text-[11px]">20,000mm High Water</span>
                <span className="block text-[#E5A93C] font-bold text-sm font-display-retro uppercase">Toray 3-Layer</span>
              </div>
              <div className="flex items-center justify-between sm:block">
                <span className="text-[11px]">Free Stitched Repairs</span>
                <span className="block text-[#E5A93C] font-bold text-sm font-display-retro uppercase">Perpetual</span>
              </div>
            </div>
          </div>

          {/* Right Vintage Kodachrome Plate: Authentic Cloudflare R2 Hero Photo with 70s Styling */}
          <div className="lg:col-span-5 w-full">
            <div className="relative bg-[#172A1F] border-2 border-[#2E4D39] p-2.5 sm:p-4 shadow-2xl rounded-sm group w-full">
              {/* Retro Header Tag */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#93A89A] border-b border-[#243F2E] pb-2 mb-2 sm:mb-3 font-bold">
                <span className="text-[#E5A93C] truncate">KODACHROME 01 // 1974</span>
                <span className="text-[#B84A28] shrink-0">CO ROCKIES</span>
              </div>

              <div className="aspect-[4/5] relative overflow-hidden bg-[#0A120D] border border-[#2B4734]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler in High Alpine Colorado River"
                  className="w-full h-full object-cover object-center filter contrast-110 brightness-95 saturate-[1.15] group-hover:scale-105 transition-transform duration-700 ease-out"
                />

                {/* Vintage Circular Mountain Badge */}
                <div className="absolute top-4 right-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#E5A93C] border-2 border-[#0F1A13] flex flex-col items-center justify-center text-[#0F1A13] shadow-lg">
                  <span className="text-[8px] sm:text-[9px] font-black leading-none">TESTED</span>
                  <span className="text-[10px] sm:text-[11px] font-display-retro font-black leading-none">100%</span>
                  <span className="text-[7px] sm:text-[8px] font-bold leading-none">COLO.</span>
                </div>
              </div>

              {/* Retro Caption Bar */}
              <div className="mt-2.5 sm:mt-3 p-2.5 sm:p-3 bg-[#132219] border border-[#243F2E] flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[#F8F2E4] font-bold block text-[11px] truncate">LEADVILLE BENCH SPECIMEN</span>
                  <span className="text-[10px] text-[#849B8B] block truncate">Single-Needle Bonded Nylon Seams</span>
                </div>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-[#B84A28] text-white shrink-0">
                  AUTHENTIC
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Clean Angling & Dirtbag Ethic (3 Pillars) */}
      <section id="clean-angling-ethic" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 border-b-2 border-[#203426] bg-[#142319]">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-xs uppercase tracking-[0.3em] text-[#E5A93C] font-bold">
              Golden-Era Mountain Principles
            </span>
            <h2 className="font-display-retro text-2xl sm:text-5xl font-black uppercase tracking-tight text-[#FAF4E8]">
              The Clean Angling Manifesto
            </h2>
            <p className="text-xs sm:text-sm text-[#BDCEBF] leading-relaxed">
              Inspired by the dirtbag climbers and backcountry anglers who built their own tools and respected wild rivers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-[#182B1F] border border-[#264230] p-5 sm:p-8 rounded-sm space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#E5A93C] tracking-widest block uppercase">
                {'// 01. The Craftsman Bench'}
              </span>
              <h3 className="font-display-retro text-xl sm:text-2xl font-black uppercase text-[#FAF4E8]">
                Juki Lockstitching
              </h3>
              <p className="text-xs text-[#BDCEBF] leading-relaxed">
                Assembled on a vintage Juki DDL series lockstitch machine with bonded continuous filament nylon thread.
                Seams are felled to ensure river rocks won&apos;t pop your stitch.
              </p>
            </div>

            <div className="bg-[#182B1F] border border-[#264230] p-5 sm:p-8 rounded-sm space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#E5A93C] tracking-widest block uppercase">
                {'// 02. Honest Bombproof Cloth'}
              </span>
              <h3 className="font-display-retro text-xl sm:text-2xl font-black uppercase text-[#FAF4E8]">
                Toray 3L &amp; Cordura
              </h3>
              <p className="text-xs text-[#BDCEBF] leading-relaxed">
                Tested against torrential high-country squalls. We pair Japanese waterproof breathable membranes
                with 500D/1000D Cordura scuff guards on high-friction strike zones.
              </p>
            </div>

            <div className="bg-[#182B1F] border border-[#264230] p-5 sm:p-8 rounded-sm space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#E5A93C] tracking-widest block uppercase">
                {'// 03. Lifetime Repair Ethic'}
              </span>
              <h3 className="font-display-retro text-xl sm:text-2xl font-black uppercase text-[#FAF4E8]">
                Never Discarded
              </h3>
              <p className="text-xs text-[#BDCEBF] leading-relaxed">
                If you rip a knee on granite or tear an arm on willow brush, send it back to the Leadville workshop.
                Chris repairs every piece on the original machine for the life of the gear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Vintage Mountain Catalog Roster */}
      <section id="catalog-items" className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#0F1A13]">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 border-b-2 border-[#203426] pb-6">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#E5A93C] font-bold block">
                Leadville Catalog Output
              </span>
              <h2 className="font-display-retro text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#FAF4E8]">
                Mountain Equipment Catalog
              </h2>
            </div>
            <span
              className="text-xs uppercase tracking-widest text-[#E5A93C] flex items-center gap-2 font-bold select-none"
            >
              <span>1974 Catalog Archive ({products.length})</span>
              <span>· Colorado</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((product, idx) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <div
                  key={product.id}
                  className="group block bg-[#16271D] border-2 border-[#264230] hover:border-[#E5A93C]/70 transition-all duration-300 p-4 sm:p-5 rounded-sm space-y-4 cursor-default"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#93A89A] border-b border-[#1E3326] pb-2 font-bold">
                    <span className="text-[#E5A93C]">ITEM-0{idx + 1}</span>
                    <span className="text-[#B84A28] uppercase">
                      {product.category?.name || 'FIELD SILHOUETTE'}
                    </span>
                  </div>

                  <div className="aspect-[4/4] bg-[#0A120D] overflow-hidden relative border border-[#1E3326]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-display-retro text-lg sm:text-xl font-black uppercase text-[#FAF4E8] group-hover:text-[#E5A93C] transition-colors truncate">
                        {product.title}
                      </h4>
                      <span className="text-base font-bold text-[#E5A93C]">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[#93A89A] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[11px] uppercase tracking-wider text-[#BDCEBF] flex items-center gap-1 font-bold border-t border-[#1E3326] select-none">
                      <span>Item Spec Locked</span>
                      <span className="text-[#E5A93C]">·</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke 1970s Catalog Footer */}
      <footer className="border-t-2 border-[#203426] py-10 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#0A120D]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#93A89A] text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
            <span className="font-display-retro text-sm sm:text-base font-black text-[#E5A93C] tracking-wider uppercase">
              BANKBEATERS BACKCOUNTRY CATALOG
            </span>
            <span>·</span>
            <span>LEADVILLE, CO (10,152 FT)</span>
            <span>·</span>
            <span>CURIOSITY &gt; FEAR</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters Adventure Gear. 100% Hand-Sewn in Colorado. Free Bench Repair.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
