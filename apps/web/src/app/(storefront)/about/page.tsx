import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Badge } from '@chrishop/ui';

import { aboutMetadata } from '@/lib/metadata';

export const metadata: Metadata = aboutMetadata;

export default function AboutPage() {
  return (
    <div className="space-y-16 max-w-5xl mx-auto py-4">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#685A4E] uppercase tracking-wider flex-wrap">
        <Link href="/" className="hover:text-[#A8472A] transition-colors py-2 inline-flex items-center">
          Home
        </Link>
        <span>/</span>
        <span className="text-[#2B2118] font-bold">The Maker&apos;s Story</span>
      </nav>

      {/* Cinematic Hero Header with Authentic R2 / Colorado Photography */}
      <section className="relative rounded-3xl overflow-hidden border border-[#DDD0BE] bg-[#1E1813] shadow-2xl">
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/bank-beaters-hero.jpg"
            alt="BankBeaters angler bushwhacking remote Colorado riverbank in custom gear"
            className="w-full h-full object-cover object-center filter brightness-90 contrast-105"
            loading="eager"
            fetchPriority="high"
          />
          {/* Atmospheric Vignette & Scrim Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#171310] via-[#171310]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#171310]/90 via-[#171310]/40 to-transparent" />

          {/* Hero Typography Overlay */}
          <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning" className="uppercase tracking-wider font-mono text-[11px] font-bold bg-[#A8472A] text-white border-none">
                Leadville, CO · Elev. 10,152 FT
              </Badge>
              <Badge variant="olive" className="uppercase tracking-wider font-mono text-[11px] bg-[#2A211A] text-[#EFE8DC] border-[#3A2E24]">
                Hand-Sewn Workshop Origin
              </Badge>
              <Badge variant="neutral" className="uppercase tracking-wider font-mono text-[11px] bg-[#1A1613] text-[#DDD0BE] border-[#3A2E24]">
                Curiosity &gt; Fear
              </Badge>
            </div>

            {/* Authentic Brand Wordmark in the original font */}
            <div className="py-1 max-w-[220px] sm:max-w-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/hero/bank-beaters-logo-white.png"
                alt="BankBeaters Adventure Gear"
                className="w-full h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] filter"
                loading="eager"
              />
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-journal-serif italic tracking-tight text-[#F8F5EE] drop-shadow-md">
              Built for the Miles Off-Trail.
            </h1>
            <p className="text-[#DDD0BE] text-sm sm:text-base max-w-2xl font-sans leading-relaxed drop-shadow">
              Hand-cut, patterned, and single-needle lockstitched in high-elevation Colorado. Built for
              anglers and explorers who push through dense scrub to reach untouched water.
            </p>
          </div>
        </div>
      </section>

      {/* The Origin Narrative */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-5 space-y-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#A8472A] font-bold block">
            01 // The Origin
          </span>
          <h2 className="text-2xl sm:text-3xl font-journal-serif italic tracking-tight text-[#2B2118]">
            Why We Walk The Bank
          </h2>
          <div className="p-4 rounded-xl bg-[#EFE8DC] border border-[#DDD0BE] space-y-2 text-xs font-mono text-[#685A4E]">
            <div className="flex items-center justify-between text-[#2B2118] font-bold">
              <span>WORKBENCH REGISTRY</span>
              <span className="text-[#A8472A]">EST. 2024</span>
            </div>
            <div>BUILDER: Chris (Founder &amp; Patternmaker)</div>
            <div>LOCATION: Leadville, Colorado</div>
            <div>PRIMARY SEWING RIG: Juki Industrial Lockstitch</div>
            <div>SPECIALTY: Small-batch technical carry &amp; outerwear</div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-5 text-[#2B2118] text-base leading-relaxed">
          <p>
            In angling and bushwhacking culture, a <strong className="text-[#2B2118] font-semibold">Bank Beater</strong> is
            someone who explores shorelines, cut-banks, tidal flats, and mountain torrents completely on
            foot. There is no trailerable boat, no fiberglass casting platform, and no luxury seat. You
            carry what you need through miles of wild willows, briars, shale scree, and sudden alpine squalls.
          </p>
          <p>
            For years, Chris watched commercial outdoor gear fail in the field. Delicate ultralight shell
            fabrics shredded on scrub oak branches. Boxy corporate jackets bagged at the hem and soaked
            through at zipper seams. Mass-produced fishing vests were crammed with useless plastic tabs and
            synthetic bling.
          </p>
          <p>
            BankBeaters began at a heavy hardwood cutting table in Leadville with a simple rule:
            <span className="text-[#2B2118] font-bold italic"> &ldquo;Build gear as tough as the brush you have to crawl through.&rdquo;</span>
          </p>
        </div>
      </section>

      {/* Materials & Textile Philosophy */}
      <section className="space-y-6">
        <div className="border-b border-[#DDD0BE] pb-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#A8472A] font-bold block">
            02 // Provenance &amp; Armor
          </span>
          <h2 className="text-2xl sm:text-3xl font-journal-serif italic tracking-tight text-[#2B2118] mt-1">
            The Textile Standard
          </h2>
          <p className="text-[#685A4E] text-sm mt-1">
            Every fabric is hand-selected for tear resistance, hydrostatic head, and durability under friction.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl space-y-3 bg-[#EFE8DC] border border-[#DDD0BE] shadow-xs hover:border-[#A8472A]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#A8472A]">// HYDRO</span>
              <span className="text-xs font-mono text-[#685A4E] font-bold">20,000mm / 20k</span>
            </div>
            <h3 className="font-bold font-mono text-base text-[#2B2118] uppercase">
              Toray 3-Layer Membrane
            </h3>
            <p className="text-xs text-[#685A4E] leading-relaxed">
              Japan-milled waterproof-breathable hard shell. Repels torrential alpine downpours while venting
              heat during heavy bushwhacking climbs.
            </p>
          </div>

          <div className="p-6 rounded-2xl space-y-3 bg-[#EFE8DC] border border-[#DDD0BE] shadow-xs hover:border-[#A8472A]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#A8472A]">// ARMOR</span>
              <span className="text-xs font-mono text-[#A8472A] font-bold">500D / 1000D</span>
            </div>
            <h3 className="font-bold font-mono text-base text-[#2B2118] uppercase">
              Mil-Spec Cordura® Nylon
            </h3>
            <p className="text-xs text-[#685A4E] leading-relaxed">
              High-tenacity nylon woven for maximum abrasion and puncture resistance. Used in cut-bank knees,
              pocket faces, and sling pack shells.
            </p>
          </div>

          <div className="p-6 rounded-2xl space-y-3 bg-[#EFE8DC] border border-[#DDD0BE] shadow-xs hover:border-[#A8472A]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#A8472A]">// COMPOSITE</span>
              <span className="text-xs font-mono text-[#685A4E] font-bold">VX21 Laminate</span>
            </div>
            <h3 className="font-bold font-mono text-base text-[#2B2118] uppercase">
              X-Pac® Sailcloth
            </h3>
            <p className="text-xs text-[#685A4E] leading-relaxed">
              Dimension-Polyant composite sailcloth featuring a waterproof polyester film and X-PLY reinforcement
              for lightweight, zero-sag carry gear.
            </p>
          </div>

          <div className="p-6 rounded-2xl space-y-3 bg-[#EFE8DC] border border-[#DDD0BE] shadow-xs hover:border-[#A8472A]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#A8472A]">// CANVAS</span>
              <span className="text-xs font-mono text-[#685A4E] font-bold">Martexin 10oz</span>
            </div>
            <h3 className="font-bold font-mono text-base text-[#2B2118] uppercase">
              Waxed Army Duck Canvas
            </h3>
            <p className="text-xs text-[#685A4E] leading-relaxed">
              Finished with non-hazardous food-grade wax that develops a rich, personal patina with every
              brier scrape and canyon descent.
            </p>
          </div>

          <div className="p-6 rounded-2xl space-y-3 bg-[#EFE8DC] border border-[#DDD0BE] shadow-xs hover:border-[#A8472A]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#A8472A]">// HARDWARE</span>
              <span className="text-xs font-mono text-[#685A4E] font-bold">YKK AquaGuard®</span>
            </div>
            <h3 className="font-bold font-mono text-base text-[#2B2118] uppercase">
              Weatherproof Hardware
            </h3>
            <p className="text-xs text-[#685A4E] leading-relaxed">
              Polyurethane-laminated reverse zippers keep gear dry in driving rain, paired with military-grade
              Duraflex nylon acetal buckles.
            </p>
          </div>

          <div className="p-6 rounded-2xl space-y-3 bg-[#EFE8DC] border border-[#DDD0BE] shadow-xs hover:border-[#A8472A]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#A8472A]">// STITCH</span>
              <span className="text-xs font-mono text-[#A8472A] font-bold">Single-Needle</span>
            </div>
            <h3 className="font-bold font-mono text-base text-[#2B2118] uppercase">
              Bonded Lockstitching
            </h3>
            <p className="text-xs text-[#685A4E] leading-relaxed">
              Heavy-gauge bonded nylon thread sewn with reinforced bar-tacks on all structural carry stress
              points. Zero chain stitches that unravel under load.
            </p>
          </div>
        </div>
      </section>

      {/* The Micro-Batch Philosophy & Lifetime Guarantee */}
      <section id="guarantee" className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-2xl bg-[#EFE8DC] border border-[#DDD0BE] space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#A8472A] font-bold text-xs">// DISCIPLINE</span>
            <span className="text-xs font-mono uppercase tracking-wider text-[#2B2118] font-bold">
              Production Discipline
            </span>
          </div>
          <h3 className="text-2xl font-journal-serif italic tracking-tight text-[#2B2118]">
            The Micro-Batch Promise
          </h3>
          <p className="text-[#2B2118] text-sm leading-relaxed">
            We do not manufacture overseas shipping containers of mass inventory. Each run is crafted in
            batches of 2–10 pieces.
          </p>
          <p className="text-[#685A4E] text-xs leading-relaxed">
            When deadstock fabrics, vintage camouflage bolts, or specialized prototype hardware arrive at
            the workshop, we cut 1-of-1 and 1-of-3 micro-batches. Once they sell out, they are archived forever.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-[#EFE8DC] border border-[#DDD0BE] space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#A8472A] font-bold text-xs">// GUARANTEE</span>
            <span className="text-xs font-mono uppercase tracking-wider text-[#A8472A] font-bold">
              Field Commitment
            </span>
          </div>
          <h3 className="text-2xl font-journal-serif italic tracking-tight text-[#2B2118]">
            The Lifetime Repair Guarantee
          </h3>
          <p className="text-[#2B2118] text-sm leading-relaxed">
            Gear is meant to be dragged through gravel and brambles. If you rip a pocket, blow a zipper, or
            puncture an elbow while working the water, do not toss it.
          </p>
          <p className="text-[#685A4E] text-xs leading-relaxed">
            Send it back to our Leadville workshop. We will patch it, bar-tack it, and mail it back to you
            ready for another decade of adventures.
          </p>
        </div>
      </section>

      {/* Action CTA Section */}
      <section className="rounded-3xl border border-[#3A2E24] bg-[#1E1813] p-8 sm:p-12 text-center space-y-6 shadow-xl">
        <span className="text-xs font-mono uppercase tracking-widest text-[#A8472A] font-bold block">
          Curiosity &gt; Fear
        </span>
        <h2 className="text-3xl sm:text-4xl font-journal-serif italic tracking-tight text-[#F8F5EE] max-w-2xl mx-auto">
          Ready to Step Off The Beaten Path?
        </h2>
        <p className="text-[#DDD0BE] text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Inspect our active small-batch runs and limited edition workshop prototypes.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <Link href="/products">
            <Button
              variant="primary"
              size="lg"
              className="font-bold uppercase tracking-wider text-sm px-8 py-3.5 !bg-[#A8472A] hover:!bg-[#8C371D] text-white border-none shadow-md shadow-black/20"
            >
              Explore Equipment Catalog →
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="font-mono text-xs border-[#3A2E24] text-[#EFE8DC] hover:bg-[#2A211A]">
              View Active Drops
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
