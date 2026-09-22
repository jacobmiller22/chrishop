import React from 'react';
import type { StorefrontProduct } from '../../../lib/catalog';
import { HeroMinimalistOverlay } from './HeroMinimalistOverlay';
import { HeroFieldWorkshop } from './HeroFieldWorkshop';
import { HeroCatalogDirect } from './HeroCatalogDirect';
import { DropCountdownSection } from './DropCountdownSection';
import { FeaturedCollectionSection } from './FeaturedCollectionSection';
import { CraftsmanshipStorySection } from './CraftsmanshipStorySection';
import { MaterialProvenanceSection } from './MaterialProvenanceSection';

export interface PageBlock {
  blockType: string;
  id?: string;
  [key: string]: any;
}

export interface SectionRendererProps {
  layout?: PageBlock[];
  products?: StorefrontProduct[];
  featuredProductSlug?: string;
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({
  layout = [],
  products = [],
  featuredProductSlug,
}) => {
  if (!layout || layout.length === 0) {
    return null;
  }

  return (
    <div className="space-y-20">
      {layout.map((block, idx) => {
        const key = block.id || `${block.blockType}-${idx}`;

        switch (block.blockType) {
          case 'hero': {
            const preset = block.layoutPreset || 'minimalist_overlay';
            const commonHeroProps = {
              headline: block.headline,
              subheadline: block.subheadline,
              ethosStatement: block.ethosStatement,
              backdropImage: block.backdropImage || (block.backdropMedia?.url ?? undefined),
              badgeText: block.badgeText,
              provenanceCallout: block.provenanceCallout,
              ctaButtons: block.ctaButtons,
              productsCount: products.length,
              featuredProductSlug,
            };

            if (preset === 'field_workshop') {
              return <HeroFieldWorkshop key={key} {...commonHeroProps} />;
            }
            if (preset === 'catalog_direct') {
              return <HeroCatalogDirect key={key} {...commonHeroProps} />;
            }
            return <HeroMinimalistOverlay key={key} {...commonHeroProps} />;
          }

          case 'dropCountdown':
            return (
              <DropCountdownSection
                key={key}
                title={block.title}
                subtitle={block.subtitle}
                targetDate={block.targetDate}
                ctaText={block.ctaText}
                ctaHref={block.ctaHref}
                teaserNotes={block.teaserNotes}
              />
            );

          case 'featuredCollection':
            return (
              <FeaturedCollectionSection
                key={key}
                title={block.title}
                subtitle={block.subtitle}
                categoryFilter={block.categoryFilter}
                limit={block.limit}
                showStartingPrice={block.showStartingPrice}
                products={products}
              />
            );

          case 'craftsmanshipStory':
            return (
              <CraftsmanshipStorySection
                key={key}
                eyebrow={block.eyebrow}
                headline={block.headline}
                storyText={block.storyText}
                pillars={block.pillars}
              />
            );

          case 'materialProvenance':
            return (
              <MaterialProvenanceSection
                key={key}
                eyebrow={block.eyebrow}
                headline={block.headline}
                materials={block.materials}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
};
