import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, Badge } from '@chrishop/ui';

export const metadata: Metadata = {
  title: "The Maker's Story | BankBeaters Adventure Gear",
  description:
    'Hand-sewn in Leadville, CO. The story of Chris, BankBeaters Adventure Gear, and our lifetime stitch guarantee.',
};

export default function AboutPage() {
  return (
    <div className="space-y-16 max-w-5xl mx-auto py-6">
      {/* Editorial Hero Banner featuring Authentic R2 Photography */}
      <section className="relative rounded-3xl overflow-hidden border border-stone-800/80 shadow-2xl bg-[#101317]">
        <div className="relative h-[360px] sm:h-[480px] lg:h-[540px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/bank-beaters-hero.jpg"
            alt="BankBeaters Angler in Colorado Canyon River"
            className="w-full h-full object-cover object-center filter brightness-90 contrast-105"
          />
          {/* Atmospheric Scrim Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1215] via-[#0F1215]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1215]/80 via-transparent to-transparent hidden sm:block" />

          {/* Hero Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="warning" className="uppercase tracking-wider font-mono text-[11px]">
                ⚡ Workshop Provenance
              </Badge>
              <Badge variant="olive" className="uppercase tracking-wider font-mono text-[11px]">
                Leadville, CO · Elevation 10,152 ft
              </Badge>
              <Badge variant="neutral" className="uppercase tracking-wider font-mono text-[11px]">
                R2 Authentic Visual Archive
              </Badge>
            </div>

            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
                The Maker&apos;s Manifesto
              </span>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-100 uppercase tracking-tight font-mono">
                Curiosity &gt; Fear.
              </h1>
              <p className="text-stone-300 text-sm sm:text-base lg:text-lg leading-relaxed">
                We don&apos;t build gear for manicured trails or drift boats. BankBeaters is crafted for
                the anglers and explorers who hike the canyon rim, push through the bramble, and work the bank on foot.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Origin Story Grid */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-4 space-y-4 sticky top-24">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
            01 / Workshop Roots
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight font-mono">
            Hand-Sewn in Leadville
          </h2>
          <p className="text-sm text-stone-400 leading-relaxed">
            Every pattern is drafted by hand. Every seam is locked with single-needle industrial stitching.
            No offshore factories. No quarterly investor quotas.
          </p>
          <div className="p-4 rounded-xl bg-[#101317] border border-stone-800/80 space-y-2">
            <span className="text-xs font-mono text-stone-400 block uppercase font-bold">
              Workshop Bench Specs:
            </span>
            <ul className="text-xs font-mono text-stone-300 space-y-1">
              <li>· Location: Leadville, Colorado</li>
              <li>· Machinery: Juki Industrial Lockstitch</li>
              <li>· Thread: Bonded Mil-Spec Nylon V-69</li>
              <li>· Batch Size: 1 to 6 Units Maximum</li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-8 space-y-6 text-stone-300 leading-relaxed text-base">
          <p>
            BankBeaters began out of frustration with commercial fly-fishing and outdoor apparel. Mass-market
            gear was either over-designed for casual city wear or so fragile that a single brush with wild rose or
            willow branches shredded the face fabric.
          </p>
          <p>
            Chris began altering surplus military fabrics and heavy Martexin waxed cotton on a bench vise in 2021.
            Anglers on the Arkansas River started noticing the burly storm anoraks and modular lumbar packs that
            refused to blow out seams when subjected to relentless bushwhacking.
          </p>
          <blockquote className="border-l-2 border-[#E55B24] pl-6 py-2 my-6 text-lg sm:text-xl italic text-stone-200 font-serif bg-[#101317]/60 rounded-r-xl">
            &ldquo;When you&apos;re two miles down in a steep canyon with river mist blowing sideways at dusk,
            your gear is your shelter. You shouldn&apos;t have to worry if your pocket zipper or seam tape is going to fail.&rdquo;
            <span className="block mt-2 text-xs font-mono uppercase tracking-widest text-[#E55B24] not-italic font-bold">
              — Chris, Founder &amp; Maker
            </span>
          </blockquote>
          <p>
            Today, every piece of BankBeaters Adventure Gear continues to be patterned, hand-cut, and sewn by Chris.
            When deadstock technical fabrics or rare vintage camo rolls surface, Chris creates spontaneous
            <strong className="text-stone-100"> micro-batches</strong> (often only 2 or 3 numbered editions) that are released directly to our community.
          </p>
        </div>
      </section>

      {/* Materials & Technical Philosophy */}
      <section className="space-y-8">
        <div className="border-b border-stone-800/80 pb-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold block">
            02 / Materials Philosophy
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight font-mono">
            Uncompromising Technical Utility
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="p-6 bg-[#101317] border-stone-800/80 space-y-3">
            <span className="text-2xl block">🌧️</span>
            <h3 className="text-lg font-bold text-stone-100 uppercase font-mono">Toray 3-Layer Membrane</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              20,000mm hydrostatic head waterproof rating with 20,000g/m² breathability. Lightweight yet impervious to alpine downpours.
            </p>
          </Card>

          <Card className="p-6 bg-[#101317] border-stone-800/80 space-y-3">
            <span className="text-2xl block">🛡️</span>
            <h3 className="text-lg font-bold text-stone-100 uppercase font-mono">500D Mil-Spec Cordura</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Air-textured high-tenacity nylon woven for maximum abrasion resistance against granite boulders and dense timber bramble.
            </p>
          </Card>

          <Card className="p-6 bg-[#101317] border-stone-800/80 space-y-3">
            <span className="text-2xl block">🧵</span>
            <h3 className="text-lg font-bold text-stone-100 uppercase font-mono">YKK AquaGuard &amp; Duraflex</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Polyurethane-laminated water-repellent zippers and military-grade acetal hardware that won&apos;t crack in sub-zero alpine frosts.
            </p>
          </Card>
        </div>
      </section>

      {/* Lifetime Repair Guarantee Callout */}
      <section className="p-8 sm:p-12 rounded-3xl bg-[#101317] border border-stone-800/80 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="olive" className="uppercase tracking-wider font-mono text-[11px]">
            Zero Landfill Policy
          </Badge>
          <span className="text-xs font-mono text-stone-400 uppercase tracking-widest font-semibold">
            BankBeaters Lifetime Stitch Guarantee
          </span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-stone-100 uppercase tracking-tight font-mono">
          If It Blows Out, We Re-Stitch It. Free.
        </h2>

        <p className="max-w-2xl text-sm sm:text-base text-stone-300 leading-relaxed">
          We don&apos;t ask for receipts. If you tear a knee on an alder snag or pop a strap hauling elk quarters across a river,
          mail it back to Chris in Leadville. We&apos;ll patch it with deadstock canvas, re-stitch the seam, and ship it back to you.
          Battle scars make the gear better.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-4">
          <Link href="/products">
            <Button
              variant="primary"
              size="lg"
              className="font-bold uppercase tracking-wider text-sm shadow-lg shadow-orange-950/40 px-8 py-3.5"
            >
              Explore Field Gear Roster
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="font-bold uppercase tracking-wider text-sm">
              View Active Drops
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
