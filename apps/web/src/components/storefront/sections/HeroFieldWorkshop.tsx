import React from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@chrishop/ui';
import type { CTAButton } from './HeroMinimalistOverlay';

export interface HeroFieldWorkshopProps {
  headline?: string;
  subheadline?: string;
  ethosStatement?: string;
  backdropImage?: string;
  badgeText?: string;
  provenanceCallout?: string;
  ctaButtons?: CTAButton[];
  productsCount?: number;
  featuredProductSlug?: string;
}

export const HeroFieldWorkshop: React.FC<HeroFieldWorkshopProps> = ({
  headline = 'Hand-Sewn at 10,152 Feet.',
  subheadline = 'Leadville Workshop Field Rig',
  ethosStatement = 'No assembly line. No overseas containers. Every stitch, bar-tack, and zipper channel is individually guided through an industrial single-needle lockstitch machine in our Colorado mountain shop.',
  backdropImage = '/media/hero/bank-beaters-hero.jpg',
  badgeText = 'Workshop Bench Active',
  provenanceCallout = 'Leadville, CO · Elev. 10,152 ft · Juki Lockstitch',
  ctaButtons,
  productsCount = 0,
  featuredProductSlug,
}) => {
  const defaultCtas: CTAButton[] = [
    {
      label: `Inspect Field Gear ${productsCount > 0 ? `(${productsCount})` : '→'}`,
      href: '/products',
      variant: 'primary',
    },
    {
      label: 'The Workbench & Origin →',
      href: '/about',
      variant: 'outline',
    },
  ];

  if (featuredProductSlug) {
    defaultCtas.push({
      label: 'Inspect Flagship Anorak',
      href: `/products/${featuredProductSlug}`,
      variant: 'outline',
    });
  }

  const buttons = ctaButtons && ctaButtons.length > 0 ? ctaButtons : defaultCtas;

  return (
    <section
      data-testid="hero-field-workshop"
      className="relative w-full rounded-3xl border border-stone-800/80 bg-[#12161B] p-6 sm:p-10 lg:p-12 -mt-6 sm:-mt-8 mb-16 shadow-2xl overflow-hidden"
    >
      {/* Workshop Background Accent Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#E55B24_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Editorial Narrative */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2.5">
            {badgeText && (
              <Badge variant="warning" className="font-mono text-xs uppercase tracking-wider">
                {badgeText}
              </Badge>
            )}
            <Badge variant="olive" className="font-mono text-xs uppercase tracking-wider">
              {provenanceCallout}
            </Badge>
          </div>

          <div className="space-y-3">
            {subheadline && (
              <span className="text-xs sm:text-sm font-mono tracking-[0.2em] text-[#E55B24] uppercase font-bold block">
                {subheadline}
              </span>
            )}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-100 uppercase tracking-tight font-mono">
              {headline}
            </h1>
          </div>

          <p className="text-stone-300 leading-relaxed text-sm sm:text-base lg:text-lg max-w-2xl font-sans">
            {ethosStatement}
          </p>

          {/* Provenance Metadata Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#0B0E11] border border-stone-800/80 text-xs font-mono">
            <div>
              <span className="text-stone-500 block uppercase">Elevation</span>
              <span className="text-stone-200 font-bold">10,152 FT</span>
            </div>
            <div>
              <span className="text-stone-500 block uppercase">Rig Machine</span>
              <span className="text-stone-200 font-bold">Juki Single-Needle</span>
            </div>
            <div>
              <span className="text-stone-500 block uppercase">Thread Spec</span>
              <span className="text-stone-200 font-bold">Bonded Nylon V-69</span>
            </div>
            <div>
              <span className="text-stone-500 block uppercase">Batch Cadence</span>
              <span className="text-stone-200 font-bold">2–4 Serialized</span>
            </div>
            <div>
              <span className="text-stone-500 block uppercase">Warranty</span>
              <span className="text-[#E55B24] font-bold">Lifetime Repair</span>
            </div>
            <div>
              <span className="text-stone-500 block uppercase">Casting Clearance</span>
              <span className="text-stone-200 font-bold">High-Mobility</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-wrap items-center gap-4">
            {buttons.map((btn) => (
              <Link key={btn.label} href={btn.href}>
                <Button
                  variant={btn.variant === 'primary' ? 'primary' : 'outline'}
                  size="lg"
                  className={
                    btn.variant === 'primary'
                      ? 'font-bold uppercase tracking-wider text-sm shadow-xl shadow-orange-950/60 px-8 py-3.5 bg-[#E55B24] hover:bg-orange-600'
                      : 'font-bold uppercase tracking-wider text-sm px-6 py-3.5 bg-stone-900/80 hover:bg-stone-800 border-stone-700 text-stone-200'
                  }
                >
                  {btn.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Photographic Specimen */}
        <div className="lg:col-span-5">
          <Card className="p-0 overflow-hidden border-stone-800 bg-[#0B0E11] relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backdropImage}
              alt="Leadville Workshop Craftsmanship"
              className="w-full h-full object-cover object-center scale-100 hover:scale-105 transition-transform duration-700"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E11] via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-stone-300">
              <span className="bg-stone-900/90 px-2.5 py-1 rounded border border-stone-700">
                Bench Specimen 01
              </span>
              <span className="text-[#E55B24] font-bold">Curiosity &gt; Fear</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};
