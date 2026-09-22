import React from 'react';

export interface GalleryImage {
  id: string;
  url: string;
  label: string;
  tag?: string;
}

export interface ImageGalleryProps {
  images: GalleryImage[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  fallbackIcon?: string;
  className?: string;
  topBadges?: React.ReactNode;
  renderHero?: (activeImage: GalleryImage) => React.ReactNode;
  renderThumbnail?: (image: GalleryImage, index: number, isSelected: boolean) => React.ReactNode;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  selectedIndex = 0,
  onSelectIndex,
  fallbackIcon = '🎒',
  className = '',
  topBadges,
  renderHero,
  renderThumbnail,
}) => {
  const activeImage = images[selectedIndex] || images[0];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Hero Viewer Container */}
      <div className="relative aspect-square w-full rounded-2xl bg-[#15191E] border border-stone-800 overflow-hidden flex items-center justify-center shadow-2xl">
        {activeImage ? (
          renderHero ? (
            renderHero(activeImage)
          ) : (
            <div className="relative w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={activeImage.url}
                src={activeImage.url}
                alt={activeImage.label}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            </div>
          )
        ) : (
          <div className="text-center p-8 space-y-4">
            <span className="text-8xl select-none inline-block filter drop-shadow-lg">
              {fallbackIcon}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-mono text-[#E55B24]">Workbench Silhouette Preview</p>
              <p className="text-xs text-stone-500">Field documentation in progress</p>
            </div>
          </div>
        )}

        {/* Top Badges Overlay Slot */}
        {topBadges && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            {topBadges}
          </div>
        )}

        {/* Bottom Tag Overlay */}
        {activeImage?.tag && (
          <div className="absolute bottom-4 left-4">
            <span className="bg-[#15191E]/90 text-stone-300 border border-stone-700/80 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md">
              {activeImage.tag}
            </span>
          </div>
        )}
      </div>

      {/* Gallery Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2" role="tablist" aria-label="Product image thumbnails">
          {images.map((img, idx) => {
            const isSelected = selectedIndex === idx;

            if (renderThumbnail) {
              return (
                <React.Fragment key={img.id || `${img.url}-${idx}`}>
                  {renderThumbnail(img, idx, isSelected)}
                </React.Fragment>
              );
            }

            return (
              <button
                key={img.id || `${img.url}-${idx}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={img.label}
                onClick={() => onSelectIndex?.(idx)}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 min-h-[44px] min-w-[44px] ${
                  isSelected
                    ? 'border-[#E55B24] shadow-md shadow-orange-500/20'
                    : 'border-stone-800 opacity-60 hover:opacity-100 hover:border-stone-600'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {img.tag && (
                  <span className="absolute bottom-0 inset-x-0 bg-stone-950/80 text-[9px] font-mono text-stone-300 truncate px-1 text-center">
                    {img.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
