'use client';

import React, { useState } from 'react';

/**
 * Standard responsive sizes presets matching ChrisShop breakpoints and layouts.
 */
export const ARTWORK_MEDIA_SIZES = {
  /** Full-width hero banners and featured showcases */
  HERO: '100vw',
  /** Catalog grid (1 col mobile, 2 col tablet, 3 col desktop) */
  CATALOG_GRID: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  /** Flagship and product detail page showcase */
  PRODUCT_DETAIL: '(max-width: 768px) 100vw, 50vw',
  /** Thumbnail strip / admin list views */
  THUMBNAIL: '(max-width: 640px) 20vw, 80px',
} as const;

/**
 * Generates an ultra-compact SVG data URI shimmer/blur placeholder
 * suitable for Next.js blurDataURL or inline preview styling.
 */
export function generateTinyBlurSvg(fillColor: string = '#0f172a'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="8" height="8"><rect width="8" height="8" fill="${fillColor}"/><rect width="8" height="8" fill="#1e293b" opacity="0.4"/></svg>`;
  if (typeof btoa !== 'undefined') {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface ArtworkMediaProps {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'wide' | 'auto';
  className?: string;
  imgClassName?: string;
  blurDataURL?: string;
  placeholder?: 'blur' | 'empty';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  onLoad?: () => void;
  fallbackIcon?: React.ReactNode;
  /** Custom image component, e.g. Next.js `Image` */
  asImage?: React.ElementType;
}

const ASPECT_RATIO_CLASSES: Record<string, string> = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  wide: 'aspect-[21/9]',
  auto: '',
};

export const ArtworkMedia: React.FC<ArtworkMediaProps> = ({
  src,
  alt,
  sizes = ARTWORK_MEDIA_SIZES.CATALOG_GRID,
  priority = false,
  aspectRatio = 'square',
  className = '',
  imgClassName = '',
  blurDataURL,
  placeholder = 'blur',
  objectFit = 'cover',
  onLoad,
  fallbackIcon,
  asImage: ImageComponent,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const aspectClass = ASPECT_RATIO_CLASSES[aspectRatio] || '';
  const effectiveBlurData = blurDataURL || (placeholder === 'blur' ? generateTinyBlurSvg() : undefined);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const objectFitClass =
    objectFit === 'contain'
      ? 'object-contain'
      : objectFit === 'fill'
        ? 'object-fill'
        : objectFit === 'none'
          ? 'object-none'
          : 'object-cover';

  if (!src) {
    return (
      <div
        className={`relative w-full ${aspectClass} bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center border border-slate-800/80 ${className}`}
      >
        {fallbackIcon || <span className="text-5xl select-none">🎨</span>}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 ${aspectClass} ${className}`}
      data-placeholder-loaded={isLoaded}
    >
      {/* Blur-Up Low-Contrast Shimmer Backdrop */}
      <div
        aria-hidden="true"
        style={effectiveBlurData ? { backgroundImage: `url("${effectiveBlurData}")`, backgroundSize: 'cover' } : undefined}
        className={`absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 transition-opacity duration-700 ease-out pointer-events-none ${
          isLoaded ? 'opacity-0' : 'opacity-100 animate-pulse'
        }`}
      />

      {/* Render Image: Either custom Next.js Image or standard responsive img */}
      {ImageComponent ? (
        <ImageComponent
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={effectiveBlurData ? 'blur' : 'empty'}
          blurDataURL={effectiveBlurData}
          onLoad={handleLoad}
          className={`w-full h-full ${objectFitClass} transition-all duration-700 ease-out ${
            isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-60 blur-md scale-[1.03]'
          } ${imgClassName}`}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          className={`w-full h-full ${objectFitClass} transition-all duration-700 ease-out ${
            isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-60 blur-md scale-[1.03]'
          } ${imgClassName}`}
        />
      )}
    </div>
  );
};
