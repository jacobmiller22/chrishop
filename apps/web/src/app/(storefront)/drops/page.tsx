import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge, Button, CountdownTimer } from '@chrishop/ui';
import { getScheduledDrops, getAssetUrl, enrichProductsWithShopifyPricing } from '@/lib/catalog';
import { buildCloudflareImageUrl, generateCloudflareImageSrcset } from '@/lib/r2-image';

import { dropsMetadata } from '@/lib/metadata';
import { DropCountdownTracker } from '../../../components/storefront/DropCountdownTracker';

export const revalidate = 10;

export const metadata: Metadata = dropsMetadata;

export default async function DropSchedulePage() {
  const rawScheduledProducts = await getScheduledDrops();
  const scheduledProducts = await enrichProductsWithShopifyPricing(rawScheduledProducts);

  return (
    <div className="space-y-10">
      {/* Header & Breadcrumb */}
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-stone-400 uppercase tracking-wider flex-wrap">
          <Link href="/" className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center">
            Home
          </Link>
          <span>/</span>
          <span className="text-stone-200 font-semibold uppercase">Drop Schedule</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-[#E55B24] uppercase font-bold tracking-widest block">
              Hand-Crafted Small-Batch Releases
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-100 uppercase font-mono mt-1">
              Scheduled Drop Calendar
            </h1>
            <p className="mt-2 text-stone-300 max-w-2xl text-sm sm:text-base leading-relaxed">
              Every BankBeaters silhouette is built in strictly limited runs in our Colorado workshop.
              When a countdown hits zero, checkout unlocks immediately.
            </p>
          </div>
          <Badge variant="olive" className="self-start md:self-auto py-1 px-3 text-xs font-mono">
            Leadville Workshop · Mountain Time (MT)
          </Badge>
        </div>
      </div>

      {/* Drop Protocol & Rules Explainer Panel */}
      <div className="p-6 rounded-2xl bg-[#101317] border border-stone-800 space-y-4 shadow-inner">
        <div className="flex items-center gap-2 border-b border-stone-800/80 pb-3">
          <span className="font-mono text-[#E55B24] font-bold text-xs">// PROTOCOL</span>
          <h2 className="text-sm font-mono uppercase tracking-wider text-stone-200 font-bold">
            Drop Day Protocol &amp; Purchase Mechanics
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-stone-300 font-mono">
          <div className="space-y-1.5 p-3 rounded-xl bg-[#15191E]/60 border border-stone-800/80">
            <span className="text-[#E55B24] font-bold block">01 // Strict Batch Numbers</span>
            <p className="text-stone-400 leading-relaxed">
              Batches are strictly capped (typically 3 to 25 units). No auto-restocks or mass re-runs.
            </p>
          </div>
          <div className="space-y-1.5 p-3 rounded-xl bg-[#15191E]/60 border border-stone-800/80">
            <span className="text-[#E55B24] font-bold block">02 // Synchronized Release Gate</span>
            <p className="text-stone-400 leading-relaxed">
              Live countdown timers synchronize globally. The Add to Cart button unlocks the instant countdown reaches 00:00:00.
            </p>
          </div>
          <div className="space-y-1.5 p-3 rounded-xl bg-[#15191E]/60 border border-stone-800/80">
            <span className="text-[#E55B24] font-bold block">03 // First-To-Checkout</span>
            <p className="text-stone-400 leading-relaxed">
              Shopify Storefront locks inventory upon cart checkout submission. Fast-fingers and auto-fill recommended.
            </p>
          </div>
        </div>
      </div>

      {/* Scheduled Drops List */}
      {scheduledProducts.length === 0 ? (
        <div className="text-center py-16 bg-[#15191E] border border-stone-800 rounded-2xl p-8 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-xl border border-stone-800 bg-[#101317] flex items-center justify-center text-stone-500">
            <svg className="w-8 h-8 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-stone-200 font-mono uppercase tracking-wider">
            [ WORKBENCH CLEARED — ALL ACTIVE BATCHES DEPLOYED ]
          </h2>
          <p className="text-stone-400 text-xs max-w-md mx-auto leading-relaxed">
            All current scheduled drops have concluded or are in active field distribution. Chris is currently patterning
            the next silhouette batch in the workshop.
          </p>
          <div className="pt-2">
            <Link href="/products">
              <Button variant="primary" size="md" className="font-mono text-xs uppercase font-bold tracking-wider min-h-[44px]">
                Explore Active Field Gear Catalog →
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {scheduledProducts.map((product) => {
            const imageUrl = getAssetUrl(product.featured_image || product.hero_image);
            const releaseDate =
              product.release_date || product.variations?.find((v) => v.release_date)?.release_date;
            const price = product.effective_min_price ?? product.base_price;
            const limitedVariation = product.variations?.find((v) => v.is_limited_edition);
            const batchLabel =
              product.variations?.[0]?.edition_badge ||
              (limitedVariation?.total_edition_count
                ? `Edition of ${limitedVariation.total_edition_count}`
                : 'Limited Workshop Run');

            return (
              <Card
                key={product.id}
                className="overflow-hidden p-0 border-stone-800 bg-[#15191E]/80 hover:border-[#E55B24]/40 transition-all duration-300 shadow-xl"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Left Column: Product Silhouette Preview */}
                  <div className="lg:col-span-4 relative aspect-[4/3] lg:aspect-square w-full bg-[#101317] overflow-hidden border-b lg:border-b-0 lg:border-r border-stone-800/80">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={buildCloudflareImageUrl(imageUrl, {
                          width: 640,
                          quality: 75,
                          format: 'auto',
                          fit: 'cover',
                          onerror: 'redirect',
                        })}
                        srcSet={generateCloudflareImageSrcset(imageUrl, [320, 480, 640])}
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        alt={product.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 space-y-2 text-center">
                        <div className="w-12 h-12 rounded-lg border border-stone-800 bg-stone-900/60 flex items-center justify-center text-stone-600 mb-1">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-mono text-[#E55B24] uppercase tracking-wider font-bold">
                          [ SPEC // SILHOUETTE ]
                        </span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <Badge variant="olive" className="bg-[#2C362B]/95 backdrop-blur-md text-[11px] font-mono">
                        {product.category?.name || 'Upcoming Spec'}
                      </Badge>
                      <Badge variant="warning" className="bg-orange-950/95 backdrop-blur-md text-[11px] font-mono">
                        {batchLabel}
                      </Badge>
                    </div>
                  </div>

                  {/* Right Column: Drop Details & Live Countdown */}
                  <div className="lg:col-span-8 p-6 lg:p-8 space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-mono text-[#E55B24] uppercase tracking-wider font-bold">
                          {releaseDate
                            ? `Scheduled Drop: ${new Date(releaseDate).toLocaleString('en-US', {
                                timeZone: 'America/Denver',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZoneName: 'short',
                              })}`
                            : 'Date Announcement Pending'}
                        </span>
                        <span className="text-xs font-mono text-stone-400">
                          Leadville, CO Workshop
                        </span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-100 uppercase font-mono tracking-tight">
                        {product.title}
                      </h2>
                      <p className="text-stone-300 text-sm leading-relaxed max-w-2xl">
                        {product.description ||
                          'Patagonia-grade technical gear handcrafted in Leadville, CO for rugged off-trail exploration.'}
                      </p>
                    </div>

                    {/* Live Release Countdown Timer */}
                    {releaseDate && (
                      <div className="max-w-xl">
                        <CountdownTimer targetDate={releaseDate} />
                        <DropCountdownTracker
                          dropId={product.product_line?.slug || 'bankbeaters-leadville'}
                          productId={product.slug || product.id}
                          title={product.title}
                          targetDate={releaseDate}
                        />
                      </div>
                    )}

                    {/* Maker & Textile Specs */}
                    {(product.materials || product.weight || product.origin) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-[#101317] border border-stone-800 text-xs font-mono">
                        {product.materials && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-stone-500 uppercase block">Textiles</span>
                            <span className="text-stone-300 truncate block">{product.materials}</span>
                          </div>
                        )}
                        {product.weight && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-stone-500 uppercase block">Weight</span>
                            <span className="text-stone-300 block">{product.weight}</span>
                          </div>
                        )}
                        {product.origin && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-stone-500 uppercase block">Origin</span>
                            <span className="text-stone-300 truncate block">{product.origin}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price & Action CTA */}
                    <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <span className="text-[10px] text-stone-500 block font-mono uppercase">Batch Launch Price</span>
                        <span className="text-2xl sm:text-3xl font-black text-[#E55B24] font-mono">
                          ${Number(price).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Link href={`/products/${product.slug}`}>
                          <Button variant="primary" size="md" className="font-mono text-xs uppercase font-bold tracking-wider min-h-[44px] px-6">
                            Inspect Drop Spec →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
