import React from 'react';
import Link from 'next/link';
import { Button, Badge } from '@chrishop/ui';
import type { CTAButton } from './HeroMinimalistOverlay';

export interface HeroCatalogDirectProps {
  headline?: string;
  subheadline?: string;
  ethosStatement?: string;
  badgeText?: string;
  provenanceCallout?: string;
  ctaButtons?: CTAButton[];
  productsCount?: number;
}

export const HeroCatalogDirect: React.FC<HeroCatalogDirectProps> = ({
  headline = 'Field Equipment Roster.',
  subheadline = 'Direct Catalog & Drop Access',
  ethosStatement = 'All active technical outerwear, convertible carry rigs, and field accessories currently stocked or scheduled for production.',
  badgeText = '⚡ Live Roster Active',
  provenanceCallout = 'Micro-batch outdoor gear · Hand-sewn in Leadville, CO',
  ctaButtons,
  productsCount = 0,
}) => {
  const defaultCtas: CTAButton[] = [
    {
      label: `Inspect All Silhouettes (${productsCount}) →`,
      href: '/products',
      variant: 'primary',
    },
    {
      label: 'Scheduled Drops Schedule',
      href: '/drops',
      variant: 'outline',
    },
  ];

  const buttons = ctaButtons && ctaButtons.length > 0 ? ctaButtons : defaultCtas;

  return (
    <section
      data-testid="hero-catalog-direct"
      className="relative w-full rounded-3xl border border-stone-800/80 bg-[#0F1215] p-6 sm:p-10 -mt-6 sm:-mt-8 mb-16 shadow-2xl space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-800/80 pb-8">
        <div className="space-y-4 max-w-3xl">
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

          <div className="space-y-2">
            {subheadline && (
              <span className="text-xs sm:text-sm font-mono tracking-widest text-[#E55B24] uppercase font-bold block">
                {subheadline}
              </span>
            )}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-100 uppercase tracking-tight font-mono">
              {headline}
            </h1>
          </div>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            {ethosStatement}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {buttons.map((btn) => (
            <Link key={btn.label} href={btn.href}>
              <Button
                variant={btn.variant === 'primary' ? 'primary' : 'outline'}
                size="md"
                className={
                  btn.variant === 'primary'
                    ? 'font-bold uppercase tracking-wider text-xs px-6 py-3 bg-[#E55B24] hover:bg-orange-600'
                    : 'font-bold uppercase tracking-wider text-xs px-5 py-3 bg-stone-900 border-stone-700 text-stone-200'
                }
              >
                {btn.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Direct Category Quick Pathways */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
        <Link
          href="/products?category=outerwear"
          className="p-4 rounded-xl bg-[#15191E] border border-stone-800 hover:border-[#E55B24]/50 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#E55B24] font-bold text-xs">[ SPEC 01 ]</span>
            <div>
              <span className="text-stone-200 font-bold block group-hover:text-[#E55B24] transition-colors">
                Outerwear &amp; Shells
              </span>
              <span className="text-stone-500 text-[11px]">Toray 3-Layer Ripstop</span>
            </div>
          </div>
          <span className="text-stone-500 group-hover:text-[#E55B24] transition-colors">→</span>
        </Link>

        <Link
          href="/products?category=packs-carry"
          className="p-4 rounded-xl bg-[#15191E] border border-stone-800 hover:border-[#E55B24]/50 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#E55B24] font-bold text-xs">[ SPEC 02 ]</span>
            <div>
              <span className="text-stone-200 font-bold block group-hover:text-[#E55B24] transition-colors">
                Packs &amp; Carry Rigs
              </span>
              <span className="text-stone-500 text-[11px]">500D Cordura / X-Pac</span>
            </div>
          </div>
          <span className="text-stone-500 group-hover:text-[#E55B24] transition-colors">→</span>
        </Link>

        <Link
          href="/products?category=field-accessories"
          className="p-4 rounded-xl bg-[#15191E] border border-stone-800 hover:border-[#E55B24]/50 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#E55B24] font-bold text-xs">[ SPEC 03 ]</span>
            <div>
              <span className="text-stone-200 font-bold block group-hover:text-[#E55B24] transition-colors">
                Field Accessories
              </span>
              <span className="text-stone-500 text-[11px]">Martexin Waxed Canvas</span>
            </div>
          </div>
          <span className="text-stone-500 group-hover:text-[#E55B24] transition-colors">→</span>
        </Link>
      </div>
    </section>
  );
};
