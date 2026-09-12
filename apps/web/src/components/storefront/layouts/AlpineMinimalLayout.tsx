import React from 'react';
import Link from 'next/link';
import { Button } from '@chrishop/ui';
import type { StorefrontProduct } from '@/lib/catalog';

interface LayoutProps {
  products: StorefrontProduct[];
}

export const AlpineMinimalLayout: React.FC<LayoutProps> = ({ products }) => {
  return (
    <div className="space-y-20 py-2">
      {/* 1. Full-Bleed Panoramic R2 Hero Banner */}
      <section className="relative rounded-none sm:rounded-2xl overflow-hidden border border-stone-800 bg-[#0A0D10] shadow-2xl">
        <div className="relative h-[420px] sm:h-[540px] lg:h-[620px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/bank-beaters-hero.jpg"
            alt="BankBeaters Technical Outdoor Gear in Alpine River"
            className="w-full h-full object-cover object-center filter grayscale-[30%] contrast-110 brightness-95"
          />
          {/* Dark Scrim Gradients for Maximum Typographic Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1215] via-[#0F1215]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1215]/90 via-transparent to-transparent hidden sm:block" />

          {/* Top Telemetry Monospace Header */}
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between font-mono text-xs text-stone-400">
            <span className="bg-[#0F1215]/80 px-3 py-1 rounded border border-stone-800">
              OPTION B // ALPINE MINIMAL
            </span>
            <span className="hidden sm:inline-block bg-[#0F1215]/80 px-3 py-1 rounded border border-stone-800 text-[#E55B24]">
              TORAY 3L 20K/20K // MIL-SPEC CORDURA
            </span>
          </div>

          {/* Bottom Left Manifesto & Direct Action */}
          <div className="absolute bottom-0 left-0 p-6 sm:p-12 space-y-4 max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#E55B24] font-bold block">
              High-Alpine Technical Utility
            </span>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-stone-100 uppercase tracking-tighter font-mono leading-none">
              CURIOSITY &gt; FEAR
            </h1>
            <p className="text-stone-300 text-sm sm:text-base font-sans leading-relaxed">
              Engineered for foul-weather alpine bushwhacking. Pure technical performance without corporate retail excess.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link href="/products">
                <Button
                  variant="primary"
                  size="lg"
                  className="font-mono font-bold uppercase tracking-wider text-xs px-8 py-3.5 rounded-none shadow-lg shadow-orange-950/50"
                >
                  Inspect Roster ({products.length} Units)
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  variant="outline"
                  size="lg"
                  className="font-mono font-medium uppercase tracking-wider text-xs px-6 py-3.5 rounded-none border-stone-700 hover:border-stone-500"
                >
                  Alpine Field Notes (/about)
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Rhythmic 3-Column Technical Specification Grid */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between border-b border-stone-800 pb-4 gap-2 font-mono">
          <div>
            <span className="text-[11px] text-[#E55B24] uppercase tracking-widest block font-bold">
              SPECIFICATION MATRIX
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight">
              TECHNICAL EQUIPMENT ROSTER
            </h2>
          </div>
          <span className="text-xs text-stone-400">LEADVILLE, CO // 10,152 FT</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.slug}`} className="group block">
              <div className="bg-[#12161A] border border-stone-800 hover:border-stone-600 transition-all rounded-none p-5 space-y-4 h-full flex flex-col justify-between">
                {/* 4:5 Minimal Portrait Viewport */}
                <div className="aspect-[4/5] bg-[#0A0D10] border border-stone-800/80 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.featured_image || '/media/bushwhack-storm-anorak/hero.jpeg'}
                    alt={product.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-2 left-2 bg-[#0F1215]/90 px-2 py-0.5 border border-stone-800 text-[10px] font-mono text-[#E55B24]">
                    {product.category?.name || 'FIELD UTILITY'}
                  </div>
                </div>

                {/* Technical Spec Breakdown */}
                <div className="space-y-3 font-mono">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-bold text-stone-100 uppercase group-hover:text-[#E55B24] transition-colors truncate">
                      {product.title}
                    </h3>
                    <span className="text-sm font-black text-stone-200 ml-2">
                      ${Number(product.base_price).toFixed(2)}
                    </span>
                  </div>

                  {/* Dense Tabular Spec Matrix */}
                  <div className="p-3 bg-[#0A0D10] border border-stone-800/80 text-[11px] space-y-1 text-stone-400">
                    <div className="flex justify-between">
                      <span>TEXTILE:</span>
                      <span className="text-stone-200 truncate max-w-[160px]">
                        {product.materials || 'TORAY 3-PLY 20K'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>WEIGHT:</span>
                      <span className="text-stone-200">{product.weight || '462g (16.3oz)'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ORIGIN:</span>
                      <span className="text-stone-200">{product.origin || 'LEADVILLE, CO'}</span>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-[#E55B24] font-semibold pt-1">
                    INSPECT TECHNICAL SPEC →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
