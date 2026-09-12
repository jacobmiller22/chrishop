import React from 'react';
import { ArtworkMedia, ARTWORK_MEDIA_SIZES } from './ArtworkMedia';

export interface HeroMediaProps {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'wide' | 'auto';
  className?: string;
  children?: React.ReactNode;
  asImage?: React.ElementType;
}

export const HeroMedia: React.FC<HeroMediaProps> = ({
  src,
  alt,
  sizes = ARTWORK_MEDIA_SIZES.HERO,
  priority = true,
  aspectRatio = 'wide',
  className = '',
  children,
  asImage,
}) => {
  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-slate-800/80 shadow-2xl ${className}`}>
      <ArtworkMedia
        src={src}
        alt={alt}
        sizes={sizes}
        priority={priority}
        aspectRatio={aspectRatio}
        asImage={asImage}
      />

      {/* Hero Ambient Gradient & Content Layer */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6 sm:p-10 z-10">
        {children}
      </div>
    </div>
  );
};
