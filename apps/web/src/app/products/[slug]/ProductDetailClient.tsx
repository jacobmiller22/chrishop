'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@chrishop/ui';
import type { StorefrontProduct, StorefrontVariation } from '@/lib/directus';
import { getAssetUrl } from '@/lib/directus';

interface ProductDetailClientProps {
  product: StorefrontProduct;
}

const CATEGORY_ICONS: Record<string, string> = {
  sculptures: '🗿',
  prints: '🖼️',
  wearables: '👕',
  'digital-editions': '💎',
};

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const variations: StorefrontVariation[] = product.variations || [];
  const [selectedVariationId, setSelectedVariationId] = useState<string>(
    variations[0]?.id || ''
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  const selectedVariation =
    variations.find((v) => v.id === selectedVariationId) || variations[0];

  // Collect all media assets (featured, hero, and gallery)
  const mediaList: Array<{ id: string; url: string; label: string }> = [];
  if (product.featured_image) {
    const url = getAssetUrl(product.featured_image);
    if (url) mediaList.push({ id: 'featured', url, label: 'Featured' });
  }
  if (product.hero_image) {
    const url = getAssetUrl(product.hero_image);
    if (url && !mediaList.some((m) => m.url === url)) {
      mediaList.push({ id: 'hero', url, label: 'Hero Banner' });
    }
  }

  const activeMedia = mediaList[selectedImageIndex] || mediaList[0];
  const categoryIcon = (product.category?.slug && CATEGORY_ICONS[product.category.slug]) || '✨';

  // Price resolution
  const currentPrice = selectedVariation
    ? selectedVariation.effective_price
    : product.base_price;
  const isOverride = selectedVariation?.price_override != null;

  // Stock status
  const isSoldOut =
    selectedVariation?.status === 'sold_out' ||
    (selectedVariation && selectedVariation.stock_quantity <= 0);
  const isComingSoon = selectedVariation?.status === 'coming_soon';
  const isAvailable = !isSoldOut && !isComingSoon;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/" className="hover:text-amber-400 transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-amber-400 transition-colors">
          Catalog
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-amber-400 transition-colors"
            >
              {product.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-200 font-medium truncate">{product.title}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Media & Gallery Section */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center shadow-2xl">
            {activeMedia ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeMedia.url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-8 space-y-4">
                <span className="text-8xl select-none inline-block filter drop-shadow-lg">
                  {categoryIcon}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-amber-400">Archival Edition Preview</p>
                  <p className="text-xs text-slate-500">Served via Directus CMS / MinIO S3</p>
                </div>
              </div>
            )}

            {/* Top Badges overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              {product.category && (
                <Badge variant="neutral" className="bg-slate-950/80 backdrop-blur-md">
                  {product.category.name}
                </Badge>
              )}
              {isSoldOut ? (
                <Badge variant="danger" className="bg-rose-950/80 backdrop-blur-md">
                  Sold Out
                </Badge>
              ) : isComingSoon ? (
                <Badge variant="info" className="bg-blue-950/80 backdrop-blur-md">
                  Coming Soon
                </Badge>
              ) : (
                <Badge variant="success" className="bg-emerald-950/80 backdrop-blur-md">
                  In Stock ({selectedVariation?.stock_quantity ?? 'Available'})
                </Badge>
              )}
            </div>
          </div>

          {/* Gallery Thumbnails */}
          {mediaList.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {mediaList.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedImageIndex === idx
                      ? 'border-amber-400 shadow-md shadow-amber-400/20'
                      : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Provenance & Crafting Note */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <span>🛡️</span>
              <span>Direct-from-Creator Guarantee</span>
            </div>
            <p>
              Each physical edition is handcrafted or inspected by Chris, accompanied by an archival
              certificate of authenticity and unique edition serialization.
            </p>
          </div>
        </div>

        {/* Right Column: Product Info, Variations & Actions */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="text-xs">
                Limited Edition Drop
              </Badge>
              <Badge variant="neutral" className="text-xs font-mono">
                Directus CMS
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
              {product.title}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {product.description ||
                'Exclusive limited release artifact cast and assembled with archival materials.'}
            </p>
          </div>

          {/* Dynamic Price Display */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono block">Effective Unit Price</span>
                <span className="text-4xl font-black text-amber-400">
                  ${Number(currentPrice).toFixed(2)}
                </span>
              </div>
              {selectedVariation?.sku && (
                <div className="text-right">
                  <span className="text-xs text-slate-500 font-mono block">SKU</span>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {selectedVariation.sku}
                  </span>
                </div>
              )}
            </div>

            {isOverride ? (
              <p className="text-xs text-amber-500/90 font-mono">
                ✦ Premium variation price override applied
              </p>
            ) : (
              <p className="text-xs text-slate-400 font-mono">
                ✦ Standard edition base price ($
                {Number(product.base_price).toFixed(2)})
              </p>
            )}
          </div>

          {/* Variations Selector */}
          {variations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-200">
                  Select Edition / Variation ({variations.length})
                </label>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedVariation?.is_limited_edition && selectedVariation.total_edition_count
                    ? `Edition of ${selectedVariation.total_edition_count}`
                    : 'Open Edition'}
                </span>
              </div>

              <div className="space-y-2">
                {variations.map((v) => {
                  const isSelected = v.id === selectedVariationId;
                  const variationSoldOut = v.status === 'sold_out' || v.stock_quantity <= 0;
                  const variationComingSoon = v.status === 'coming_soon';

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariationId(v.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/20 shadow-md shadow-amber-400/10'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-amber-400' : 'bg-slate-600'
                            }`}
                          />
                          <span className="text-sm font-semibold text-slate-100">
                            {v.variation_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pl-4">
                          <span>{v.sku}</span>
                          {v.is_limited_edition && v.total_edition_count && (
                            <>
                              <span>•</span>
                              <span>Run: {v.total_edition_count}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-base font-bold text-amber-400">
                          ${Number(v.effective_price).toFixed(2)}
                        </span>
                        {variationSoldOut ? (
                          <Badge variant="danger" className="text-[10px] py-0 px-1.5">
                            Sold Out
                          </Badge>
                        ) : variationComingSoon ? (
                          <Badge variant="info" className="text-[10px] py-0 px-1.5">
                            Soon
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            {v.stock_quantity} left
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Purchase Actions */}
          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-lg shadow-amber-500/20 py-3.5 text-base"
              disabled={!isAvailable}
            >
              {isSoldOut
                ? 'Edition Sold Out'
                : isComingSoon
                ? 'Releases Soon'
                : `Reserve Edition • $${Number(currentPrice).toFixed(2)}`}
            </Button>

            <Link href="/products" className="block">
              <Button variant="outline" size="md" className="w-full">
                ← Back to Catalog
              </Button>
            </Link>
          </div>

          {/* CMS Integration Technical Footnote */}
          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono space-y-1">
            <p>Directus Collection: products & product_variations</p>
            <p>Product ID: {product.id}</p>
            <p>Selected Variation ID: {selectedVariation?.id || 'none'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
