'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface AlpineMinimalLayoutProps {
  products: StorefrontProduct[];
}

export const AlpineMinimalLayout: React.FC<AlpineMinimalLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#070A0E] text-[#F8FAFC] selection:bg-[#38BDF8] selection:text-black font-sans-alpine">
      {/* 1. Bespoke Alpine Minimal Header */}
      <header className="sticky top-0 z-40 w-full bg-[#070A0E]/90 backdrop-blur-md border-b border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="group flex items-center gap-2 sm:gap-2.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#38BDF8] rotate-45 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-sans-alpine text-lg sm:text-xl font-bold uppercase tracking-wider text-white group-hover:text-[#38BDF8] transition-colors">
                BANKBEATERS
              </span>
            </Link>
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono-alpine text-[#64748B] border-l border-[#1E293B] pl-6">
              <span className="text-[#38BDF8]">10,152&apos; ELV</span>
              <span>·</span>
              <span>39.2508° N, 106.2925° W</span>
              <span>·</span>
              <span>SAWATCH RANGE</span>
            </div>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-[11px] sm:text-xs font-mono-alpine uppercase tracking-wider text-[#94A3B8]">
            <a href="#spec-matrix" className="hover:text-white transition-colors hidden xs:inline">
              Spec Matrix
            </a>
            <Link href="/products?category=outerwear" className="hover:text-white transition-colors hidden sm:inline">
              Outerwear
            </Link>
            <Link href="/products?category=packs-carry" className="hover:text-white transition-colors hidden md:inline">
              Modular Carry
            </Link>
            <Link href="/about" className="hover:text-white transition-colors hidden sm:inline">
              Field Notes
            </Link>
            <Link
              href="/cart"
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border border-[#334155] hover:border-[#38BDF8] bg-[#0F172A]/80 text-[#F8FAFC] hover:text-[#38BDF8] transition-all flex items-center gap-1.5 sm:gap-2 rounded-xs shrink-0"
            >
              <span className="text-[10px] sm:text-[11px]">Roster</span>
              <span className="text-[9px] sm:text-[10px] bg-[#1E293B] px-1.5 py-0.5 rounded text-[#38BDF8]">0</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Panoramic Full-Bleed 85vh Alpine Hero */}
      <section className="relative w-full min-h-[560px] h-auto sm:h-[90vh] flex flex-col justify-between overflow-hidden bg-[#070A0E] border-b border-[#1E293B]">
        {/* Authentic Cloudflare R2 Hero Photograph with Glacier Grade */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/hero/bank-beaters-hero.jpg"
          alt="BankBeaters Angler in High Alpine River Canyon"
          className="absolute inset-0 w-full h-full object-cover object-center filter grayscale-[20%] contrast-[1.15] brightness-[0.75]"
        />

        {/* Glacier Atmospheric Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070A0E] via-[#070A0E]/40 to-[#070A0E]/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070A0E]/90 via-transparent to-transparent hidden md:block" />

        {/* Top Telemetry Monospace Marker */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 pt-6 sm:pt-12 flex justify-between items-center text-xs font-mono-alpine text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse shrink-0" />
            <span className="text-[#38BDF8] font-bold text-[10px] sm:text-xs">OPTION B // ALPINE MINIMAL</span>
          </div>
          <span className="hidden sm:inline-block tracking-wider text-xs">
            TORAY 3L 20K/20K · 500D CORDURA
          </span>
        </div>

        {/* Hero Narrative & Actions */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:pb-20 space-y-6 sm:space-y-8">
          <div className="space-y-3 sm:space-y-4 max-w-3xl">
            <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#38BDF8] font-mono-alpine block font-semibold">
              High-Altitude Technical Utility
            </span>
            <h1 className="font-sans-alpine text-4xl sm:text-6xl lg:text-8xl font-black uppercase tracking-tight text-white leading-none break-words">
              Curiosity &gt; Fear.
            </h1>
            <p className="text-sm sm:text-xl text-[#CBD5E1] font-light leading-relaxed max-w-2xl pt-1 sm:pt-2">
              Engineered for foul-weather alpine bushwhacking and rugged river banks.
              Toray 3-layer waterproof membranes and mil-spec abrasion guards crafted without retail fluff.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
            <a
              href="#spec-matrix"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-4 bg-[#38BDF8] text-[#070A0E] font-mono-alpine font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:bg-[#7DD3FC]"
            >
              Inspect Spec Matrix ({products.length} Units)
            </a>
            <Link
              href="/about"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-4 border border-[#334155] text-white font-mono-alpine font-medium text-xs uppercase tracking-wider transition-all duration-200 hover:border-[#38BDF8] hover:bg-[#0F172A]"
            >
              Alpine Field Notes
            </Link>
          </div>
        </div>

        {/* Bottom Elevation Bar */}
        <div className="relative z-10 w-full border-t border-[#1E293B]/60 bg-[#070A0E]/80 backdrop-blur-sm py-2.5 sm:py-3 px-4 sm:px-6 lg:px-12">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-[10px] sm:text-[11px] font-mono-alpine text-[#64748B]">
            <span>STATION: MT. ELBERT FOOTHILLS (10,152 FT)</span>
            <span className="hidden md:inline">TEST ENVIRONMENT: SUB-ZERO HIGH ANGLE PRECIP</span>
            <span>PRESSURE: 692 HPA</span>
          </div>
        </div>
      </section>

      {/* 3. Three Technical Standards */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 border-b border-[#1E293B] bg-[#0B0F17]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 p-5 sm:p-6 bg-[#0E1420] border border-[#1E293B]">
            <span className="text-xs font-mono-alpine text-[#38BDF8] block">
              01 // WEATHER RESISTANCE
            </span>
            <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">
              20K / 20K Hydrostatic
            </h3>
            <p className="text-xs font-mono-alpine text-[#94A3B8] leading-relaxed">
              Toray Entrant microporous membranes barrier torrential alpine squalls while maintaining
              optimal moisture vapor transmission during steep ascents.
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4 p-5 sm:p-6 bg-[#0E1420] border border-[#1E293B]">
            <span className="text-xs font-mono-alpine text-[#38BDF8] block">
              02 // STRUCTURAL INTEGRITY
            </span>
            <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">
              Mil-Spec Cordura Scuff
            </h3>
            <p className="text-xs font-mono-alpine text-[#94A3B8] leading-relaxed">
              High-friction zones (forearms, seat, knees, and bottom hems) are reinforced with 500D
              textured nylon to withstand granite scraping and alder snags.
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4 p-5 sm:p-6 bg-[#0E1420] border border-[#1E293B]">
            <span className="text-xs font-mono-alpine text-[#38BDF8] block">
              03 // PRECISION SERIALIZATION
            </span>
            <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">
              Leadville Micro-Batch
            </h3>
            <p className="text-xs font-mono-alpine text-[#94A3B8] leading-relaxed">
              Each unit is cut and assembled in restricted lots of 3 to 6 units. Individual serial
              tags record pattern generation and maker verification.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Rhythmic 3-Column Technical Specification Matrix */}
      <section id="spec-matrix" className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#070A0E]">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 sm:gap-4 border-b border-[#1E293B] pb-4 sm:pb-6">
            <div>
              <span className="text-[10px] sm:text-xs font-mono-alpine uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#38BDF8] block">
                Technical Equipment Roster
              </span>
              <h2 className="font-sans-alpine text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-white">
                Specification Matrix
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs font-mono-alpine uppercase tracking-wider text-[#94A3B8] hover:text-[#38BDF8] transition-colors"
            >
              Full Roster ({products.length}) →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((product) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group block bg-[#0B0F17] border border-[#1E293B] hover:border-[#38BDF8] transition-all duration-300 p-4 sm:p-5 space-y-4 sm:space-y-5"
                >
                  <div className="flex items-center justify-between text-xs font-mono-alpine text-[#64748B] border-b border-[#1E293B] pb-2">
                    <span className="text-[#38BDF8]">{product.category?.name || 'FIELD UTILITY'}</span>
                    <span>{product.weight || '380G'}</span>
                  </div>

                  <div className="aspect-[4/5] bg-[#070A0E] overflow-hidden relative border border-[#1E293B]/80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center filter contrast-105 group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2 sm:space-y-3 pt-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-sans-alpine text-base sm:text-lg font-bold uppercase tracking-wide text-white group-hover:text-[#38BDF8] transition-colors">
                        {product.title}
                      </h4>
                      <span className="text-sm font-mono-alpine text-[#38BDF8]">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs font-mono-alpine text-[#94A3B8] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between text-[10px] sm:text-[11px] font-mono-alpine text-[#64748B] group-hover:text-white transition-colors">
                      <span>SPEC INSPECT</span>
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke Alpine Minimal Footer */}
      <footer className="border-t border-[#1E293B] py-12 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#05070A]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 text-xs font-mono-alpine text-[#64748B] text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
            <span className="font-bold text-[#38BDF8] uppercase tracking-wider">
              BANKBEATERS ALPINE SPEC
            </span>
            <span className="hidden sm:inline">·</span>
            <span>10,152 FT</span>
            <span className="hidden sm:inline">·</span>
            <span>CURIOSITY &gt; FEAR</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters. High-Altitude Field Equipment.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
