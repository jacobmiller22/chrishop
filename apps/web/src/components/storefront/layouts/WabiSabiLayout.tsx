'use client';

import React from 'react';
import Link from 'next/link';
import type { StorefrontProduct } from '@/lib/catalog';

interface WabiSabiLayoutProps {
  products: StorefrontProduct[];
}

export const WabiSabiLayout: React.FC<WabiSabiLayoutProps> = ({ products }) => {
  return (
    <div className="w-full min-h-screen bg-[#09111C] text-[#EDE8E1] selection:bg-[#C95D3B] selection:text-white font-sans-noir">
      {/* 1. Bespoke Wabi-Sabi Indigo Header */}
      <header className="sticky top-0 z-40 w-full bg-[#09111C]/90 backdrop-blur-md border-b border-[#1C293A]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="group flex items-center gap-3">
              <span className="font-serif-wabisabi text-xl text-[#C95D3B] font-bold">
                山
              </span>
              <div className="flex flex-col">
                <span className="font-serif-wabisabi text-2xl uppercase tracking-[0.2em] text-white group-hover:text-[#C95D3B] transition-colors leading-none">
                  BANKBEATERS
                </span>
                <span className="text-[10px] tracking-[0.25em] text-[#8696A8] uppercase pt-1 font-light">
                  Adventure Gear · Leadville Mountain Sanctuary
                </span>
              </div>
            </Link>
            <span className="hidden xl:inline-block text-[10px] tracking-[0.3em] text-[#55697D] uppercase border-l border-[#1C293A] pl-6 font-light">
              ELEV 10,152 FT · SLOW HIGH-ALTITUDE CRAFT
            </span>
          </div>

          <nav className="flex items-center gap-8 text-xs uppercase tracking-[0.25em] text-[#A5B5C6] font-light">
            <a href="#equipment-archive" className="hover:text-white transition-colors">
              The Collection
            </a>
            <Link href="/products?category=outerwear" className="hover:text-white transition-colors hidden sm:inline">
              Outerwear
            </Link>
            <Link href="/products?category=packs-carry" className="hover:text-white transition-colors hidden md:inline">
              Vessels
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              Mountain Notes
            </Link>
            <Link
              href="/cart"
              className="px-3.5 py-1.5 border border-[#2B3B4E] hover:border-[#C95D3B] bg-[#111C2B] text-[#EDE8E1] hover:text-[#C95D3B] transition-all flex items-center gap-2 rounded-xs"
            >
              <span className="text-[11px] tracking-wider">Gear Roll</span>
              <span className="text-[10px] bg-[#1C2C3F] px-1.5 py-0.5 rounded text-[#C95D3B]">0</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Contemplative Mountain Sanctuary Hero */}
      <section className="relative w-full border-b border-[#1C293A] bg-[#0D1623] py-20 lg:py-28 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Contemplative Narrative */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-3 bg-[#131F2E] border border-[#223347] px-3.5 py-1.5 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C95D3B]" />
              <span className="text-xs uppercase tracking-[0.25em] text-[#C95D3B] font-light">
                One-of-a-Kind Small Batch Output · Leadville, Colorado
              </span>
            </div>

            <div className="space-y-4">
              <span className="text-xs uppercase tracking-[0.3em] text-[#8696A8] block font-light">
                Option G · Wabi-Sabi Mountain Sanctuary
              </span>
              <h1 className="font-serif-wabisabi text-5xl sm:text-7xl lg:text-8xl tracking-tight text-white leading-[1.05]">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-sm sm:text-base text-[#B3C3D4] leading-relaxed max-w-xl pt-2 font-light">
                Technical foul-weather outerwear, reinforced guide trousers, and convertible chest rigs.
                Hand-patterned and sewn by Chris on an industrial Juki lockstitch machine in Leadville, Colorado
                for backcountry anglers who bushwhack the bank on foot.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-5">
              <a
                href="#equipment-archive"
                className="px-9 py-4 bg-[#C95D3B] hover:bg-[#D96B48] text-white font-serif-wabisabi text-sm uppercase tracking-[0.2em] transition-all duration-300 rounded-sm shadow-lg shadow-[#C95D3B]/20"
              >
                Explore Gear Roster ({products.length})
              </a>
              <Link
                href="/about"
                className="px-9 py-4 border border-[#2B3B4E] hover:border-white bg-[#111C2B] text-white font-serif-wabisabi text-sm uppercase tracking-[0.2em] transition-all duration-300 rounded-sm"
              >
                The Maker&apos;s Story
              </Link>
            </div>

            {/* Poetic Craft Pillars */}
            <div className="pt-6 border-t border-[#1C293A] grid grid-cols-3 gap-6 text-xs text-[#8696A8] font-light">
              <div>
                <span className="block text-white font-medium text-sm font-serif-wabisabi">
                  10,152 FT
                </span>
                <span className="text-[11px] tracking-wider">Leadville Solitude</span>
              </div>
              <div>
                <span className="block text-white font-medium text-sm font-serif-wabisabi">
                  Toray 3L
                </span>
                <span className="text-[11px] tracking-wider">Japanese Membrane</span>
              </div>
              <div>
                <span className="block text-white font-medium text-sm font-serif-wabisabi">
                  Perpetual
                </span>
                <span className="text-[11px] tracking-wider">Sashiko Bench Mending</span>
              </div>
            </div>
          </div>

          {/* Right Serene Visual: Authentic Cloudflare R2 Hero Photo with Indigo Tone */}
          <div className="lg:col-span-5">
            <div className="relative bg-[#111C2B] border border-[#26374D] p-3 shadow-2xl rounded-sm group">
              <div className="aspect-[4/5] relative overflow-hidden bg-[#070D14]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/hero/bank-beaters-hero.jpg"
                  alt="BankBeaters Angler Moving Quietly in High Mountain River"
                  className="w-full h-full object-cover object-center filter contrast-105 brightness-95 group-hover:scale-105 transition-transform duration-1000 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09111C] via-transparent to-transparent opacity-50" />
              </div>

              {/* Minimalist Indigo Caption Bar */}
              <div className="mt-3 p-3 bg-[#0D1724] border border-[#1F2F43] flex items-center justify-between text-xs font-light">
                <span className="text-[#B3C3D4] tracking-widest text-[11px]">
                  ARCHIVAL SPECIMEN 01 · ARKANSAS RIVER
                </span>
                <span className="text-[10px] text-[#C95D3B] uppercase tracking-widest">
                  HAND-CRAFTED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Philosophy of Slow Craft (3 Pillars) */}
      <section className="py-24 px-6 lg:px-12 border-b border-[#1C293A] bg-[#0B1420]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase tracking-[0.35em] text-[#C95D3B] font-light">
              Craft &amp; Mountain Ethic
            </span>
            <h2 className="font-serif-wabisabi text-3xl sm:text-5xl tracking-tight text-white">
              The Reverence for Longevity
            </h2>
            <p className="text-xs sm:text-sm text-[#8696A8] leading-relaxed font-light">
              We reject mass manufacturing and disposable outdoor gear. We craft small serialized batches built to weather into an heirloom patina.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#111C2B] border border-[#1F2F43] p-8 space-y-4">
              <span className="text-xs font-light text-[#C95D3B] tracking-[0.25em] block uppercase">
                {'// 01. Meditative Lockstitch'}
              </span>
              <h3 className="font-serif-wabisabi text-2xl text-white">
                Single-Needle Craft
              </h3>
              <p className="text-xs text-[#8696A8] leading-relaxed font-light">
                Assembled on a vintage Juki DDL series lockstitch machine with bonded continuous filament nylon thread.
                Seams are felled to ensure river rocks won&apos;t tear your garment.
              </p>
            </div>

            <div className="bg-[#111C2B] border border-[#1F2F43] p-8 space-y-4">
              <span className="text-xs font-light text-[#C95D3B] tracking-[0.25em] block uppercase">
                {'// 02. Natural &amp; Technical Resilience'}
              </span>
              <h3 className="font-serif-wabisabi text-2xl text-white">
                Toray 3L &amp; Cordura
              </h3>
              <p className="text-xs text-[#8696A8] leading-relaxed font-light">
                Tested against torrential high-country squalls. We pair Japanese waterproof breathable membranes
                with 500D/1000D Cordura scuff guards on high-friction strike zones.
              </p>
            </div>

            <div className="bg-[#111C2B] border border-[#1F2F43] p-8 space-y-4">
              <span className="text-xs font-light text-[#C95D3B] tracking-[0.25em] block uppercase">
                {'// 03. Sashiko Repair Bench'}
              </span>
              <h3 className="font-serif-wabisabi text-2xl text-white">
                Lifetime Mending
              </h3>
              <p className="text-xs text-[#8696A8] leading-relaxed font-light">
                If a barbed wire fence or sharp river boulder tears your equipment, mail it back to Leadville.
                Chris re-stitches and mends every piece by hand on the original machine for life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Curated Serene Equipment Archive */}
      <section id="equipment-archive" className="py-24 px-6 lg:px-12 bg-[#09111C]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 border-b border-[#1C293A] pb-6">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-[#C95D3B] font-light block">
                Leadville Sanctuary
              </span>
              <h2 className="font-serif-wabisabi text-4xl sm:text-5xl tracking-tight text-white">
                The Equipment Collection
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs uppercase tracking-[0.2em] text-[#8696A8] hover:text-[#C95D3B] transition-colors flex items-center gap-2 font-light"
            >
              <span>Explore Entire Catalog ({products.length})</span>
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
                  className="group block bg-[#0F1A27] border border-[#1F2F43] hover:border-[#C95D3B] transition-all duration-300 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between text-xs font-light text-[#8696A8] border-b border-[#1A2838] pb-2">
                    <span className="text-[#C95D3B]">PIECE 0{idx + 1}</span>
                    <span className="tracking-widest uppercase">{product.category?.name || 'FIELD VESSEL'}</span>
                  </div>

                  <div className="aspect-[4/4] bg-[#070D14] overflow-hidden relative border border-[#1A2838]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-serif-wabisabi text-xl text-white group-hover:text-[#C95D3B] transition-colors">
                        {product.title}
                      </h4>
                      <span className="text-sm font-light text-[#C95D3B]">
                        ${product.base_price.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[#8696A8] line-clamp-2 leading-relaxed font-light">
                      {product.description}
                    </p>

                    <div className="pt-2 text-[11px] uppercase tracking-[0.2em] text-[#B3C3D4] group-hover:text-white flex items-center justify-between font-light border-t border-[#1A2838]">
                      <span>Examine Piece</span>
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Bespoke Wabi-Sabi Footer */}
      <footer className="border-t border-[#1C293A] py-16 px-6 lg:px-12 bg-[#060C14]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#8696A8] font-light">
          <div className="flex items-center gap-4">
            <span className="font-serif-wabisabi text-base text-[#C95D3B] tracking-wider">
              BANKBEATERS MOUNTAIN SANCTUARY
            </span>
            <span>·</span>
            <span>Leadville (10,152 FT)</span>
            <span>·</span>
            <span>Curiosity &gt; Fear</span>
          </div>

          <div>
            <p>© {new Date().getFullYear()} BankBeaters Adventure Gear. Hand-Sewn Single Needle. Lifetime Mending.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
