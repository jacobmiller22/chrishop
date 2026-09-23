'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Button,
  VariationSelector,
  StockIndicator,
  AddToCartButton,
  CountdownTimer,
  TurnstileWidget,
  CartDrawer,
  type CartItem,
  type VariationOption,
} from '@chrishop/ui';
import type { StorefrontProduct, StorefrontVariation } from '@/lib/catalog';
import { getAssetUrl } from '@/lib/assets';
import { shopify } from '@/lib/shopify';
import { buildCloudflareImageUrl } from '@/lib/r2-image';
import { MediaCarousel, type CarouselMediaItem } from '@/components/storefront/MediaCarousel';
import {
  trackProductView,
  trackAddToCartAttempt,
  trackCheckoutRedirect,
  getFunnelSessionId,
} from '../../../../lib/funnel-client';

interface ProductDetailClientProps {
  product: StorefrontProduct;
}


export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const variations: StorefrontVariation[] = product.variations || [];
  const [selectedVariationId, setSelectedVariationId] = useState<string>(variations[0]?.id || '');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isStickyVisible, setIsStickyVisible] = useState<boolean>(true);
  const buyButtonRef = useRef<HTMLDivElement | null>(null);

  const selectedVariation = variations.find((v) => v.id === selectedVariationId) || variations[0];

  // Dynamic media list: prepending variation workbench detail photos if present
  const mediaList: CarouselMediaItem[] = [];

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

  // Stage 2: Product Detail Page View Telemetry (product_view)
  useEffect(() => {
    trackProductView(
      product.slug || product.id,
      product.product_line?.slug || 'bankbeaters-leadville',
      selectedVariation?.id,
      {
        title: product.title,
        price: currentPrice,
      }
    );
  }, [product.id, product.slug]);

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
  const releaseDate = selectedVariation?.release_date || product.release_date;
  const isUpcomingDrop =
    (selectedVariation?.status === 'coming_soon' || product.status === 'coming_soon') &&
    Boolean(releaseDate);
  const isSoldOut =
    selectedVariation?.status === 'sold_out' ||
    (selectedVariation && selectedVariation.stock_quantity <= 0);
  const isComingSoon = selectedVariation?.status === 'coming_soon';
  const isAvailable = !isSoldOut && !isComingSoon;

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSelectVariation = (varId: string) => {
    setSelectedVariationId(varId);
    setSelectedImageIndex(0);
  };

  const handleAddToCart = () => {
    if (!selectedVariation || !isAvailable) return;
    const itemPrice = selectedVariation
      ? Number(selectedVariation.effective_price)
      : Number(product.base_price);
    const itemId = `${product.id}-${selectedVariation.id}`;

    // Stage 3: Add to Cart Attempt Telemetry (add_to_cart_attempt)
    trackAddToCartAttempt(
      product.slug || product.id,
      selectedVariation.shopify_variant_id || selectedVariation.id,
      product.product_line?.slug || 'bankbeaters-leadville',
      {
        title: product.title,
        price: itemPrice,
        quantity: 1,
      }
    );

    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing) {
        return prev.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: itemId,
          variantId:
            selectedVariation.shopify_variant_id ||
            `gid://shopify/ProductVariant/${selectedVariation.id}`,
          title: product.title,
          variantName: selectedVariation.variation_name,
          editionBadge: selectedVariation.edition_badge,
          price: itemPrice,
          quantity: 1,
          imageUrl: activeMedia?.url,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const handleCheckout = async () => {
    if (!selectedVariation || !isAvailable) return;
    try {
      setIsCheckingOut(true);
      setCheckoutError(null);

      // Cloudflare Turnstile Bot & Scalper Mitigation (Story 3.10)
      const requiresTurnstile =
        Boolean(process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY) ||
        process.env.NODE_ENV === 'production';

      if (requiresTurnstile && !turnstileToken) {
        setCheckoutError('Security verification required. Please complete the challenge before checkout.');
        setIsCheckingOut(false);
        if (buyButtonRef.current) {
          buyButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      const variantId =
        selectedVariation.shopify_variant_id ||
        `gid://shopify/ProductVariant/${selectedVariation.id}`;

      // Stage 3: Add to Cart Attempt Telemetry (Direct Express Checkout)
      trackAddToCartAttempt(
        product.slug || product.id,
        variantId,
        product.product_line?.slug || 'bankbeaters-leadville',
        {
          title: product.title,
          price: currentPrice,
          quantity: 1,
        }
      );

      let checkoutUrl: string | undefined;

      try {
        const response = await fetch('/api/cart/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId,
            quantity: 1,
            turnstileToken,
            dropId: product.product_line?.slug || 'bankbeaters-leadville',
            productId: product.slug || product.id,
            sessionId: getFunnelSessionId(),
          }),
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
        // Stage 5: Shopify Checkout Redirection Telemetry (checkout_redirect)
        trackCheckoutRedirect(
          product.slug || product.id,
          checkoutUrl,
          variantId,
          product.product_line?.slug || 'bankbeaters-leadville',
          {
            title: product.title,
            price: currentPrice,
          }
        );
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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#685A4E] uppercase tracking-wider flex-wrap">
        <Link href="/" className="hover:text-[#A8472A] transition-colors py-2 inline-flex items-center">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[#A8472A] transition-colors py-2 inline-flex items-center">
          Catalog
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-[#A8472A] transition-colors py-2 inline-flex items-center"
            >
              {product.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-[#2B2118] font-bold truncate">{product.title}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Media & Gallery Section */}
        <div className="lg:col-span-7 space-y-4">
          <MediaCarousel
            items={mediaList}
            selectedIndex={selectedImageIndex}
            onSelectIndex={setSelectedImageIndex}
            idleIntervalMs={5000}
            resumeDelayMs={15000}
            autoAdvance={true}
            aspectRatio="square"
            topBadges={
              <>
                {product.category && (
                  <Link
                    href={`/products?category=${product.category.slug}`}
                    className="pointer-events-auto bg-[#F8F5EE]/90 hover:bg-[#F8F5EE] hover:border-[#A8472A]/50 text-[#2B2118] border border-[#DDD0BE] text-xs font-mono uppercase tracking-wider px-3 py-2.5 rounded-lg backdrop-blur-md transition-colors min-h-[44px] inline-flex items-center"
                  >
                    {product.category.name}
                  </Link>
                )}
                <StockIndicator
                  status={selectedVariation?.status}
                  stockQuantity={selectedVariation?.stock_quantity}
                  isLimitedEdition={selectedVariation?.is_limited_edition}
                  totalEditionCount={selectedVariation?.total_edition_count}
                  releaseDate={releaseDate}
                />
              </>
            }
          />

          {/* Workshop Crafting Note */}
          <div className="rounded-xl border border-[#DDD0BE] bg-[#EFE8DC] p-4 text-xs text-[#685A4E] space-y-2">
            <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] font-semibold text-[#2B2118]">
              <span className="text-[#A8472A] font-bold">//</span>
              <span>BankBeaters Workshop Guarantee</span>
            </div>
            <p className="leading-relaxed">
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
                <span className="text-xs font-mono uppercase tracking-wider bg-[#A8472A]/10 text-[#A8472A] border border-[#A8472A]/40 px-2 py-0.5 rounded font-bold">
                  1-of-1 Workshop Prototype
                </span>
              ) : selectedVariation?.variation_type === 'micro_batch' ? (
                <span className="text-xs font-mono uppercase tracking-wider bg-[#E8E2D5] text-[#2B2118] border border-[#DDD0BE] px-2 py-0.5 rounded font-bold">
                  Micro-Batch Run
                </span>
              ) : (
                <span className="text-xs font-mono uppercase tracking-wider bg-[#EFE8DC] text-[#685A4E] border border-[#DDD0BE] px-2 py-0.5 rounded">
                  Field Gear Spec
                </span>
              )}
              {selectedVariation?.edition_badge && (
                <span className="text-xs font-mono uppercase tracking-wider bg-[#E8E2D5] text-[#2B2118] border border-[#DDD0BE] px-2 py-0.5 rounded font-bold">
                  {selectedVariation.edition_badge}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-journal-serif italic text-[#2B2118]">
              {product.title}
            </h1>
            <p className="text-[#685A4E] text-sm sm:text-base leading-relaxed">
              {product.description ||
                'Handcrafted technical outdoor gear built with mil-spec textiles and weatherproof construction.'}
            </p>
          </div>

          {/* Quick Spec // Field Gist Summary Panel (Creator IA Specification) */}
          <div className="p-4 rounded-xl bg-[#EFE8DC] border border-[#DDD0BE] space-y-3 font-mono text-xs shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD0BE] pb-2">
              <span className="font-bold text-[#A8472A] uppercase tracking-wider flex items-center gap-1.5">
                <span className="font-mono text-[#685A4E]">//</span>
                <span>Quick Spec // Field Gist</span>
              </span>
              <span className="text-[10px] text-[#685A4E] uppercase">
                {product.category?.name || 'Alpine Spec'}
              </span>
            </div>
            <ul className="space-y-2 text-[#2B2118]">
              <li className="flex items-start gap-2">
                <span className="text-[#A8472A] font-bold">▪</span>
                <span>
                  <strong className="text-[#2B2118] font-semibold uppercase">Utility: </strong>
                  {product.description || 'Rugged off-trail technical build engineered for wet wading, alpine squalls, and brush navigation.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A8472A] font-bold">▪</span>
                <span>
                  <strong className="text-[#2B2118] font-semibold uppercase">Textiles &amp; Hardware: </strong>
                  {product.materials || '500D Cordura® / Toray 3-Layer 20k/20k membrane · YKK AquaGuard® zips · Bonded nylon seams'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A8472A] font-bold">▪</span>
                <span>
                  <strong className="text-[#2B2118] font-semibold uppercase">Field Specs: </strong>
                  {product.weight ? `Weight: ${product.weight} · ` : ''}
                  {product.fit_profile ? `Fit: ${product.fit_profile} · ` : ''}
                  {product.origin || 'Leadville, CO (Elev. 10,152 ft)'}
                </span>
              </li>
            </ul>
          </div>

          {/* Scheduled Drop Launch Countdown Banner */}
          {isUpcomingDrop && releaseDate && (
            <div className="space-y-2">
              <CountdownTimer
                targetDate={releaseDate}
                onComplete={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
              />
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 px-1">
                <span>✦ Scheduled Batch Drop</span>
                <span>
                  {new Date(releaseDate).toLocaleString('en-US', {
                    timeZone: 'America/Denver',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Dynamic Price Display */}
          <div className="pt-2 pb-1 space-y-2">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="text-[11px] text-[#685A4E] font-mono uppercase tracking-wider block">
                  Batch Price
                </span>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span className="text-4xl font-black tracking-tight text-[#A8472A]">
                    ${Number(currentPrice).toFixed(2)}
                  </span>
                  {isOverride && product.base_price !== undefined && (
                    <span className="text-lg line-through text-[#685A4E]/60 font-mono">
                      ${Number(product.base_price).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              {selectedVariation?.sku && (
                <div className="text-right font-mono">
                  <span className="text-[10px] text-[#685A4E] uppercase tracking-wider block">SKU</span>
                  <span className="text-xs font-semibold text-[#2B2118]">
                    {selectedVariation.sku}
                  </span>
                </div>
              )}
            </div>

            {selectedVariation?.is_limited_edition && selectedVariation?.total_edition_count ? (
              <p className="text-xs text-[#A8472A] font-mono flex items-center gap-1.5 font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#A8472A]"></span>
                <span>Limited Edition — {selectedVariation.stock_quantity ?? 0} of {selectedVariation.total_edition_count} remaining</span>
              </p>
            ) : null}

            {isOverride ? (
              <p className="text-xs text-[#A8472A] font-mono flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#A8472A]"></span>
                <span>Small-batch technical material override applied</span>
              </p>
            ) : (
              <p className="text-xs text-[#685A4E] font-mono">
                Standard silhouette base price (${Number(product.base_price).toFixed(2)})
              </p>
            )}
          </div>

          {/* Maker's Field Notes */}
          {(selectedVariation?.variation_notes || product.maker_field_notes) && (
            <div className="rounded-xl border border-[#DDD0BE] bg-[#EFE8DC] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#A8472A] font-bold">
                  <span className="text-[#685A4E] font-mono">//</span>
                  <span>Maker&apos;s Field Notes</span>
                </div>
                {selectedVariation?.edition_badge && (
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-[#A8472A]/15 text-[#A8472A] border border-[#A8472A]/30 px-2 py-0.5 rounded-full font-bold">
                    {selectedVariation.edition_badge}
                  </span>
                )}
              </div>

              {selectedVariation?.variation_notes && (
                <blockquote className="text-sm font-mono text-[#2B2118] border-l-2 border-[#A8472A] pl-3 py-0.5 leading-relaxed italic">
                  &ldquo;{selectedVariation.variation_notes}&rdquo;
                </blockquote>
              )}

              {product.maker_field_notes &&
                product.maker_field_notes !== selectedVariation?.variation_notes && (
                  <p className="text-xs text-[#685A4E] font-sans leading-relaxed">
                    {product.maker_field_notes}
                  </p>
                )}

              <div className="text-[11px] font-mono text-[#685A4E] pt-1">
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
            <div className="rounded-xl border border-[#DDD0BE] bg-[#EFE8DC] p-5 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#685A4E] font-semibold flex items-center gap-2">
                <span className="text-[#A8472A] font-mono font-bold">//</span> Technical Specifications
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {product.materials && (
                  <div className="p-2.5 rounded-lg bg-[#F8F5EE] border border-[#DDD0BE]">
                    <dt className="text-[#685A4E] font-mono uppercase text-[10px] tracking-wider">
                      Materials &amp; Fabric
                    </dt>
                    <dd className="text-[#2B2118] font-medium mt-0.5">{product.materials}</dd>
                  </div>
                )}
                {product.weight && (
                  <div className="p-2.5 rounded-lg bg-[#F8F5EE] border border-[#DDD0BE]">
                    <dt className="text-[#685A4E] font-mono uppercase text-[10px] tracking-wider">
                      Weight
                    </dt>
                    <dd className="text-[#2B2118] font-medium mt-0.5">{product.weight}</dd>
                  </div>
                )}
                {product.fit_profile && (
                  <div className="p-2.5 rounded-lg bg-[#F8F5EE] border border-[#DDD0BE]">
                    <dt className="text-[#685A4E] font-mono uppercase text-[10px] tracking-wider">
                      Fit Profile
                    </dt>
                    <dd className="text-[#2B2118] font-medium mt-0.5">{product.fit_profile}</dd>
                  </div>
                )}
                {product.origin && (
                  <div className="p-2.5 rounded-lg bg-[#F8F5EE] border border-[#DDD0BE]">
                    <dt className="text-[#685A4E] font-mono uppercase text-[10px] tracking-wider">
                      Workshop Origin
                    </dt>
                    <dd className="text-[#2B2118] font-medium mt-0.5">{product.origin}</dd>
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
            <TurnstileWidget
              action="checkout"
              onVerify={(token) => {
                setTurnstileToken(token);
                setCheckoutError(null);
              }}
              onError={() => {
                setCheckoutError('Security verification failed. Please refresh and try again.');
              }}
              onExpire={() => {
                setTurnstileToken(null);
              }}
            />

            <AddToCartButton
              price={currentPrice}
              status={selectedVariation?.status}
              stockQuantity={selectedVariation?.stock_quantity}
              isLoading={isCheckingOut}
              onClick={handleAddToCart}
            />

            {checkoutError && (
              <p className="text-xs text-rose-400 font-mono text-center">{checkoutError}</p>
            )}

            <Link href="/products" className="block">
              <Button variant="outline" size="md" className="w-full min-h-[44px] border-[#DDD0BE] text-[#2B2118] hover:bg-[#EFE8DC]">
                ← Back to Field Gear Catalog
              </Button>
            </Link>
          </div>

          {/* Workshop Provenance Statement */}
          <div className="pt-4 border-t border-[#DDD0BE] text-[11px] text-[#685A4E] font-mono space-y-1">
            <p>Handcrafted in Small Batches · Single-Needle Lockstitched · Direct from Leadville, CO</p>
            <p>Field-tested in alpine squalls · Covered by the BankBeaters Lifetime Stitch Guarantee</p>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Action Bar (Section 4.4.2) */}
      {isStickyVisible && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-3 bg-[#1E1813]/95 border-t border-[#3A2E24]/90 backdrop-blur-md md:hidden flex items-center justify-between gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeMedia && (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#3A2E24] shrink-0 bg-[#1A1613]">
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
              <div className="text-xs font-bold text-[#F8F5EE] truncate">{product.title}</div>
              <div className="text-xs font-mono font-bold text-[#A8472A]">
                ${Number(currentPrice).toFixed(2)}
                {selectedVariation?.edition_badge && (
                  <span className="ml-1.5 text-[10px] text-[#DDD0BE]/70 font-normal">
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
            onClick={handleAddToCart}
            dataTestId="mobile-deploy-gear-button"
            className="w-auto shrink-0 min-h-[44px] px-4 font-bold text-xs uppercase tracking-wider py-2"
          >
            {isCheckingOut ? 'Rolling...' : isSoldOut ? 'Depleted' : 'Deploy Gear'}
          </AddToCartButton>
        </div>
      )}

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={(id, qty) =>
          setCartItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
          )
        }
        onRemoveItem={(id) =>
          setCartItems((prev) => prev.filter((item) => item.id !== id))
        }
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
        checkoutError={checkoutError}
      />
    </div>

  );
}
