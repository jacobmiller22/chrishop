'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface HardwareVaultLayoutProps {
  products: StorefrontProduct[];
}

export const HardwareVaultLayout: React.FC<HardwareVaultLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#08090B] text-[#E2E8F0] selection:bg-[#F59E0B] selection:text-black font-mono-vault">
      {/* 1. Bespoke Tactical Terminal Header */}
      <header className="sticky top-0 z-40 w-full bg-[#08090B]/95 backdrop-blur-md border-b border-[#1E232A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="group flex items-center gap-2.5 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#181B20] border border-[#F59E0B]/50 flex items-center justify-center text-[#F59E0B] font-bold text-xs shrink-0">
                &gt;_
              </div>
              <div className="flex flex-col">
                <span className="font-cypher-vault text-lg sm:text-xl uppercase font-bold tracking-wider text-white group-hover:text-[#F59E0B] transition-colors leading-none">
                  BANKBEATERS // VAULT
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-widest text-[#64748B] uppercase pt-1 truncate">
                  SYS_VER: 2.4.0 · D2C PROTOCOL
                </span>
              </div>
            </Link>
            <div className="hidden lg:flex items-center gap-3 text-[11px] text-[#64748B] border-l border-[#1E232A] pl-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-bold">STATUS: VAULT_ONLINE</span>
              <span>·</span>
              <span>NODE: LEADVILLE (10,152&apos;)</span>
            </div>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 lg:gap-8 text-[11px] sm:text-xs uppercase tracking-wider text-[#94A3B8]">
            <a href="#schematics" className="hover:text-[#F59E0B] transition-colors hidden xs:inline">
              [SCHEMATICS]
            </a>
            <Link href="/products?category=outerwear" className="hover:text-[#F59E0B] transition-colors hidden sm:inline">
              [OUTERWEAR]
            </Link>
            <Link href="/products?category=packs-carry" className="hover:text-[#F59E0B] transition-colors hidden md:inline">
              [CARRY_RIGS]
            </Link>
            <Link href="/about" className="hover:text-[#F59E0B] transition-colors hidden sm:inline">
              [RECON_DATA]
            </Link>
            <Link
              href="/cart"
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border border-[#F59E0B]/40 bg-[#12151A] hover:bg-[#F59E0B] text-[#F59E0B] hover:text-black font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0"
            >
              <span className="text-[10px] sm:text-[11px]">PAYLOAD</span>
              <span className="text-[9px] sm:text-[10px] bg-black/50 px-1.5 py-0.5 rounded text-white">0</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Top-Fold Telemetry Status Bar */}
      <section className="border-b border-[#1E232A] bg-[#0E1116] px-4 sm:px-6 lg:px-12 py-2 sm:py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 text-[10px] sm:text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[#94A3B8]">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[#F59E0B] font-bold">CYCLE:</span>
              <span className="text-white">BATCH 01/24</span>
            </div>
            <span className="text-[#334155] hidden sm:inline">|</span>
            <div>
              <span className="text-[#64748B]">CUT BENCH:</span>{' '}
              <span className="text-emerald-400">JUKI DDL RUN</span>
            </div>
            <span className="text-[#334155] hidden sm:inline">|</span>
            <div>
              <span className="text-[#64748B]">QUEUE:</span>{' '}
              <span className="text-[#F59E0B]">48H DIRECT</span>
            </div>
          </div>

          <div className="text-[10px] sm:text-xs text-[#64748B]">
            <span>LOC: 39.2508° N, 106.2925° W // ELEV 10,152 FT</span>
          </div>
        </div>
      </section>

      {/* 3. Tactical Reconnaissance Hero (HUD + Authentic R2 Image Recon) */}
      <section className="relative w-full border-b border-[#1E232A] bg-[#0A0D12] py-10 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left HUD Narrative */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[#131822] border border-[#1E283A] px-3 sm:px-3.5 py-1.5">
              <span className="text-[#06B6D4] font-bold text-[10px] sm:text-xs uppercase tracking-widest">
                OPTION C // HARDWARE VAULT &amp; DENSE BOM ARCHITECTURE
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#F59E0B] block font-bold">
                HIGH-DENSITY HARDWARE TELEMETRY
              </span>
              <h1 className="font-cypher-vault text-4xl sm:text-6xl lg:text-8xl font-bold uppercase tracking-tight text-white leading-none break-words">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-xs sm:text-base text-[#94A3B8] leading-relaxed max-w-xl pt-1 sm:pt-2 font-mono-vault">
                Direct-to-consumer prototype vault. Every unit is engineered with military abrasion specs,
                serialized on the cutting table, and backed by a lifetime repair guarantee.
                Crafted by Chris for backcountry bushwhacking where commercial gear fails.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
              <a
                href="#schematics"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 bg-[#F59E0B] hover:bg-[#D97706] text-black font-cypher-vault text-sm sm:text-base uppercase font-bold tracking-wider transition-all duration-200 shadow-lg shadow-[#F59E0B]/20"
              >
                Access Equipment Vault ({products.length})
              </a>
              <Link
                href="/about"
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 border border-[#334155] hover:border-[#F59E0B] bg-[#12151A] hover:bg-[#181B20] text-white font-cypher-vault text-sm sm:text-base uppercase font-bold tracking-wider transition-all duration-200"
              >
                Inspect Recon Dossier (/about)
              </Link>
            </div>

            {/* Tactical Live Specs */}
            <div className="pt-6 border-t border-[#1E232A] grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-xs text-[#64748B]">
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start border-b sm:border-b-0 border-[#1E232A] pb-2 sm:pb-0">
                <span className="block text-[#F59E0B] font-bold text-xs sm:text-sm uppercase">20K / 20K</span>
                <span className="text-[10px] sm:text-[11px]">Toray 3L Shield</span>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start border-b sm:border-b-0 border-[#1E232A] pb-2 sm:pb-0">
                <span className="block text-[#F59E0B] font-bold text-xs sm:text-sm uppercase">500D / 1000D</span>
                <span className="text-[10px] sm:text-[11px]">Mil-Spec Cordura</span>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                <span className="block text-[#F59E0B] font-bold text-xs sm:text-sm uppercase">SERIALIZED</span>
                <span className="text-[10px] sm:text-[11px]">2 to 6 Units Per Drop</span>
              </div>
            </div>
          </div>

          {/* Right Recon Telemetry Card: Authentic Cloudflare R2 Hero Photo */}
          <div className="lg:col-span-5">
            <div className="relative bg-[#0E1218] border border-[#263040] p-3 shadow-2xl group">
              {/* Header HUD */}
              <div className="flex items-center justify-between text-[10px] text-[#64748B] border-b border-[#1E283A] pb-2 mb-3">
                <span className="text-[#06B6D4] font-bold">FEED: SAT_RECON // 01</span>
                <span>39.2508° N, 106.2925° W</span>
              </div>

              <div className="aspect-[4/5] relative overflow-hidden bg-black border border-[#1E283A]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler High-Country Field Reconnaissance"
                  className="w-full h-full object-cover object-center filter contrast-125 brightness-90 group-hover:scale-105 transition-transform duration-700 ease-out"
                />

                {/* HUD Overlay Crosshairs */}
                <div className="absolute top-4 left-4 text-[10px] text-[#F59E0B] bg-black/80 px-2 py-0.5 border border-[#F59E0B]/40">
                  RECON_ELEV: 10,152&apos;
                </div>
                <div className="absolute bottom-4 right-4 text-[10px] text-emerald-400 bg-black/80 px-2 py-0.5 border border-emerald-500/40">
                  OPTICAL: LOCK_ACQUIRED
                </div>
              </div>

              {/* Footer HUD */}
              <div className="mt-3 p-3 bg-[#121620] border border-[#1E283A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs">
                <div>
                  <span className="text-[#F59E0B] font-bold block text-[11px]">SPECIMEN VERIFIED: BUSHWHACK UNIT</span>
                  <span className="text-[10px] text-[#64748B]">Leadville, CO Workshop Assembly</span>
                </div>
                <span className="text-[10px] text-white bg-[#1E283A] px-2 py-1 border border-[#334155]">
                  100% SEWN
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Three Hardware Engineering Standards */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 border-b border-[#1E232A] bg-[#0A0C10]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
          <div className="bg-[#0E1117] border border-[#1E232A] p-5 sm:p-6 space-y-3 sm:space-y-4">
            <span className="text-xs text-[#F59E0B] font-bold block uppercase">
              MODULE 01 // BALLISTIC RESILIENCE
            </span>
            <h3 className="font-cypher-vault text-lg sm:text-xl font-bold uppercase text-white">
              Abrasion Strike Zones
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Cordura 500D overlays on elbows, shoulders, seat, and cuff edges prevent blowouts
              when scrambling through dense willow thickets and granite scree.
            </p>
          </div>

          <div className="bg-[#0E1117] border border-[#1E232A] p-5 sm:p-6 space-y-3 sm:space-y-4">
            <span className="text-xs text-[#F59E0B] font-bold block uppercase">
              MODULE 02 // SEAM BONDING INTEGRITY
            </span>
            <h3 className="font-cypher-vault text-lg sm:text-xl font-bold uppercase text-white">
              Single-Needle Lockstitch
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Every seam is sewn on an industrial Juki machine using bonded synthetic thread.
              Felled lockstitching prevents unraveling even if an outer stitch is severed by barbed wire.
            </p>
          </div>

          <div className="bg-[#0E1117] border border-[#1E232A] p-5 sm:p-6 space-y-3 sm:space-y-4">
            <span className="text-xs text-[#F59E0B] font-bold block uppercase">
              MODULE 03 // LIFETIME DEPOT REPAIR
            </span>
            <h3 className="font-cypher-vault text-lg sm:text-xl font-bold uppercase text-white">
              Direct Maker Servicing
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              No warranty third-parties. Any damaged gear is returned directly to the Leadville
              depot for overhaul, patch reinforcement, or zip replacement free of charge.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Dense Blueprint Inventory Grid */}
      <section id="schematics" className="py-12 sm:py-24 px-4 sm:px-6 lg:px-12 bg-[#08090B]">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 sm:gap-4 border-b border-[#1E232A] pb-4 sm:pb-6">
            <div>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#F59E0B] font-bold block">
                BOM &amp; HARDWARE INVENTORY
              </span>
              <h2 className="font-cypher-vault text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-white">
                Equipment Schematics
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs uppercase tracking-wider text-[#F59E0B] hover:text-white transition-colors"
            >
              [VIEW COMPLETE CATALOG // {products.length} UNITS] →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((product, idx) => {
              const displayImage =
                product.featured_image || product.hero_image || '/media/hero/bank-beaters-hero.jpg';

              return (
                <div
                  key={product.id}
                  className="bg-[#0D1016] border border-[#1E232A] hover:border-[#F59E0B] transition-all duration-300 p-4 sm:p-5 space-y-4 sm:space-y-5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs border-b border-[#1E232A] pb-2 text-[#64748B]">
                    <span className="text-[#F59E0B] font-bold">SPEC-0{idx + 1}</span>
                    <span>EDITION: [01/24]</span>
                  </div>

                  <div className="aspect-[4/3] bg-[#08090B] overflow-hidden relative border border-[#1E232A]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/90 px-2 py-0.5 border border-[#1E232A] text-[10px] text-[#94A3B8]">
                      {product.weight || '380G'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-cypher-vault text-base sm:text-lg font-bold uppercase text-white truncate">
                        {product.title}
                      </h4>
                      <span className="text-xs text-[#64748B] truncate block">
                        {product.materials || 'TORAY 3-LAYER / CORDURA 500D'}
                      </span>
                    </div>

                    {/* Stock Allocation Bar */}
                    <div className="p-2.5 sm:p-3 bg-[#08090B] border border-[#1E232A] text-xs space-y-1.5">
                      <div className="flex justify-between text-[10px] sm:text-[11px]">
                        <span className="text-[#64748B]">BATCH ALLOCATION:</span>
                        <span className="text-emerald-400 font-bold">3 OF 5 CRAFTED</span>
                      </div>
                      <div className="w-full bg-[#181B20] h-1.5 overflow-hidden">
                        <div className="bg-[#F59E0B] h-full w-3/5" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm sm:text-base font-bold text-white font-cypher-vault">
                        ${product.base_price.toFixed(2)}
                      </span>
                      <Link
                        href={`/products/${product.slug}`}
                        className="px-3 sm:px-3.5 py-1.5 bg-[#181B20] hover:bg-[#F59E0B] text-[#94A3B8] hover:text-black text-xs font-bold transition-colors border border-[#334155]"
                      >
                        [INSPECT SPEC] →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Bespoke Terminal Footer */}
      <footer className="border-t border-[#1E232A] py-12 sm:py-16 px-4 sm:px-6 lg:px-12 bg-[#050608]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 text-xs text-[#64748B] text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
            <span className="text-[#F59E0B] font-bold uppercase">
              BANKBEATERS HARDWARE VAULT
            </span>
            <span className="hidden sm:inline">·</span>
            <span>LEADVILLE, CO // ELEV 10,152 FT</span>
            <span className="hidden sm:inline">·</span>
            <span>CURIOSITY &gt; FEAR</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters. Hardware Protocol v2.4. Free Repair Depot.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
