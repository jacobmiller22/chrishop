'use client';

import React from 'react';
import type { StorefrontProduct } from '@/lib/catalog';

interface CartographerDispatchLayoutProps {
  products: StorefrontProduct[];
}

export const CartographerDispatchLayout: React.FC<CartographerDispatchLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#151311] text-[#EDE6DA] selection:bg-[#C85A32] selection:text-white font-mono-dispatch">
      {/* 1. Bespoke Cartographer Survey Header */}
      <header className="sticky top-0 z-40 w-full bg-[#151311]/95 backdrop-blur-md border-b border-[#2C2621]">
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
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-[#C85A32] flex items-center justify-center font-serif-cartographer text-base sm:text-lg font-bold text-[#151311] shrink-0">
                🧭
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-serif-cartographer text-base sm:text-2xl uppercase tracking-wider text-[#F7F2E8] group-hover:text-[#C85A32] transition-colors leading-none font-bold truncate">
                  BANKBEATERS
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-wider sm:tracking-[0.2em] text-[#9E9484] uppercase font-mono-dispatch pt-1 truncate">
                  Adventure Gear · Field Survey 10,152&apos;
                </span>
              </div>
            </a>
            <span className="hidden xl:inline-block text-[10px] tracking-widest text-[#7C7364] uppercase border-l border-[#2C2621] pl-6">
              LEADVILLE QUADRANGLE · 39.2508° N, 106.2925° W
            </span>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-[#B5ABA0] shrink-0">
            <a href="#survey-plates" className="hover:text-[#C85A32] transition-colors hidden xs:inline">
              Survey Plates
            </a>
            <a href="#survey-journal" className="hover:text-[#C85A32] transition-colors hidden sm:inline">
              Surveyor Log
            </a>
            <div
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border border-[#443B33] bg-[#1E1B18] text-[#EDE6DA] flex items-center gap-1.5 sm:gap-2 rounded-xs shrink-0 cursor-default select-none"
            >
              <span className="text-[10px] sm:text-[11px] font-bold">Gear Roll</span>
              <span className="text-[9px] sm:text-[10px] bg-[#2E2822] px-1.5 py-0.5 rounded text-[#D4A373]">0</span>
            </div>
          </nav>
        </div>
      </header>

      {/* 2. Split-Page Expedition Dispatch Hero */}
      <section className="relative w-full border-b border-[#2C2621] bg-[#171512] py-8 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left Expedition Journal Narrative */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[#201D19] border border-[#3E352C] px-2.5 py-1 sm:px-3.5 py-1.5 rounded-xs max-w-full">
              <span className="w-2 h-2 rounded-full bg-[#C85A32] animate-pulse shrink-0" />
              <span className="text-[9px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-[#D4A373] font-bold break-words">
                EXPEDITION DISPATCH // LOG ENTRY NO. 104
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#9E9484] block font-semibold">
                Option E · Cartographer &amp; Field Dispatch
              </span>
              <h1 className="font-serif-cartographer text-4xl sm:text-6xl lg:text-8xl font-bold uppercase tracking-tight text-[#F7F2E8] leading-[0.95] break-words">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-xs sm:text-base text-[#CBC2B4] leading-relaxed max-w-xl pt-1 sm:pt-2">
                Technical foul-weather outerwear, reinforced guide trousers, and convertible chest rigs.
                Hand-patterned and sewn by Chris on an industrial Juki lockstitch machine in Leadville, Colorado
                for backcountry anglers who bushwhack the bank on foot.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
              <a
                href="#survey-plates"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 bg-[#C85A32] hover:bg-[#D96B43] text-[#151311] font-serif-cartographer text-sm sm:text-base uppercase font-bold tracking-wider transition-all duration-200 rounded-xs shadow-lg shadow-[#C85A32]/20"
              >
                Explore Gear Roster ({products.length})
              </a>
              <a
                href="#survey-journal"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 border border-[#443B33] hover:border-[#D4A373] bg-[#1E1B18] hover:bg-[#25211D] text-[#EDE6DA] font-serif-cartographer text-sm sm:text-base uppercase font-bold tracking-wider transition-all duration-200 rounded-xs"
              >
                Surveyor Field Notes
              </a>
            </div>

            {/* Field Dispatch Gauge Ticker */}
            <div className="pt-6 border-t border-[#26211C] grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-xs text-[#9E9484]">
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start border-b sm:border-b-0 border-[#26211C] pb-2 sm:pb-0">
                <span className="block text-[#D4A373] font-bold text-xs sm:text-sm font-serif-cartographer uppercase">
                  10,152 FT
                </span>
                <span className="text-[10px] sm:text-[11px]">Sawatch Elevation</span>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start border-b sm:border-b-0 border-[#26211C] pb-2 sm:pb-0">
                <span className="block text-[#D4A373] font-bold text-xs sm:text-sm font-serif-cartographer uppercase">
                  142 CFS
                </span>
                <span className="text-[10px] sm:text-[11px]">Headwater Flow // 41°F</span>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                <span className="block text-[#D4A373] font-bold text-xs sm:text-sm font-serif-cartographer uppercase">
                  Single-Needle
                </span>
                <span className="text-[10px] sm:text-[11px]">Lockstitched Integrity</span>
              </div>
            </div>
          </div>

          {/* Right Archival Plate: Authentic Cloudflare R2 Hero Photo with Brass Pins & Surveyor Overlay */}
          <div className="lg:col-span-5">
            <div className="relative bg-[#1C1916] border-2 border-[#382F26] p-4 shadow-2xl rounded-xs group">
              {/* Surveyor Header Strip */}
              <div className="flex items-center justify-between text-[10px] text-[#9E9484] border-b border-[#2C251E] pb-2 mb-3">
                <span className="text-[#C85A32] font-bold">PLATE 01 // HIGH-ALPINE SURVEY</span>
                <span>QUADRANGLE: 39°15&apos;N 106°17&apos;W</span>
              </div>

              <div className="aspect-[4/5] relative overflow-hidden bg-[#100E0C] border border-[#2F2720]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Surveyor Angler in High Alpine River Canyon"
                  className="w-full h-full object-cover object-center filter sepia-[15%] contrast-[1.1] brightness-95 group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#151311] via-transparent to-transparent opacity-60" />

                {/* Archival Corner Stamp */}
                <div className="absolute bottom-3 left-3 bg-[#171512]/90 backdrop-blur-sm border border-[#3E3328] px-3 py-1.5 text-[10px] text-[#D4A373]">
                  LEADVILLE WORKSHOP // SERIAL BATCH 01
                </div>
              </div>

              {/* Physical Field Label */}
              <div className="mt-3 p-3 bg-[#191613] border border-[#2E271F] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#D4A373] font-bold block text-[11px]">SPECIMEN: BUSHWHACK ANORAK</span>
                  <span className="text-[10px] text-[#7C7364]">Field Tested Above Timberline</span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-[#25201A] text-[#C85A32] border border-[#3D3328]">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Surveyor Field Ledger (3 Craft Standards) */}
      <section id="survey-journal" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 border-b border-[#2C2621] bg-[#181613]">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-xs uppercase tracking-[0.3em] text-[#C85A32] font-bold">
              Cartographic Field Standards
            </span>
            <h2 className="font-serif-cartographer text-2xl sm:text-5xl font-bold uppercase tracking-tight text-[#F7F2E8]">
              The Sawatch Ledger
            </h2>
            <p className="text-xs sm:text-sm text-[#B5ABA0] leading-relaxed">
              Mapped and crafted in the highest incorporated city in North America. Built for extreme elevation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-[#1C1916] border border-[#2E271F] p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#C85A32] tracking-widest block uppercase">
                {'// 01. Topographic Proofing'}
              </span>
              <h3 className="font-serif-cartographer text-xl sm:text-2xl font-bold uppercase text-[#F7F2E8]">
                River-Tested Hydrostatic
              </h3>
              <p className="text-xs text-[#B5ABA0] leading-relaxed">
                Tested against torrential high-country squalls along Arkansas River headwaters.
                Toray 3-layer waterproof breathable membranes keep you dry during hours of cold-water wading.
              </p>
            </div>

            <div className="bg-[#1C1916] border border-[#2E271F] p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#C85A32] tracking-widest block uppercase">
                {'// 02. Single-Needle Lockstitch'}
              </span>
              <h3 className="font-serif-cartographer text-xl sm:text-2xl font-bold uppercase text-[#F7F2E8]">
                Mechanical Durability
              </h3>
              <p className="text-xs text-[#B5ABA0] leading-relaxed">
                Patterned and sewn on a refurbished Juki machine with heavy bonded synthetic thread.
                Felled seams guarantee that dense mountain willow scrub won&apos;t pop a stitch.
              </p>
            </div>

            <div className="bg-[#1C1916] border border-[#2E271F] p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="text-xs font-bold text-[#C85A32] tracking-widest block uppercase">
                {'// 03. Lifetime Stewardship'}
              </span>
              <h3 className="font-serif-cartographer text-xl sm:text-2xl font-bold uppercase text-[#F7F2E8]">
                Perpetual Repair Log
              </h3>
              <p className="text-xs text-[#B5ABA0] leading-relaxed">
                No warranty forms or purchase receipts required. If an expedition tears your equipment,
                mail it back to Leadville for free re-stitching on the original bench.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Equipment Survey Plates Grid */}
      <section id="survey-plates" className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#151311]">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 border-b border-[#2C2621] pb-6">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#C85A32] font-bold block">
                Leadville Headwaters Equipment
              </span>
              <h2 className="font-serif-cartographer text-3xl sm:text-5xl font-bold uppercase tracking-tight text-[#F7F2E8]">
                Survey Catalog Plates
              </h2>
            </div>
            <span
              className="text-xs uppercase tracking-widest text-[#D4A373] flex items-center gap-2 select-none"
            >
              <span>Survey Catalog Plates ({products.length})</span>
              <span>· Archival</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((product, idx) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <div
                  key={product.id}
                  className="group block bg-[#1C1916] border border-[#2E271F] hover:border-[#C85A32]/60 transition-all duration-300 p-4 sm:p-5 space-y-4 cursor-default"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#9E9484] border-b border-[#262019] pb-2">
                    <span className="font-bold text-[#C85A32]">PLATE-0{idx + 1}</span>
                    <span className="text-[#D4A373] uppercase tracking-wider">
                      {product.category?.name || 'FIELD UTILITY'}
                    </span>
                  </div>

                  <div className="aspect-[4/4] bg-[#110F0D] overflow-hidden relative border border-[#262019]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center filter sepia-[10%] group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-serif-cartographer text-lg sm:text-xl font-bold uppercase text-[#F7F2E8] group-hover:text-[#C85A32] transition-colors">
                        {product.title}
                      </h4>
                      <span className="text-sm font-bold text-[#D4A373]">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[#9E9484] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[11px] uppercase tracking-wider text-[#B5ABA0] flex items-center gap-1 font-bold select-none">
                      <span>Survey Spec Locked</span>
                      <span>·</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke Cartographer Footer */}
      <footer className="border-t border-[#2C2621] py-10 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#110F0D]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#9E9484] text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
            <span className="font-serif-cartographer text-sm sm:text-base font-bold text-[#C85A32] tracking-wider">
              BANKBEATERS CARTOGRAPHY &amp; EXPEDITION
            </span>
            <span>·</span>
            <span>Leadville (10,152 FT)</span>
            <span>·</span>
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
