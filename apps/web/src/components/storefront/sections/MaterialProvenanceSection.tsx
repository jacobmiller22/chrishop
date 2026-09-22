import React from 'react';
import { Badge } from '@chrishop/ui';

export interface MaterialSpec {
  name: string;
  spec: string;
  badge?: string;
  description: string;
}

export interface MaterialProvenanceSectionProps {
  eyebrow?: string;
  headline?: string;
  materials?: MaterialSpec[];
}

export const MaterialProvenanceSection: React.FC<MaterialProvenanceSectionProps> = ({
  eyebrow = 'Technical Textiles',
  headline = 'Armor & Hardware Matrix',
  materials = [
    {
      name: 'Toray 3-Layer Membrane',
      spec: '20,000mm / 20,000g Breathable DWR',
      badge: 'Outerwear Armor',
      description:
        'Japanese technical membrane providing complete waterproof storm protection under driving rains.',
    },
    {
      name: '500D / 1000D Mil-Spec Cordura®',
      spec: 'High-Tenacity Textured Nylon 6,6',
      badge: 'Abrasion Shield',
      description:
        'Rock-solid puncture and tear resistance for crawling over shale and through alder brush.',
    },
    {
      name: 'X-Pac® VX21 Sailcloth',
      spec: 'Multi-Ply Laminated Composite (210D Face)',
      badge: 'Waterproof Rig',
      description:
        'Ultra-rigid, zero-stretch composite fabric with integrated polyester X-PLY mesh for weatherproofing.',
    },
    {
      name: 'YKK® AquaGuard® Zippers',
      spec: 'Polyurethane Laminated Coil',
      badge: 'Storm Seal',
      description:
        'Water-repellent coil zippers engineered to keep internal tackle pouches bone-dry.',
    },
  ],
}) => {
  return (
    <section data-testid="section-material-provenance" className="space-y-6">
      <div className="border-b border-stone-800/80 pb-4">
        {eyebrow && (
          <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest font-bold block">
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight font-mono">
          {headline}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {materials.map((mat) => (
          <div
            key={mat.name}
            className="p-5 rounded-xl bg-[#15191E] border border-stone-800/80 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg">⚙️</span>
                {mat.badge && (
                  <Badge variant="olive" className="text-[10px] font-mono uppercase">
                    {mat.badge}
                  </Badge>
                )}
              </div>
              <h4 className="font-bold text-sm text-stone-100 font-mono">
                {mat.name}
              </h4>
              <p className="text-xs text-stone-400 leading-relaxed">
                {mat.description}
              </p>
            </div>
            <div className="pt-3 border-t border-stone-800/60 text-[11px] font-mono text-[#E55B24]">
              {mat.spec}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
