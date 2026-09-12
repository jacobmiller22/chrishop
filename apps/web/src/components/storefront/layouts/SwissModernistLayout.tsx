'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface SwissModernistLayoutProps {
  products: StorefrontProduct[];
}

export const SwissModernistLayout: React.FC<SwissModernistLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#0A0B0E] text-[#F8FAFC] selection:bg-[#002FA7] selection:text-white font-sans-alpine">
      {/* 1. Bespoke Swiss International Grid Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0A0B0E]/95 backdrop-blur-md border-b border-[#20242C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/" className="group flex items-center gap-2.5 sm:gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 bg-[#002FA7] text-white font-bold flex items-center justify-center text-xs shrink-0">
                CH
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-sans-alpine text-lg sm:text-xl font-bold uppercase tracking-wider text-white group-hover:text-[#3B82F6] transition-colors leading-none truncate">
                  BANKBEATERS
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-widest text-[#64748B] uppercase font-mono-swiss pt-0.5 sm:pt-1 truncate">
                  Adventure Gear · System 10,152&apos;
                </span>
              </div>
            </Link>
            <span className="hidden xl:inline-block text-[11px] font-mono-swiss text-[#64748B] uppercase border-l border-[#20242C] pl-6">
              LEADVILLE, CO // GEODETIC DATUM 39.2508° N, 106.2925° W
            </span>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-xs uppercase font-mono-swiss tracking-wider text-[#94A3B8]">
            <a href="#system-matrix" className="hover:text-white transition-colors hidden sm:inline">
              [01 / MATRIX]
            </a>
            <Link href="/products?category=outerwear" className="hover:text-white transition-colors hidden md:inline">
              [02 / OUTERWEAR]
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              [04 / ABOUT]
            </Link>
            <Link
              href="/cart"
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border border-[#334155] hover:border-[#002FA7] bg-[#11141A] text-white hover:bg-[#002FA7] transition-all flex items-center gap-1.5 sm:gap-2 shrink-0"
            >
              <span className="text-[10px] sm:text-[11px]">GEAR ROLL</span>
              <span className="text-[10px] bg-[#1E2430] px-1.5 py-0.5 rounded text-[#38BDF8]">0</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Strict 8-Column Mathematical Poster Hero */}
      <section className="relative w-full border-b border-[#20242C] bg-[#0E1015] py-10 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Rationalist Narrative */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[#131720] border border-[#232936] px-3 py-1 sm:px-3.5 sm:py-1.5">
              <span className="w-2 h-2 rounded-none bg-[#002FA7]" />
              <span className="text-[10px] sm:text-xs uppercase font-mono-swiss tracking-wider text-[#38BDF8]">
                OPTION H // SWISS INTERNATIONAL SYSTEMATICS
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <span className="text-xs uppercase tracking-[0.25em] text-[#64748B] font-mono-swiss block">
                Rational High-Altitude Equipment
              </span>
              <h1 className="font-sans-alpine text-4xl sm:text-6xl lg:text-8xl font-black uppercase tracking-tight text-white leading-none break-words">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-xs sm:text-base text-[#CBD5E1] leading-relaxed max-w-xl pt-1 sm:pt-2 font-light">
                Technical foul-weather outerwear, reinforced guide trousers, and convertible chest rigs.
                Hand-patterned and sewn by Chris on an industrial Juki lockstitch machine in Leadville, Colorado
                for backcountry anglers who bushwhack the bank on foot.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
              <a
                href="#system-matrix"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 bg-[#002FA7] hover:bg-[#0038CE] text-white font-mono-swiss font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-[#002FA7]/30"
              >
                Explore Gear Roster ({products.length})
              </a>
              <Link
                href="/about"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 border border-[#334155] hover:border-white bg-[#11141A] text-white font-mono-swiss text-xs uppercase tracking-wider transition-all duration-200"
              >
                System Dossier (/about)
              </Link>
            </div>

            {/* Strict Tabular Specifications */}
            <div className="pt-6 border-t border-[#20242C] grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-xs font-mono-swiss text-[#64748B]">
              <div className="border-b sm:border-b-0 border-[#20242C] pb-3 sm:pb-0">
                <span className="block text-white font-bold text-sm uppercase">20,000 MM</span>
                <span className="text-[11px]">Hydrostatic Head</span>
              </div>
              <div className="border-b sm:border-b-0 border-[#20242C] pb-3 sm:pb-0">
                <span className="block text-white font-bold text-sm uppercase">500D CORDURA</span>
                <span className="text-[11px]">Mil-Spec Scuff</span>
              </div>
              <div>
                <span className="block text-white font-bold text-sm uppercase">10,152 FT</span>
                <span className="text-[11px]">Datum Elevation</span>
              </div>
            </div>
          </div>

          {/* Right Modular Ratio Block: Authentic Cloudflare R2 Hero Photo with Technical Typography */}
          <div className="lg:col-span-5">
            <div className="relative bg-[#11141A] border border-[#252B37] p-3 sm:p-4 shadow-2xl group">
              {/* Technical Ratio Header */}
              <div className="flex items-center justify-between text-[10px] font-mono-swiss text-[#64748B] border-b border-[#202632] pb-2 mb-3">
                <span className="text-[#38BDF8]">FIG 01.1 // HIGH ALPINE CANYON</span>
                <span>ASPECT 7:5</span>
              </div>

              <div className="aspect-[7/5] relative overflow-hidden bg-black border border-[#202632]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler in High Alpine Colorado River"
                  className="w-full h-full object-cover object-center filter contrast-110 brightness-90 group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              </div>

              {/* Functional Caption Ledger */}
              <div className="mt-3 p-3 bg-[#141820] border border-[#202632] grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-[11px] font-mono-swiss text-[#94A3B8]">
                <div>
                  <span className="text-[#64748B] block text-[10px]">SUBJECT:</span>
                  <span className="text-white">Bushwhack Anorak Specimen</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">COORDINATES:</span>
                  <span className="text-[#38BDF8]">39.2508° N, 106.2925° W</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three Functional System Principles */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 border-b border-[#20242C] bg-[#0C0E12]">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-xs uppercase tracking-[0.3em] font-mono-swiss text-[#38BDF8] font-bold">
              Functional Objectivity
            </span>
            <h2 className="font-sans-alpine text-2xl sm:text-5xl font-black uppercase tracking-tight text-white">
              SYSTEMATIC DESIGN PRINCIPLES
            </h2>
            <p className="text-xs sm:text-sm font-mono-swiss text-[#94A3B8] leading-relaxed">
              Every detail exists to solve an ergonomic or environmental problem in harsh mountain waterways.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-[#11141A] border border-[#202632] p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="text-xs font-mono-swiss text-[#38BDF8] block">
                01 // PURITY OF CONSTRUCTION
              </span>
              <h3 className="font-sans-alpine text-lg sm:text-xl font-bold uppercase text-white">
                Single-Needle Lockstitch
              </h3>
              <p className="text-xs font-mono-swiss text-[#94A3B8] leading-relaxed">
                Assembled on an industrial Juki machine using bonded synthetic filament thread.
                Felled lockstitching ensures sharp shale won&apos;t unravel your seam.
              </p>
            </div>

            <div className="bg-[#11141A] border border-[#202632] p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="text-xs font-mono-swiss text-[#38BDF8] block">
                02 // MATERIAL RESILIENCE
              </span>
              <h3 className="font-sans-alpine text-lg sm:text-xl font-bold uppercase text-white">
                Toray 3L &amp; Cordura
              </h3>
              <p className="text-xs font-mono-swiss text-[#94A3B8] leading-relaxed">
                Hydrophobic membrane provides 20,000mm waterproofing while maintaining vapor breathability
                under high aerobic exertion.
              </p>
            </div>

            <div className="bg-[#11141A] border border-[#202632] p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="text-xs font-mono-swiss text-[#38BDF8] block">
                03 // DIRECT STEWARDSHIP
              </span>
              <h3 className="font-sans-alpine text-lg sm:text-xl font-bold uppercase text-white">
                Lifetime Overhaul
              </h3>
              <p className="text-xs font-mono-swiss text-[#94A3B8] leading-relaxed">
                Zero third-party warranty middlemen. If mountain deadfall damages your gear,
                ship it directly to the Leadville workshop for free re-stitching.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Mathematical 3-Column Equipment Matrix */}
      <section id="system-matrix" className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#0A0B0E]">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 border-b border-[#20242C] pb-6 font-mono-swiss">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#38BDF8] block">
                Leadville Headwaters System
              </span>
              <h2 className="font-sans-alpine text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
                EQUIPMENT MATRIX
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs uppercase tracking-wider text-[#94A3B8] hover:text-white transition-colors"
            >
              [FULL CATALOG // {products.length} UNITS] →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((product, idx) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group block bg-[#0F1218] border border-[#202632] hover:border-[#002FA7] transition-all duration-300 p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between text-xs font-mono-swiss text-[#64748B] border-b border-[#1A202A] pb-2">
                    <span className="text-[#38BDF8]">SYSTEM-0{idx + 1}</span>
                    <span>{product.weight || '380G'}</span>
                  </div>

                  <div className="aspect-[4/4] bg-black overflow-hidden relative border border-[#1A202A]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline font-mono-swiss">
                      <h4 className="font-sans-alpine text-base sm:text-lg font-bold uppercase text-white group-hover:text-[#38BDF8] transition-colors truncate">
                        {product.title}
                      </h4>
                      <span className="text-sm font-bold text-white">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs font-mono-swiss text-[#94A3B8] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[11px] font-mono-swiss uppercase tracking-wider text-[#64748B] group-hover:text-white flex items-center justify-between border-t border-[#1A202A]">
                      <span>INSPECT DATA</span>
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke Swiss International Footer */}
      <footer className="border-t border-[#20242C] py-10 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#08090C]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono-swiss text-[#64748B] text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
            <span className="font-bold text-white uppercase tracking-wider">
              BANKBEATERS SYSTEMATIC SPEC
            </span>
            <span>·</span>
            <span>LEADVILLE, CO (10,152 FT)</span>
            <span>·</span>
            <span>CURIOSITY &gt; FEAR</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters Adventure Gear. Rational Construction. Lifetime Repair.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
