'use client';

import React, { useState, useRef } from 'react';
import { buildCloudflareImageUrl, generateCloudflareImageSrcset } from '../../lib/r2-image';

export type MediaType = 'image' | 'video' | 'gif';

export interface RichMediaItem {
  url: string;
  mediaType?: MediaType;
  alt?: string;
  caption?: string;
  posterUrl?: string;
  loop?: boolean;
  autoPlay?: boolean;
}

export interface RichMediaViewerProps {
  media: RichMediaItem;
  aspectRatio?: 'square' | 'portrait' | 'video' | 'auto';
  className?: string;
  priority?: boolean;
}

/**
 * Helper to determine media type from URL extension or explicit property.
 */
export function resolveMediaType(item: RichMediaItem): MediaType {
  if (item.mediaType) return item.mediaType;

  const urlLower = item.url.toLowerCase().split('?')[0];
  if (urlLower.endsWith('.mp4') || urlLower.endsWith('.webm') || urlLower.endsWith('.mov')) {
    return 'video';
  }
  if (urlLower.endsWith('.gif')) {
    return 'gif';
  }
  return 'image';
}

export const RichMediaViewer: React.FC<RichMediaViewerProps> = ({
  media,
  aspectRatio = 'square',
  className = '',
  priority = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const type = resolveMediaType(media);
  const altText = media.alt || 'BankBeaters Field Gear';

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'portrait'
        ? 'aspect-[4/5]'
        : aspectRatio === 'video'
          ? 'aspect-video'
          : '';

  if (hasError) {
    return (
      <div
        data-testid="rich-media-fallback"
        className={`w-full h-full flex flex-col items-center justify-center bg-[#101317] border border-stone-800 rounded-xl p-6 text-center ${aspectClass} ${className}`}
      >
        <span className="text-3xl mb-2">🏔️</span>
        <span className="text-xs font-mono text-stone-400">Media Specimen Unavailable</span>
      </div>
    );
  }

  // 1. HTML5 Edge Video Rendering
  if (type === 'video') {
    return (
      <div
        data-testid="rich-media-video-container"
        className={`relative w-full h-full overflow-hidden bg-[#0a0d10] ${aspectClass} ${className}`}
      >
        <video
          ref={videoRef}
          src={media.url}
          poster={media.posterUrl}
          muted
          playsInline
          loop={media.loop !== false}
          autoPlay={media.autoPlay !== false}
          preload="metadata"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover object-center"
          aria-label={altText}
        >
          {media.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.posterUrl} alt={altText} className="w-full h-full object-cover" />
          )}
        </video>

        {/* Video Type Indicator Badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-stone-300 uppercase flex items-center gap-1 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E55B24] animate-pulse" />
          <span>Motion</span>
        </div>
      </div>
    );
  }

  // 2. Animated GIF Loop
  if (type === 'gif') {
    return (
      <div
        data-testid="rich-media-gif-container"
        className={`relative w-full h-full overflow-hidden bg-[#0a0d10] ${aspectClass} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={altText}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-stone-300 uppercase pointer-events-none">
          GIF Loop
        </div>
      </div>
    );
  }

  const [isLoaded, setIsLoaded] = useState(false);

  // 3. Still Photographic Image (with Progressive Blur-Up & Cloudflare Image Resizing srcset)
  const isInternalR2 =
    media.url.startsWith('/media/') ||
    media.url.startsWith('https://') ||
    media.url.startsWith('media/');

  const src = isInternalR2
    ? buildCloudflareImageUrl(media.url, {
        width: 1024,
        quality: 80,
        format: 'auto',
        onerror: 'redirect',
      })
    : media.url;

  const srcSet = isInternalR2
    ? generateCloudflareImageSrcset(media.url, [384, 640, 768, 1024, 1536])
    : undefined;

  const blurUrl = isInternalR2
    ? buildCloudflareImageUrl(media.url, {
        width: 32,
        quality: 30,
        blur: 50,
        format: 'auto',
        onerror: 'redirect',
      })
    : null;

  return (
    <div
      data-testid="rich-media-image-container"
      className={`relative w-full h-full overflow-hidden bg-[#15191E] ${aspectClass} ${className}`}
    >
      {blurUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurUrl}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover filter blur-lg scale-105 transition-opacity duration-700 pointer-events-none z-0 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        sizes="(max-width: 768px) 100vw, 50vw"
        alt={altText}
        fetchPriority={priority ? 'high' : undefined}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setIsLoaded(true);
          setHasError(true);
        }}
        className={`relative z-10 w-full h-full object-cover transition-opacity duration-500 ease-out ${
          priority && !isLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
};
