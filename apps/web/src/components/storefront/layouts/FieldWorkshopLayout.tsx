import React from 'react';
import Link from 'next/link';
import { Button, Card, Badge } from '@chrishop/ui';
import type { StorefrontProduct } from '@/lib/catalog';

interface LayoutProps {
  products: StorefrontProduct[];
}

export const FieldWorkshopLayout: React.FC<LayoutProps> = ({ products }) => {
  const flagship = products.find((p) => p.slug === 'bushwhack-storm-anorak') || products[0];
  const otherProducts = products.filter((p) => p.id !== flagship?.id);

  return (
    <div className="space-y-24 py-4">
      {/* 1. Asymmetric Editorial Split Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-[#15191E] p-8 sm:p-12 rounded-3xl border border-stone-800/80 shadow-2xl">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="warning" className="uppercase tracking-wider font-mono text-[11px]">
              ⚡ Small-Batch Drop Live
            </Badge>
            <Badge variant="olive" className="uppercase tracking-wider font-mono text-[11px]">
              Leadville, CO · Elev 10,152 ft
            </Badge>
            <Badge variant="neutral" className="uppercase tracking-wider font-mono text-[11px]">
              Single-Needle Lockstitched
            </Badge>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
              Option A // Field Workshop &amp; Maker Archive
            </span>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-stone-100 uppercase font-mono leading-none">
              Curiosity &gt; Fear.
            </h1>
          </div>

          <p className="text-base sm:text-lg text-stone-300 leading-relaxed max-w-xl">
            Technical storm anoraks, convertible lumbar rigs, and field accessories hand-patterned and sewn by Chris
            for backcountry anglers who leave the boat ramp behind and work the bank on foot.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link href="/products">
              <Button
                variant="primary"
                size="lg"
                className="font-bold uppercase tracking-wider text-sm shadow-lg shadow-orange-950/40 px-8 py-3.5"
              >
                Explore Gear Roster ({products.length})
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" size="lg" className="font-bold uppercase tracking-wider text-sm">
                The Maker&apos;s Story (/about)
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: Framed Authentic R2 Hero Image with Archival Stamp */}
        <div className="lg:col-span-5">
          <div className="relative rounded-2xl overflow-hidden border border-stone-700/60 shadow-2xl bg-[#101317] group">
            <div className="aspect-[4/5] relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/hero/bank-beaters-hero.jpg"
                alt="BankBeaters Angler in Colorado High Alpine River"
                className="w-full h-full object-cover object-center filter contrast-105 group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101317] via-transparent to-transparent opacity-80" />
            </div>

            {/* Archival Workshop Tag Overlay */}
            <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0F1215]/90 backdrop-blur-md border border-stone-800/90 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#E55B24] uppercase tracking-widest block font-bold">
                  Field Provenance
                </span>
                <span className="text-xs font-mono text-stone-200 font-semibold block">
                  Leadville Workshop · Batch 01
                </span>
              </div>
              <span className="text-[11px] font-mono text-stone-400 bg-stone-900 px-2 py-1 rounded border border-stone-800">
                100% Hand-Sewn
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Asymmetrical Drop Roster (Large Flagship + Secondary Builds) */}
      <section className="space-y-8">
        <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest block font-bold">
              Active Small-Batch Runs
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight font-mono">
              Workshop Bench Builds
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm text-[#E55B24] hover:text-orange-400 transition-colors font-mono font-semibold"
          >
            All Silhouettes ({products.length}) →
          </Link>
        </div>

        {flagship && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#15191E] p-6 sm:p-10 rounded-2xl border border-stone-800/80 shadow-2xl">
            <div className="lg:col-span-6">
              <Card className="aspect-square flex items-center justify-center bg-[#101317] border-stone-800 overflow-hidden relative p-0 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flagship.featured_image || '/media/bushwhack-storm-anorak/hero.jpeg'}
                  alt={flagship.title}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute top-4 left-4">
                  <Badge variant="warning" className="text-xs font-mono uppercase font-bold">
                    Featured Silhouette
                  </Badge>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="olive">Batch 01/24 · Only 3 Crafted</Badge>
                <Badge variant="neutral">Lifetime Repair Guarantee</Badge>
              </div>

              <div className="space-y-2">
                <h3 className="text-3xl sm:text-4xl font-black text-stone-100 uppercase font-mono">
                  {flagship.title}
                </h3>
                <p className="text-stone-300 leading-relaxed text-sm sm:text-base">
                  {flagship.description}
                </p>
              </div>

              {flagship.materials && (
                <div className="p-4 rounded-xl bg-[#101317] border border-stone-800/80 space-y-1 font-mono text-xs">
                  <span className="text-[#E55B24] block uppercase font-bold">Technical Spec Overview:</span>
                  <p className="text-stone-300">· Fabric: {flagship.materials}</p>
                  {flagship.weight && <p className="text-stone-400">· Finished Weight: {flagship.weight}</p>}
                </div>
              )}

              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-black text-[#E55B24] font-mono">
                  ${Number(flagship.base_price).toFixed(2)}
                </span>
                <span className="text-xs text-stone-500 font-mono">Direct Workshop Pricing · Hand-Inspected</span>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href={`/products/${flagship.slug}`}>
                  <Button variant="primary" size="lg" className="font-bold uppercase tracking-wider text-sm px-8">
                    Inspect Silhouette &amp; Editions
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Secondary Builds Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {otherProducts.slice(0, 3).map((product) => (
            <Link key={product.id} href={`/products/${product.slug}`} className="group block">
              <Card className="bg-[#15191E] border-stone-800/80 hover:border-stone-700 transition-all p-4 space-y-4 rounded-2xl h-full flex flex-col justify-between">
                <div className="aspect-[4/5] rounded-xl overflow-hidden bg-[#101317] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.featured_image || '/media/the-cutbank-lumbar-sling-pack/hero.jpeg'}
                    alt={product.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge variant="olive" className="text-[10px] font-mono uppercase">
                      Micro-Batch
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-[#E55B24] uppercase font-bold block">
                    {product.origin || 'Leadville, CO'}
                  </span>
                  <h4 className="text-lg font-bold text-stone-100 uppercase font-mono group-hover:text-[#E55B24] transition-colors">
                    {product.title}
                  </h4>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-800/80">
                    <span className="text-lg font-black text-stone-200 font-mono">
                      ${Number(product.base_price).toFixed(2)}
                    </span>
                    <span className="text-xs font-mono text-[#E55B24]">Inspect →</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. The Maker's Bench Narrative Module */}
      <section className="p-8 sm:p-12 rounded-3xl bg-[#101317] border border-stone-800/80 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
            Craftsmanship Narrative
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-stone-100 uppercase tracking-tight font-mono">
            Single-Needle Lockstitching in Colorado
          </h2>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Every seam is sewn with heavy bonded nylon thread on a refurbished industrial machine.
            When you purchase BankBeaters, you buy directly from the person who cut the pattern.
            If you blow out a seam or tear a knee on willow branches, send it back and we will re-stitch it for free.
          </p>
        </div>
        <div className="lg:col-span-4 flex justify-start lg:justify-end">
          <Link href="/about">
            <Button variant="primary" size="lg" className="font-bold uppercase tracking-wider text-sm px-6">
              Read The Maker&apos;s Story
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
