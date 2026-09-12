'use client';

import React, { useState } from 'react';
import { ArtworkMedia, ARTWORK_MEDIA_SIZES } from './ArtworkMedia';

export interface GalleryMediaItem {
  id: string;
  url: string;
  label: string;
}

export interface ProductGalleryProps {
  items: GalleryMediaItem[];
  title: string;
  badge?: React.ReactNode;
  fallbackIcon?: React.ReactNode;
  className?: string;
  asImage?: React.ElementType;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  items,
  title,
  badge,
  fallbackIcon,
  className = '',
  asImage,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeMedia = items[selectedIndex] || items[0];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Image Showcase Container */}
      <div className="relative aspect-square w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center shadow-2xl">
        {activeMedia ? (
          <ArtworkMedia
            src={activeMedia.url}
            alt={title}
            sizes={ARTWORK_MEDIA_SIZES.PRODUCT_DETAIL}
            aspectRatio="square"
            priority={true}
            asImage={asImage}
          />
        ) : (
          <div className="text-center p-8 space-y-4">
            {fallbackIcon || (
              <span className="text-8xl select-none inline-block filter drop-shadow-lg">✨</span>
            )}
            <div className="space-y-1">
              <p className="text-sm font-mono text-amber-400">Studio Edition Preview</p>
              <p className="text-xs text-slate-500">Photography coming soon</p>
            </div>
          </div>
        )}

        {/* Top Badges Overlay */}
        {badge && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
            {badge}
          </div>
        )}
      </div>

      {/* Gallery Thumbnails Strip */}
      {items.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2" role="tablist" aria-label="Product image thumbnails">
          {items.map((media, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={media.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`View ${media.label}`}
                onClick={() => setSelectedIndex(idx)}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                  isSelected
                    ? 'border-amber-400 shadow-md shadow-amber-400/20 opacity-100 scale-100'
                    : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600 scale-95'
                }`}
              >
                <ArtworkMedia
                  src={media.url}
                  alt={media.label}
                  sizes={ARTWORK_MEDIA_SIZES.THUMBNAIL}
                  aspectRatio="square"
                  asImage={asImage}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
