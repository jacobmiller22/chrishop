import React from 'react';
import Link from 'next/link';
import { Button, Badge } from '@chrishop/ui';
import type { StorefrontProduct } from '@/lib/catalog';

interface LayoutProps {
  products: StorefrontProduct[];
}

export const HardwareVaultLayout: React.FC<LayoutProps> = ({ products }) => {
  return (
    <div className="space-y-16 py-2 font-mono">
      {/* 1. Live Telemetry & Drop Countdown Bar */}
      <section className="bg-[#101418] border border-stone-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold text-emerald-400">SYS: VAULT ONLINE</span>
          </div>
          <span className="text-stone-600 hidden sm:inline">|</span>
          <span className="text-stone-300">BATCH 01/24: 3 UNITS REMAINING</span>
          <span className="text-stone-600 hidden sm:inline">|</span>
          <span className="text-stone-400">LEADVILLE SEWING RUN: IN PROGRESS</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#E55B24] font-bold">NEXT CUT: 04d 11h 22m</span>
          <span className="text-stone-600">|</span>
          <span className="text-stone-400">DISPATCH: 48H GUARANTEED</span>
        </div>
      </section>

      {/* 2. Top Fold Vault Header (Option C Architecture) */}
      <section className="border-b border-stone-800 pb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-[#E55B24] uppercase tracking-widest block font-bold">
              OPTION C // HARDWARE VAULT
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-stone-100 uppercase tracking-tight">
              BANKBEATERS HARDWARE VAULT
            </h1>
          </div>
          <Badge variant="warning" className="text-xs uppercase font-bold px-3 py-1.5">
            ⚡ High-Density Catalog
          </Badge>
        </div>
        <p className="text-stone-400 text-xs sm:text-sm font-sans max-w-3xl">
          Direct-to-consumer prototype vault. Every unit is engineered with military abrasion specs, serialized,
          and tracked in real-time. (Note: In Option C, the large hero visual is intentionally hosted on the dedicated &apos;/about&apos; Maker Workshop page).
        </p>
      </section>

      {/* 3. Dense Blueprint Inventory Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product, idx) => (
          <div
            key={product.id}
            className="bg-[#121518] border border-stone-800 hover:border-[#E55B24] transition-all p-5 rounded-xl space-y-4 flex flex-col justify-between"
          >
            {/* Blueprint Header */}
            <div className="flex items-center justify-between text-xs border-b border-stone-800/80 pb-2">
              <span className="text-[#E55B24] font-bold">SPEC-0{idx + 1}</span>
              <span className="text-stone-400">EDITION: [01/24]</span>
            </div>

            {/* Product Image Viewport */}
            <div className="aspect-[4/3] bg-[#0A0D10] rounded-lg overflow-hidden relative border border-stone-800/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.featured_image || '/media/bushwhack-storm-anorak/hero.jpeg'}
                alt={product.title}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute bottom-2 left-2 bg-[#0F1215]/90 px-2 py-0.5 rounded text-[10px] text-stone-300 border border-stone-800">
                {product.weight || '380g'}
              </div>
            </div>

            {/* Spec Details & Stock Telemetry */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-stone-100 uppercase truncate">
                  {product.title}
                </h3>
                <span className="text-xs text-stone-400 truncate block">
                  {product.materials || 'TORAY 3-LAYER / CORDURA 500D'}
                </span>
              </div>

              {/* Live Batch Stock Indicator */}
              <div className="p-3 rounded bg-[#0A0D10] border border-stone-800/80 text-xs space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stone-400">BATCH ALLOCATION:</span>
                  <span className="text-emerald-400 font-bold">3 of 5 CRAFTED</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#E55B24] h-full w-3/5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-black text-stone-100">
                  ${Number(product.base_price).toFixed(2)}
                </span>
                <Link href={`/products/${product.slug}`}>
                  <Button variant="primary" size="sm" className="font-mono text-xs font-bold uppercase">
                    Inspect Spec →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 4. Dedicated Gateway to The Maker's Workshop & R2 Hero Visual */}
      <section className="p-8 rounded-2xl bg-[#101418] border border-stone-800 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[#E55B24]">📍</span>
          <span className="text-xs uppercase font-bold tracking-widest text-[#E55B24]">
            FIELD TEST ARCHIVE &amp; MAKER WORKSHOP
          </span>
        </div>

        <h2 className="text-xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight">
          How These Silhouettes Are Tested on Colorado River Banks
        </h2>

        <p className="text-xs sm:text-sm text-stone-300 font-sans max-w-2xl leading-relaxed">
          Because the Hardware Vault prioritizes inventory density, our full brand photography, river test archives,
          and Chris&apos;s Leadville workshop narrative are permanently housed in the Maker&apos;s Story vault.
        </p>

        <div className="pt-2">
          <Link href="/about">
            <Button variant="outline" size="lg" className="font-mono font-bold uppercase tracking-wider text-xs px-8">
              Open Field Archive &amp; View R2 Hero (/about) →
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
