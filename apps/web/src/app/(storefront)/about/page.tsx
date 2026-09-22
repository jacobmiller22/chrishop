import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, Badge } from '@chrishop/ui';

export const metadata: Metadata = {
  title: "The Maker's Story & Workshop Origin | BankBeaters Adventure Gear",
  description:
    'The story of BankBeaters Adventure Gear: hand-sewn technical outdoor and adventure fishing apparel built by Chris in Leadville, Colorado. Built for the miles off-trail.',
};

export default function AboutPage() {
  return (
    <div className="space-y-16 max-w-5xl mx-auto py-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-mono text-stone-400 uppercase tracking-wider">
        <Link href="/" className="hover:text-[#E55B24] transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-stone-200 font-bold">The Maker&apos;s Story</span>
      </nav>

      {/* Cinematic Hero Header with Authentic R2 / Colorado Photography */}
      <section className="relative rounded-3xl overflow-hidden border border-stone-800/80 bg-[#101317] shadow-2xl">
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1215] via-[#0F1215]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1215]/90 via-[#0F1215]/40 to-transparent" />

          {/* Hero Typography Overlay */}
          <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning" className="uppercase tracking-wider font-mono text-[11px] font-bold">
                Leadville, CO · Elev. 10,152 FT
              </Badge>
              <Badge variant="olive" className="uppercase tracking-wider font-mono text-[11px]">
                Hand-Sewn Workshop Origin
              </Badge>
              <Badge variant="neutral" className="uppercase tracking-wider font-mono text-[11px]">
                Curiosity &gt; Fear
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase font-mono tracking-tight text-stone-100 drop-shadow-md">
              Built for the Miles Off-Trail.
            </h1>
            <p className="text-stone-300 text-sm sm:text-base max-w-2xl font-sans leading-relaxed drop-shadow">
              Hand-cut, patterned, and single-needle lockstitched in high-elevation Colorado. Built for
              anglers and explorers who push through dense scrub to reach untouched water.
            </p>
          </div>
        </div>
      </section>

      {/* The Origin Narrative */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-5 space-y-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
            01 // The Origin
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase font-mono tracking-tight text-stone-100">
            Why We Walk The Bank
          </h2>
          <div className="p-4 rounded-xl bg-[#15191E] border border-stone-800/80 space-y-2 text-xs font-mono text-stone-400">
            <div className="flex items-center justify-between text-stone-300 font-bold">
              <span>WORKBENCH REGISTRY</span>
              <span className="text-[#E55B24]">EST. 2024</span>
            </div>
            <div>BUILDER: Chris (Founder &amp; Patternmaker)</div>
            <div>LOCATION: Leadville, Colorado</div>
            <div>PRIMARY SEWING RIG: Juki Industrial Lockstitch</div>
            <div>SPECIALTY: Small-batch technical carry &amp; outerwear</div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-5 text-stone-300 text-base leading-relaxed">
          <p>
            In angling and bushwhacking culture, a <strong className="text-stone-100 font-semibold">Bank Beater</strong> is
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
            <span className="text-stone-100 font-bold italic"> &ldquo;Build gear as tough as the brush you have to crawl through.&rdquo;</span>
          </p>
        </div>
      </section>

      {/* Materials & Textile Philosophy */}
      <section className="space-y-6">
        <div className="border-b border-stone-800/80 pb-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
            02 // Provenance &amp; Armor
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase font-mono tracking-tight text-stone-100 mt-1">
            The Textile Standard
          </h2>
          <p className="text-stone-400 text-sm mt-1">
            Every fabric is hand-selected for tear resistance, hydrostatic head, and durability under friction.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="space-y-3 bg-[#15191E] border-stone-800/80">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🌧️</span>
              <span className="text-xs font-mono text-[#E55B24] font-bold">20,000mm / 20k</span>
            </div>
            <h3 className="font-bold font-mono text-base text-stone-100 uppercase">
              Toray 3-Layer Membrane
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Japan-milled waterproof-breathable hard shell. Repels torrential alpine downpours while venting
              heat during heavy bushwhacking climbs.
            </p>
          </Card>

          <Card className="space-y-3 bg-[#15191E] border-stone-800/80">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🛡️</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">500D / 1000D</span>
            </div>
            <h3 className="font-bold font-mono text-base text-stone-100 uppercase">
              Mil-Spec Cordura® Nylon
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              High-tenacity nylon woven for maximum abrasion and puncture resistance. Used in cut-bank knees,
              pocket faces, and sling pack shells.
            </p>
          </Card>

          <Card className="space-y-3 bg-[#15191E] border-stone-800/80">
            <div className="flex items-center justify-between">
              <span className="text-2xl">⛵</span>
              <span className="text-xs font-mono text-sky-400 font-bold">VX21 Laminate</span>
            </div>
            <h3 className="font-bold font-mono text-base text-stone-100 uppercase">
              X-Pac® Sailcloth
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Dimension-Polyant composite sailcloth featuring a waterproof polyester film and X-PLY reinforcement
              for lightweight, zero-sag carry gear.
            </p>
          </Card>

          <Card className="space-y-3 bg-[#15191E] border-stone-800/80">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🧵</span>
              <span className="text-xs font-mono text-[#E55B24] font-bold">Martexin 10oz</span>
            </div>
            <h3 className="font-bold font-mono text-base text-stone-100 uppercase">
              Waxed Army Duck Canvas
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Finished with non-hazardous food-grade wax that develops a rich, personal patina with every
              brier scrape and canyon descent.
            </p>
          </Card>

          <Card className="space-y-3 bg-[#15191E] border-stone-800/80">
            <div className="flex items-center justify-between">
              <span className="text-2xl">⚡</span>
              <span className="text-xs font-mono text-stone-300 font-bold">YKK AquaGuard®</span>
            </div>
            <h3 className="font-bold font-mono text-base text-stone-100 uppercase">
              Weatherproof Hardware
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Polyurethane-laminated reverse zippers keep gear dry in driving rain, paired with military-grade
              Duraflex nylon acetal buckles.
            </p>
          </Card>

          <Card className="space-y-3 bg-[#15191E] border-stone-800/80">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🪡</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">Single-Needle</span>
            </div>
            <h3 className="font-bold font-mono text-base text-stone-100 uppercase">
              Bonded Lockstitching
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Heavy-gauge bonded nylon thread sewn with reinforced bar-tacks on all structural carry stress
              points. Zero chain stitches that unravel under load.
            </p>
          </Card>
        </div>
      </section>

      {/* The Micro-Batch Philosophy & Lifetime Guarantee */}
      <section id="guarantee" className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-2xl bg-[#15191E] border border-stone-800/80 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <span className="text-xs font-mono uppercase tracking-wider text-[#E55B24] font-bold">
              Production Discipline
            </span>
          </div>
          <h3 className="text-2xl font-black font-mono uppercase tracking-tight text-stone-100">
            The Micro-Batch Promise
          </h3>
          <p className="text-stone-300 text-sm leading-relaxed">
            We do not manufacture overseas shipping containers of mass inventory. Each run is crafted in
            batches of 2–10 pieces.
          </p>
          <p className="text-stone-400 text-xs leading-relaxed">
            When deadstock fabrics, vintage camouflage bolts, or specialized prototype hardware arrive at
            the workshop, we cut 1-of-1 and 1-of-3 micro-batches. Once they sell out, they are archived forever.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-[#15191E] border border-[#3F4F3D] space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
              Field Commitment
            </span>
          </div>
          <h3 className="text-2xl font-black font-mono uppercase tracking-tight text-stone-100">
            The Lifetime Repair Guarantee
          </h3>
          <p className="text-stone-300 text-sm leading-relaxed">
            Gear is meant to be dragged through gravel and brambles. If you rip a pocket, blow a zipper, or
            puncture an elbow while working the water, do not toss it.
          </p>
          <p className="text-stone-400 text-xs leading-relaxed">
            Send it back to our Leadville workshop. We will patch it, bar-tack it, and mail it back to you
            ready for another decade of adventures.
          </p>
        </div>
      </section>

      {/* Action CTA Section */}
      <section className="rounded-3xl border border-stone-800/80 bg-gradient-to-br from-[#15191E] to-[#101317] p-8 sm:p-12 text-center space-y-6 shadow-2xl">
        <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
          Curiosity &gt; Fear
        </span>
        <h2 className="text-3xl sm:text-4xl font-black font-mono uppercase tracking-tight text-stone-100 max-w-2xl mx-auto">
          Ready to Step Off The Beaten Path?
        </h2>
        <p className="text-stone-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Inspect our active small-batch runs and limited edition workshop prototypes.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <Link href="/products">
            <Button
              variant="primary"
              size="lg"
              className="font-bold uppercase tracking-wider text-sm px-8 py-3.5"
            >
              Explore Equipment Catalog →
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="font-mono text-xs">
              View Active Drops
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
