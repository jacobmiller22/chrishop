import type { StorefrontProduct } from '@/lib/catalog';
import {
  HeroMinimalistOverlay,
  HeroFieldWorkshop,
  HeroCatalogDirect,
  type CTAButton,
} from './sections';

export type HeroPreset = 'minimalist_overlay' | 'field_workshop' | 'catalog_direct';

export interface HeroBannerProps {
  productsCount?: number;
  featuredProduct?: StorefrontProduct | null;
  preset?: HeroPreset;
  headline?: string;
  subheadline?: string;
  ethosStatement?: string;
  backdropImage?: string;
  badgeText?: string;
  provenanceCallout?: string;
  ctaButtons?: CTAButton[];
}

export function HeroBanner({
  productsCount = 0,
  featuredProduct,
  preset = 'minimalist_overlay',
  headline,
  subheadline,
  ethosStatement,
  backdropImage,
  badgeText,
  provenanceCallout,
  ctaButtons,
}: HeroBannerProps) {
  const commonProps = {
    productsCount,
    featuredProductSlug: featuredProduct?.slug,
    headline,
    subheadline,
    ethosStatement,
    backdropImage,
    badgeText,
    provenanceCallout,
    ctaButtons,
  };

  if (preset === 'field_workshop') {
    return <HeroFieldWorkshop {...commonProps} />;
  }

  if (preset === 'catalog_direct') {
    return <HeroCatalogDirect {...commonProps} />;
  }

  return <HeroMinimalistOverlay {...commonProps} />;
}
