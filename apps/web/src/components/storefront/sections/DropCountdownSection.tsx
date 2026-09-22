import React from 'react';
import Link from 'next/link';
import { Button, Card, Badge } from '@chrishop/ui';

export interface DropCountdownSectionProps {
  title?: string;
  subtitle?: string;
  targetDate?: string;
  ctaText?: string;
  ctaHref?: string;
  teaserNotes?: string;
}

export const DropCountdownSection: React.FC<DropCountdownSectionProps> = ({
  title = 'Next Micro-Batch Drop',
  subtitle = 'Leadville Workshop Batch Release',
  targetDate,
  ctaText = 'Get Field Dispatch Alert →',
  ctaHref = '/drops',
  teaserNotes = 'Small batch run of serialized Alpine Chest Rigs sewn from salvaged multicam sailcloth and Mil-Spec Cordura.',
}) => {
  return (
    <section data-testid="section-drop-countdown" className="space-y-6">
      <Card className="bg-[#12161B] border-stone-800 p-8 sm:p-10 rounded-2xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E55B24]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="font-mono text-xs uppercase">
                ⚡ Scheduled Release
              </Badge>
              {targetDate && (
                <span className="text-xs font-mono text-stone-400">
                  Target: {new Date(targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight font-mono">
              {title}
            </h3>

            <p className="text-xs font-mono text-[#E55B24] uppercase tracking-wider font-semibold">
              {subtitle}
            </p>

            {teaserNotes && (
              <p className="text-sm text-stone-300 leading-relaxed pt-1">
                {teaserNotes}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link href={ctaHref}>
              <Button
                variant="primary"
                size="md"
                className="w-full font-bold uppercase tracking-wider text-xs px-6 py-3.5 bg-[#E55B24] hover:bg-orange-600 shadow-lg shadow-orange-950/40"
              >
                {ctaText}
              </Button>
            </Link>
            <Link href="/drops">
              <Button
                variant="outline"
                size="md"
                className="w-full font-mono text-xs px-5 py-3 border-stone-700 text-stone-300 bg-stone-900/60"
              >
                View Full Release Calendar
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
};
