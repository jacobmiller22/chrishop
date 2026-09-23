import React from 'react';

export interface CraftPillar {
  icon?: string;
  title: string;
  description: string;
}

export interface CraftsmanshipStorySectionProps {
  eyebrow?: string;
  headline?: string;
  storyText?: string;
  pillars?: CraftPillar[];
}

export const CraftsmanshipStorySection: React.FC<CraftsmanshipStorySectionProps> = ({
  eyebrow = 'Craftsmanship & Provenance',
  headline = "The Maker's Bench",
  storyText = 'In angling and bushwhacking culture, a Bank Beater is someone who explores shorelines, cut-banks, tidal marshes, and remote canyon pools on foot. Chris sews gear by hand in Leadville, CO using bombproof Cordura, X-Pac sailcloth, and bonded nylon thread.',
  pillars = [
    {
      icon: '01 // ARMOR',
      title: 'Bombproof Construction',
      description:
        'Bar-tacked stress points, waterproof AquaGuard® zips, and reinforced high-wear zones engineered to outlast the harshest brambles.',
    },
    {
      icon: '02 // BATCH',
      title: 'Micro-Batch Agility',
      description:
        'Limited runs of 2–4 unique pieces using salvaged deadstock camouflage, custom pocketing, and hand-stamped serialized tags.',
    },
    {
      icon: '03 // REPAIR',
      title: 'Lifetime Repair Guarantee',
      description:
        'Gear is built to be used, not displayed. If you shred an elbow crawling through briars, send it back to the workshop for field repair.',
    },
  ],
}) => {
  return (
    <section
      id="makers-bench"
      data-testid="section-craftsmanship-story"
      className="rounded-2xl border border-stone-800/80 bg-[#101317] p-8 sm:p-12 space-y-8 shadow-2xl"
    >
      <div className="max-w-3xl space-y-4">
        {eyebrow && (
          <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest font-bold block">
            {eyebrow}
          </span>
        )}
        <h2 className="text-3xl sm:text-4xl font-black text-stone-100 uppercase tracking-tight font-mono">
          {headline}
        </h2>
        <p className="text-stone-300 leading-relaxed text-sm sm:text-base">
          {storyText}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-stone-800/80">
        {pillars.map((pillar) => (
          <div
            key={pillar.title}
            className="space-y-2 p-5 rounded-xl bg-[#15191E] border border-stone-800/60"
          >
            <span className="text-xs font-mono text-[#E55B24] font-bold block">[ {pillar.icon || 'SPEC'} ]</span>
            <h4 className="font-bold text-stone-200 text-sm font-mono uppercase">
              {pillar.title}
            </h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
