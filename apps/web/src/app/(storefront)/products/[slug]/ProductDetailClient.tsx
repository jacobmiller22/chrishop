'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@chrishop/ui';
import type { StorefrontProduct, StorefrontVariation } from '@/lib/catalog';
import { getAssetUrl } from '@/lib/assets';
import { shopify } from '@/lib/shopify';

interface ProductDetailClientProps {
  product: StorefrontProduct;
}

const CATEGORY_ICONS: Record<string, string> = {
  apparel: '🧥',
  outerwear: '🏔️',
  midlayers: '🧶',
  'waterproof-storm-shells': '🌧️',
  'technical-fleece': '🌲',
  equipment: '🎒',
  packs: '🎒',
  'sleep-systems': '⛺',
  'alpine-daypacks': '🧗',
  'ultralight-quilts': '🪶',
  accessories: '🧭',
  headwear: '🧢',
  storage: '📦',
  'field-caps': '🏕️',
  'roll-top-ditty-bags': '👝',
};

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const variations: StorefrontVariation[] = product.variations || [];
  const [selectedVariationId, setSelectedVariationId] = useState<string>(variations[0]?.id || '');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  const selectedVariation = variations.find((v) => v.id === selectedVariationId) || variations[0];

  // Dynamic media list: prepending variation workbench detail photos if present
  const mediaList: Array<{ id: string; url: string; label: string; tag: string }> = [];

  if (selectedVariation?.variation_images && selectedVariation.variation_images.length > 0) {
    selectedVariation.variation_images.forEach((img, idx) => {
      const url = getAssetUrl(img.url);
      if (url && !mediaList.some((m) => m.url === url)) {
        mediaList.push({
          id: `var-${selectedVariation.id}-${idx}`,
          url,
          label: img.caption || `${selectedVariation.variation_name} Workbench Detail`,
          tag: 'Workbench Detail',
        });
      }
    });
  }

  if (product.featured_image) {
    const url = getAssetUrl(product.featured_image);
    if (url && !mediaList.some((m) => m.url === url)) {
      mediaList.push({
        id: 'featured',
        url,
        label: `${product.title} Studio Silhouette`,
        tag: 'Studio Silhouette',
      });
    }
  }

  if (product.hero_image) {
    const url = getAssetUrl(product.hero_image);
    if (url && !mediaList.some((m) => m.url === url)) {
      mediaList.push({
        id: 'hero',
        url,
        label: `${product.title} Field Action`,
        tag: 'Field Action',
      });
    }
  }

  if (product.gallery && product.gallery.length > 0) {
    product.gallery.forEach((rawKey, idx) => {
      const url = getAssetUrl(rawKey);
      if (url && !mediaList.some((m) => m.url === url)) {
        mediaList.push({
          id: `gallery-${idx}`,
          url,
          label: `${product.title} Detail ${idx + 1}`,
          tag: 'Field & Bench',
        });
      }
    });
  }

  const activeMedia = mediaList[selectedImageIndex] || mediaList[0];
  const categoryIcon = (product.category?.slug && CATEGORY_ICONS[product.category.slug]) || '🌲';

  // Price resolution
  const currentPrice = selectedVariation ? selectedVariation.effective_price : product.base_price;
  const isOverride = selectedVariation?.price_override != null;

  // Stock status
  const isSoldOut =
    selectedVariation?.status === 'sold_out' ||
    (selectedVariation && selectedVariation.stock_quantity <= 0);
  const isComingSoon = selectedVariation?.status === 'coming_soon';
  const isAvailable = !isSoldOut && !isComingSoon;

  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleSelectVariation = (varId: string) => {
    setSelectedVariationId(varId);
    setSelectedImageIndex(0);
  };

  const handleCheckout = async () => {
    if (!selectedVariation || !isAvailable) return;
    try {
      setIsCheckingOut(true);
      setCheckoutError(null);
      const variantId =
        selectedVariation.shopify_variant_id ||
        `gid://shopify/ProductVariant/${selectedVariation.id}`;

      let checkoutUrl: string | undefined;

      try {
        const response = await fetch('/api/cart/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId, quantity: 1 }),
        });

        if (response.ok) {
          const data = await response.json();
          checkoutUrl = data?.cart?.checkoutUrl;
        } else {
          const errData = await response.json().catch(() => null);
          if (errData?.error) {
            setCheckoutError(errData.error);
            setIsCheckingOut(false);
            return;
          }
        }
      } catch {
        // Fallback to direct client if running in an environment without edge route resolution
        const res = await shopify.createCart(variantId, 1);
        checkoutUrl = res.data?.cartCreate?.cart?.checkoutUrl;
      }

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setCheckoutError('Checkout is currently unavailable');
        setIsCheckingOut(false);
      }
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to initialize checkout');
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-mono text-stone-400 uppercase tracking-wider">
        <Link href="/" className="hover:text-[#E55B24] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[#E55B24] transition-colors">
          Catalog
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-[#E55B24] transition-colors"
            >
              {product.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-stone-200 font-bold truncate">{product.title}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Media & Gallery Section */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl bg-[#15191E] border border-stone-800 overflow-hidden flex items-center justify-center shadow-2xl">
            {activeMedia ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeMedia.url}
                alt={activeMedia.label}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-8 space-y-4">
                <span className="text-8xl select-none inline-block filter drop-shadow-lg">
                  {categoryIcon}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-[#E55B24]">Workbench Silhouette Preview</p>
                  <p className="text-xs text-stone-500">Field documentation in progress</p>
                </div>
              </div>
            )}

            {/* Top Badges overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              {product.category && (
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="pointer-events-auto bg-[#15191E]/90 hover:bg-[#15191E] hover:border-[#E55B24]/50 text-stone-300 border border-stone-700/80 text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded backdrop-blur-md transition-colors"
                >
                  {product.category.name}
                </Link>
              )}
              {isSoldOut ? (
                <span className="bg-rose-950/90 text-rose-300 border border-rose-800/80 text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded backdrop-blur-md font-bold">
                  Batch Depleted
                </span>
              ) : isComingSoon ? (
                <span className="bg-stone-900/90 text-stone-400 border border-stone-700/80 text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded backdrop-blur-md">
                  In Production
                </span>
              ) : (
                <span className="bg-[#2C362B]/90 text-emerald-300 border border-[#3F4F3D] text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded backdrop-blur-md font-bold">
                  In Stock ({selectedVariation?.stock_quantity ?? 'Ready to Ship'})
                </span>
              )}
            </div>

            {/* Bottom Tag overlay */}
            {activeMedia?.tag && (
              <div className="absolute bottom-4 left-4">
                <span className="bg-[#15191E]/90 text-stone-300 border border-stone-700/80 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md">
                  {activeMedia.tag}
                </span>
              </div>
            )}
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
                      ? 'border-[#E55B24] shadow-md shadow-orange-500/20'
                      : 'border-stone-800 opacity-60 hover:opacity-100 hover:border-stone-600'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-stone-950/80 text-[9px] font-mono text-stone-300 truncate px-1 text-center">
                    {m.tag}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Workshop Crafting Note */}
          <div className="rounded-xl border border-stone-800 bg-[#15191E]/60 p-4 text-xs text-stone-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-stone-200">
              <span>🛡️</span>
              <span>BankBeaters Workshop Guarantee</span>
            </div>
            <p>
              Every silhouette is patterned, cut, and single-needle lockstitched in our Colorado
              workshop. Hand-waxed seams, reinforced stress bartacks, and built to outlast the storm.
            </p>
          </div>
        </div>

        {/* Right Column: Product Info, Variations & Actions */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedVariation?.variation_type === 'one_of_one' ? (
                <span className="text-xs font-mono uppercase tracking-wider bg-[#E55B24]/20 text-[#E55B24] border border-[#E55B24]/40 px-2 py-0.5 rounded font-bold">
                  1-of-1 Workshop Prototype
                </span>
              ) : selectedVariation?.variation_type === 'micro_batch' ? (
                <span className="text-xs font-mono uppercase tracking-wider bg-[#2C362B] text-emerald-300 border border-[#3F4F3D] px-2 py-0.5 rounded font-bold">
                  Micro-Batch Run
                </span>
              ) : (
                <span className="text-xs font-mono uppercase tracking-wider bg-stone-900 text-stone-300 border border-stone-800 px-2 py-0.5 rounded">
                  Field Gear Spec
                </span>
              )}
              {selectedVariation?.edition_badge && (
                <span className="text-xs font-mono uppercase tracking-wider bg-stone-800 text-stone-200 border border-stone-700 px-2 py-0.5 rounded font-bold">
                  {selectedVariation.edition_badge}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-100">
              {product.title}
            </h1>
            <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
              {product.description ||
                'Handcrafted technical outdoor gear built with mil-spec textiles and weatherproof construction.'}
            </p>
          </div>

          {/* Dynamic Price Display */}
          <div className="p-4 rounded-xl bg-[#15191E] border border-stone-800 space-y-1">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-stone-400 font-mono uppercase tracking-wider block">
                  Batch Price
                </span>
                <span className="text-4xl font-black text-[#E55B24]">
                  ${Number(currentPrice).toFixed(2)}
                </span>
              </div>
              {selectedVariation?.sku && (
                <div className="text-right">
                  <span className="text-xs text-stone-500 font-mono block">SKU</span>
                  <span className="text-xs font-mono font-bold text-stone-300">
                    {selectedVariation.sku}
                  </span>
                </div>
              )}
            </div>

            {isOverride ? (
              <p className="text-xs text-orange-400/90 font-mono">
                ✦ Small-batch technical material override applied
              </p>
            ) : (
              <p className="text-xs text-stone-400 font-mono">
                ✦ Standard silhouette base price (${Number(product.base_price).toFixed(2)})
              </p>
            )}
          </div>

          {/* Maker's Field Notes */}
          {(selectedVariation?.variation_notes || product.maker_field_notes) && (
            <div className="rounded-xl border border-[#3F4F3D] bg-[#2C362B]/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#E55B24] font-bold">
                  <span>📐</span>
                  <span>Maker&apos;s Field Notes</span>
                </div>
                {selectedVariation?.edition_badge && (
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-[#E55B24]/20 text-[#E55B24] border border-[#E55B24]/40 px-2 py-0.5 rounded-full font-bold">
                    {selectedVariation.edition_badge}
                  </span>
                )}
              </div>

              {selectedVariation?.variation_notes && (
                <blockquote className="text-sm font-mono text-stone-200 border-l-2 border-[#E55B24] pl-3 py-0.5 leading-relaxed italic">
                  &ldquo;{selectedVariation.variation_notes}&rdquo;
                </blockquote>
              )}

              {product.maker_field_notes &&
                product.maker_field_notes !== selectedVariation?.variation_notes && (
                  <p className="text-xs text-stone-400 font-sans leading-relaxed">
                    {product.maker_field_notes}
                  </p>
                )}

              <div className="text-[11px] font-mono text-stone-500 pt-1">
                — Chris, Lead Builder &amp; Patternmaker
              </div>
            </div>
          )}

          {/* Technical Specifications */}
          {(product.materials ||
            product.weight ||
            product.fit_profile ||
            product.origin ||
            product.technical_specs) && (
            <div className="rounded-xl border border-stone-800 bg-[#15191E] p-5 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-2">
                <span>⚙️</span> Technical Specifications
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {product.materials && (
                  <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80">
                    <dt className="text-stone-500 font-mono uppercase text-[10px] tracking-wider">
                      Materials &amp; Fabric
                    </dt>
                    <dd className="text-stone-200 font-medium mt-0.5">{product.materials}</dd>
                  </div>
                )}
                {product.weight && (
                  <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80">
                    <dt className="text-stone-500 font-mono uppercase text-[10px] tracking-wider">
                      Weight
                    </dt>
                    <dd className="text-stone-200 font-medium mt-0.5">{product.weight}</dd>
                  </div>
                )}
                {product.fit_profile && (
                  <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80">
                    <dt className="text-stone-500 font-mono uppercase text-[10px] tracking-wider">
                      Fit Profile
                    </dt>
                    <dd className="text-stone-200 font-medium mt-0.5">{product.fit_profile}</dd>
                  </div>
                )}
                {product.origin && (
                  <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80">
                    <dt className="text-stone-500 font-mono uppercase text-[10px] tracking-wider">
                      Workshop Origin
                    </dt>
                    <dd className="text-stone-200 font-medium mt-0.5">{product.origin}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Batch / Variation Selector */}
          {variations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-stone-200">
                  Select Batch / Variation ({variations.length})
                </label>
                <span className="text-xs text-stone-400 font-mono">
                  {selectedVariation?.variation_type === 'one_of_one'
                    ? '1-of-1 Workshop Prototype'
                    : selectedVariation?.variation_type === 'micro_batch'
                      ? 'Micro-Batch Run'
                      : selectedVariation?.is_limited_edition &&
                          selectedVariation.total_edition_count
                        ? `Batch of ${selectedVariation.total_edition_count}`
                        : 'Standard Production'}
                </span>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Select batch or variation">
                {variations.map((v) => {
                  const isSelected = v.id === selectedVariationId;
                  const variationSoldOut = v.status === 'sold_out' || v.stock_quantity <= 0;
                  const variationComingSoon = v.status === 'coming_soon';

                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectVariation(v.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'border-[#E55B24] bg-[#E55B24]/10 shadow-md shadow-orange-500/10'
                          : 'border-stone-800 bg-[#15191E]/60 hover:border-stone-700 hover:bg-[#15191E]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-[#E55B24] bg-[#E55B24]'
                                : 'border-stone-500 bg-transparent hover:border-stone-400'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                          </span>
                          <span className="text-sm font-semibold text-stone-100">
                            {v.variation_name}
                          </span>
                          {v.edition_badge && (
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#2C362B] text-emerald-300 border border-[#3F4F3D] px-1.5 py-0.5 rounded">
                              {v.edition_badge}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-400 font-mono pl-6">
                          <span>{v.sku}</span>
                          {v.variation_type && (
                            <>
                              <span>•</span>
                              <span className="capitalize">
                                {v.variation_type.replace('_', ' ')}
                              </span>
                            </>
                          )}
                          {v.is_limited_edition && v.total_edition_count && (
                            <>
                              <span>•</span>
                              <span>Run: {v.total_edition_count}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-base font-bold text-[#E55B24]">
                          ${Number(v.effective_price).toFixed(2)}
                        </span>
                        {variationSoldOut ? (
                          <Badge variant="danger" className="text-[10px] py-0 px-1.5">
                            Depleted
                          </Badge>
                        ) : variationComingSoon ? (
                          <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
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
              className="w-full font-bold shadow-lg shadow-orange-500/20 py-3.5 text-base bg-[#E55B24] hover:bg-[#d04f1d] text-stone-900 border-none"
              disabled={!isAvailable || isCheckingOut}
              onClick={handleCheckout}
            >
              {isCheckingOut
                ? 'Preparing Gear Roll...'
                : isSoldOut
                  ? 'Batch Depleted'
                  : isComingSoon
                    ? 'Releases Soon'
                    : `Deploy Gear • $${Number(currentPrice).toFixed(2)}`}
            </Button>

            {checkoutError && (
              <p className="text-xs text-rose-400 font-mono text-center">{checkoutError}</p>
            )}

            <Link href="/products" className="block">
              <Button variant="outline" size="md" className="w-full">
                ← Back to Field Gear Catalog
              </Button>
            </Link>
          </div>

          {/* Workshop Provenance Statement */}
          <div className="pt-4 border-t border-stone-800 text-[11px] text-stone-500 font-mono space-y-1">
            <p>Handcrafted in Small Batches · Single-Needle Lockstitched · Direct from Leadville, CO</p>
            <p>Field-tested in alpine squalls · Covered by the BankBeaters Lifetime Stitch Guarantee</p>
          </div>
        </div>
      </div>
    </div>
  );
}
