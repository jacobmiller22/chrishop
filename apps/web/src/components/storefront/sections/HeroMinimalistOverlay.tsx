import React from 'react';
import Link from 'next/link';
import { Button, Badge } from '@chrishop/ui';

export interface CTAButton {
  label: string;
  href: string;
  variant?: 'primary' | 'outline' | 'ghost';
}

export interface HeroMinimalistOverlayProps {
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

export const HeroMinimalistOverlay: React.FC<HeroMinimalistOverlayProps> = ({
  headline = 'Curiosity > Fear.',
  subheadline = 'Hand-Sewn Technical Outdoor Gear',
  ethosStatement = 'Patagonia-grade technical outerwear, convertible carry rigs, and field accessories crafted by Chris for anglers and bushwhackers who explore remote canyon banks on foot.',
  backdropImage = '/media/hero/bank-beaters-bg.jpg',
  badgeText = '⚡ Limited-Run Drop Live',
  provenanceCallout = 'Single-needle lockstitched in Leadville, CO (10,152 ft) · Micro-batches of 2–4 serialized pieces',
  ctaButtons,
  productsCount = 0,
  featuredProductSlug,
}) => {
  const defaultCtas: CTAButton[] = [
    {
      label: `Explore Gear Roster ${productsCount > 0 ? `(${productsCount})` : '→'}`,
      href: '/products',
      variant: 'primary',
    },
    {
      label: "The Maker's Story →",
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
      data-testid="hero-minimalist-overlay"
      className="relative w-full min-h-[85vh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden rounded-3xl border border-stone-800/80 shadow-2xl bg-[#0d1015] -mt-6 sm:-mt-8 mb-16"
    >
      {/* Background Image Container */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backdropImage}
          alt="BankBeaters Wilderness Background"
          className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000 ease-out"
          loading="eager"
          decoding="async"
        />

        {/* Multi-tier atmospheric gradient vignettes for WCAG 2.1 AA contrast (>= 4.5:1) */}
        <div className="absolute inset-0 bg-[#0d1015]/65 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(13,16,21,0.85)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1015]/90 via-transparent to-[#0d1015]" />
      </div>

      {/* Foreground Brand & Hero Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 py-20 text-center flex flex-col items-center space-y-8">
        {/* Chips / Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {badgeText && (
            <Badge
              variant="warning"
              className="uppercase tracking-wider font-mono text-[11px] bg-orange-950/80 border-orange-500/40 text-orange-200 backdrop-blur-md shadow-lg"
            >
              {badgeText}
            </Badge>
          )}
          <Badge
            variant="olive"
            className="uppercase tracking-wider font-mono text-[11px] bg-[#1e251d]/90 border-emerald-500/30 text-emerald-200 backdrop-blur-md"
          >
            Colorado Workshop Origin
          </Badge>
          <Badge
            variant="neutral"
            className="uppercase tracking-wider font-mono text-[11px] bg-stone-900/80 border-stone-700/60 text-stone-200 backdrop-blur-md"
          >
            Lifetime Stitch Guarantee
          </Badge>
        </div>

        {/* Authentic White Logo */}
        <div className="py-2 max-w-[280px] sm:max-w-[420px] md:max-w-[500px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/bank-beaters-logo-white.png"
            alt="BankBeaters Adventure Gear"
            className="w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] filter"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Ethos Statement & Core Headline */}
        <div className="space-y-4 max-w-3xl">
          {subheadline && (
            <span className="text-xs sm:text-sm font-mono tracking-[0.25em] text-[#E55B24] uppercase font-bold block drop-shadow-md">
              {subheadline}
            </span>
          )}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase font-mono drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
            {headline}
          </h1>
          {ethosStatement && (
            <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-stone-200 leading-relaxed drop-shadow-md font-sans font-medium">
              {ethosStatement}
            </p>
          )}
        </div>

        {/* Actionable CTAs */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {buttons.map((btn) => (
            <Link key={btn.label} href={btn.href}>
              <Button
                variant={btn.variant === 'primary' ? 'primary' : 'outline'}
                size="lg"
                className={
                  btn.variant === 'primary'
                    ? 'font-bold uppercase tracking-wider text-sm shadow-xl shadow-orange-950/60 px-8 py-4 bg-[#E55B24] hover:bg-orange-600 transition-all transform hover:-translate-y-0.5'
                    : 'font-bold uppercase tracking-wider text-sm px-8 py-4 bg-stone-900/60 hover:bg-stone-800/80 border-stone-600 text-stone-100 backdrop-blur-md transition-all transform hover:-translate-y-0.5'
                }
              >
                {btn.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Micro-Batch Craftsmanship Callout */}
        {provenanceCallout && (
          <div className="pt-6 border-t border-stone-800/60 flex items-center justify-center gap-3 text-xs font-mono text-stone-300 drop-shadow">
            <span className="w-2 h-2 rounded-full bg-[#E55B24] animate-pulse" />
            <span>{provenanceCallout}</span>
          </div>
        )}
      </div>
    </section>
  );
};
