'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Button,
  ImageGallery,
  VariationSelector,
  StockIndicator,
  AddToCartButton,
  type VariationOption,
} from '@chrishop/ui';
import type { StorefrontProduct, StorefrontVariation } from '@/lib/catalog';
import { getAssetUrl } from '@/lib/assets';
import { shopify } from '@/lib/shopify';
import { buildCloudflareImageUrl, generateCloudflareImageSrcset } from '@/lib/r2-image';

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
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isStickyVisible, setIsStickyVisible] = useState<boolean>(true);
  const buyButtonRef = useRef<HTMLDivElement | null>(null);

  const markImageLoaded = useCallback((url: string) => {

    if (!url) return;
    setLoadedImages((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const prefetchFullImage = useCallback(
    (url: string) => {
      if (typeof window !== 'undefined' && url && !loadedImages.has(url)) {
        const img = new window.Image();
        img.src = buildCloudflareImageUrl(url, {
          width: 1024,
          quality: 80,
          format: 'auto',
          onerror: 'redirect',
        });
        if (img.complete && img.naturalWidth > 0) {
          markImageLoaded(url);
        } else {
          img.onload = () => markImageLoaded(url);
          img.onerror = () => markImageLoaded(url);
        }
      }
    },
    [loadedImages, markImageLoaded]
  );

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

  const heroImageRef = useRef<HTMLImageElement | null>(null);

  const handleHeroImageRef = useCallback(
    (el: HTMLImageElement | null) => {
      heroImageRef.current = el;
      if (el && el.complete && el.naturalWidth > 0 && activeMedia?.url) {
        markImageLoaded(activeMedia.url);
      }
    },
    [activeMedia?.url, markImageLoaded]
  );

  useEffect(() => {
    const el = heroImageRef.current;
    if (!el || !activeMedia?.url) return;

    if (el.complete && el.naturalWidth > 0) {
      markImageLoaded(activeMedia.url);
      return;
    }

    if ('decode' in el && typeof el.decode === 'function') {
      el.decode()
        .then(() => {
          if (activeMedia?.url) {
            markImageLoaded(activeMedia.url);
          }
        })
        .catch(() => {
          // Ignore cancellation when switching images
        });
    }
  }, [activeMedia?.url, markImageLoaded]);

  // Mobile Sticky Action Bar Visibility Observer
  useEffect(() => {
    const target = buyButtonRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When main purchase block is scrolled out of view, show sticky bar
        setIsStickyVisible(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);


  // Price resolution
  const currentPrice = selectedVariation ? selectedVariation.effective_price : product.base_price;
  const isOverride = selectedVariation?.price_override != null;

  const variationOptions: VariationOption[] = variations.map((v) => ({
    id: v.id,
    name: v.variation_name,
    sku: v.sku,
    price: v.effective_price,
    basePrice: product.base_price,
    priceOverride: v.price_override,
    isLimitedEdition: v.is_limited_edition,
    totalEditionCount: v.total_edition_count,
    editionBadge: v.edition_badge,
    variationType: v.variation_type,
    status: v.status,
    stockQuantity: v.stock_quantity,
  }));

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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-stone-400 uppercase tracking-wider flex-wrap">
        <Link href="/" className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center">
          Catalog
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center"
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
          <ImageGallery
            images={mediaList}
            selectedIndex={selectedImageIndex}
            onSelectIndex={setSelectedImageIndex}
            fallbackIcon={categoryIcon}
            topBadges={
              <>
                {product.category && (
                  <Link
                    href={`/products?category=${product.category.slug}`}
                    className="pointer-events-auto bg-[#15191E]/90 hover:bg-[#15191E] hover:border-[#E55B24]/50 text-stone-300 border border-stone-700/80 text-xs font-mono uppercase tracking-wider px-3 py-2.5 rounded-lg backdrop-blur-md transition-colors min-h-[44px] inline-flex items-center"
                  >
                    {product.category.name}
                  </Link>
                )}
                <StockIndicator
                  status={selectedVariation?.status}
                  stockQuantity={selectedVariation?.stock_quantity}
                  isLimitedEdition={selectedVariation?.is_limited_edition}
                  totalEditionCount={selectedVariation?.total_edition_count}
                />
              </>
            }
            renderHero={(activeMedia) => (
              <div className="relative w-full h-full">
                {/* Instant Low-Quality Blurred Placeholder (0ms paint, eliminates scanlines) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={buildCloudflareImageUrl(activeMedia.url, {
                    width: 32,
                    quality: 30,
                    blur: 50,
                    format: 'auto',
                    onerror: 'redirect',
                  })}
                  alt=""
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover filter blur-lg scale-105 transition-opacity duration-700 pointer-events-none z-0 ${
                    loadedImages.has(activeMedia.url) ? 'opacity-0' : 'opacity-100'
                  }`}
                />

                {/* Prioritized High-Fidelity Active Hero Image with Responsive Srcset */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={handleHeroImageRef}
                  key={activeMedia.url}
                  src={buildCloudflareImageUrl(activeMedia.url, {
                    width: 1024,
                    quality: 80,
                    format: 'auto',
                    onerror: 'redirect',
                  })}
                  srcSet={generateCloudflareImageSrcset(activeMedia.url, [384, 640, 768, 1024, 1536])}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  alt={activeMedia.label}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  onLoad={() => {
                    markImageLoaded(activeMedia.url);
                  }}
                  onError={() => {
                    markImageLoaded(activeMedia.url);
                  }}
                  className={`relative z-10 w-full h-full object-cover transition-opacity duration-500 ease-out ${
                    loadedImages.has(activeMedia.url) ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            )}
            renderThumbnail={(m, idx, isSelected) => {
              const isCachedHighRes = loadedImages.has(m.url);
              const thumbUrl = isCachedHighRes
                ? buildCloudflareImageUrl(m.url, {
                    width: 1024,
                    quality: 80,
                    format: 'auto',
                    onerror: 'redirect',
                  })
                : buildCloudflareImageUrl(m.url, {
                    width: 160,
                    quality: 75,
                    format: 'auto',
                    fit: 'cover',
                    onerror: 'redirect',
                  });

              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={m.label}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    prefetchFullImage(m.url);
                  }}
                  onMouseEnter={() => prefetchFullImage(m.url)}
                  onTouchStart={() => prefetchFullImage(m.url)}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 min-h-[44px] min-w-[44px] ${
                    isSelected
                      ? 'border-[#E55B24] shadow-md shadow-orange-500/20'
                      : 'border-stone-800 opacity-60 hover:opacity-100 hover:border-stone-600'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl}
                    alt={m.label}
                    width={80}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  {m.tag && (
                    <span className="absolute bottom-0 inset-x-0 bg-stone-950/80 text-[9px] font-mono text-stone-300 truncate px-1 text-center">
                      {m.tag}
                    </span>
                  )}
                </button>
              );
            }}
          />

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

          {/* Quick Spec // Field Gist Summary Panel (Creator IA Specification) */}
          <div className="p-4 rounded-xl bg-[#101317] border border-stone-800 space-y-3 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
              <span className="font-bold text-[#E55B24] uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span>
                <span>Quick Spec // Field Gist</span>
              </span>
              <span className="text-[10px] text-stone-500 uppercase">
                {product.category?.name || 'Alpine Spec'}
              </span>
            </div>
            <ul className="space-y-2 text-stone-300">
              <li className="flex items-start gap-2">
                <span className="text-[#E55B24] font-bold">▪</span>
                <span>
                  <strong className="text-stone-100 font-semibold uppercase">Utility: </strong>
                  {product.description || 'Rugged off-trail technical build engineered for wet wading, alpine squalls, and brush navigation.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#E55B24] font-bold">▪</span>
                <span>
                  <strong className="text-stone-100 font-semibold uppercase">Textiles &amp; Hardware: </strong>
                  {product.materials || '500D Cordura® / Toray 3-Layer 20k/20k membrane · YKK AquaGuard® zips · Bonded nylon seams'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#E55B24] font-bold">▪</span>
                <span>
                  <strong className="text-stone-100 font-semibold uppercase">Field Specs: </strong>
                  {product.weight ? `Weight: ${product.weight} · ` : ''}
                  {product.fit_profile ? `Fit: ${product.fit_profile} · ` : ''}
                  {product.origin || 'Leadville, CO (Elev. 10,152 ft)'}
                </span>
              </li>
            </ul>
          </div>

          {/* Dynamic Price Display */}
          <div className="p-4 rounded-xl bg-[#15191E] border border-stone-800 space-y-2">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs text-stone-400 font-mono uppercase tracking-wider block">
                  Batch Price
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-[#E55B24]">
                    ${Number(currentPrice).toFixed(2)}
                  </span>
                  {isOverride && product.base_price !== undefined && (
                    <span className="text-lg line-through text-stone-500 font-mono">
                      ${Number(product.base_price).toFixed(2)}
                    </span>
                  )}
                </div>
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

            {selectedVariation?.is_limited_edition && selectedVariation?.total_edition_count ? (
              <p className="text-xs text-emerald-400 font-mono">
                ✦ Limited Edition — {selectedVariation.stock_quantity ?? 0} of {selectedVariation.total_edition_count} remaining
              </p>
            ) : null}

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
            <VariationSelector
              variations={variationOptions}
              selectedVariationId={selectedVariationId}
              onSelectVariation={handleSelectVariation}
            />
          )}

          {/* Purchase Actions */}
          <div className="space-y-3 pt-2" ref={buyButtonRef}>
            <AddToCartButton
              price={currentPrice}
              status={selectedVariation?.status}
              stockQuantity={selectedVariation?.stock_quantity}
              isLoading={isCheckingOut}
              onClick={handleCheckout}
            />

            {checkoutError && (
              <p className="text-xs text-rose-400 font-mono text-center">{checkoutError}</p>
            )}

            <Link href="/products" className="block">
              <Button variant="outline" size="md" className="w-full min-h-[44px]">
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

      {/* Mobile Sticky Action Bar (Section 4.4.2) */}
      {isStickyVisible && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-3 bg-[#15191E]/95 border-t border-stone-800/90 backdrop-blur-md md:hidden flex items-center justify-between gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeMedia && (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-stone-800 shrink-0 bg-[#101317]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={buildCloudflareImageUrl(activeMedia.url, {
                    width: 80,
                    quality: 70,
                    format: 'auto',
                    fit: 'cover',
                  })}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-100 truncate">{product.title}</div>
              <div className="text-xs font-mono font-bold text-[#E55B24]">
                ${Number(currentPrice).toFixed(2)}
                {selectedVariation?.edition_badge && (
                  <span className="ml-1.5 text-[10px] text-stone-400 font-normal">
                    ({selectedVariation.edition_badge})
                  </span>
                )}
              </div>
            </div>
          </div>
          <AddToCartButton
            price={currentPrice}
            status={selectedVariation?.status}
            stockQuantity={selectedVariation?.stock_quantity}
            isLoading={isCheckingOut}
            onClick={handleCheckout}
            className="w-auto shrink-0 min-h-[44px] px-4 font-bold text-xs uppercase tracking-wider py-2"
          >
            {isCheckingOut ? 'Rolling...' : isSoldOut ? 'Depleted' : 'Deploy Gear'}
          </AddToCartButton>
        </div>
      )}
    </div>

  );
}
