import React from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '@chrishop/ui';
import type { StorefrontProduct } from '../../../lib/catalog';
import { getAssetUrl } from '../../../lib/catalog';
import { buildCloudflareImageUrl, generateCloudflareImageSrcset } from '../../../lib/r2-image';

export interface FeaturedCollectionSectionProps {
  title?: string;
  subtitle?: string;
  categoryFilter?: string;
  limit?: number;
  showStartingPrice?: boolean;
  products?: StorefrontProduct[];
}

export const FeaturedCollectionSection: React.FC<FeaturedCollectionSectionProps> = ({
  title = 'Active Bank Equipment',
  subtitle = 'Small-Batch Roster',
  categoryFilter = 'all',
  limit = 6,
  showStartingPrice = true,
  products = [],
}) => {
  let filtered = products;
  if (categoryFilter && categoryFilter !== 'all') {
    filtered = products.filter((p) => {
      const catSlug = p.category?.slug?.toLowerCase() || '';
      return catSlug.includes(categoryFilter.toLowerCase());
    });
  }

  const items = filtered.slice(0, limit);

  return (
    <section data-testid="section-featured-collection" className="space-y-6">
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
        <div>
          <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest block font-bold">
            {subtitle}
          </span>
          <h2 className="text-2xl font-black text-stone-100 uppercase tracking-tight font-mono">
            {title}
          </h2>
        </div>
        <Link href="/products" className="text-sm text-[#E55B24] hover:text-orange-400 font-mono font-semibold">
          View All Gear Silhouettes →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-800 rounded-xl">
          <p className="text-stone-400 text-sm font-mono">
            No equipment silhouettes currently active in this category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const itemImg = getAssetUrl(item.featured_image || item.hero_image);
            const price = Number(item.effective_min_price ?? item.base_price);

            return (
              <Card
                key={item.id}
                className="group flex flex-col justify-between overflow-hidden p-0 border-stone-800 hover:border-[#E55B24]/60 transition-all duration-300 shadow-lg bg-[#15191E]"
              >
                <div className="relative aspect-video bg-[#101317] flex items-center justify-center border-b border-stone-800">
                  {itemImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildCloudflareImageUrl(itemImg, {
                        width: 640,
                        quality: 75,
                        format: 'auto',
                        fit: 'cover',
                        onerror: 'redirect',
                      })}
                      srcSet={generateCloudflareImageSrcset(itemImg, [320, 480, 640])}
                      sizes="(max-width: 640px) 100vw, 33vw"
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-stone-800 bg-stone-900/60 flex items-center justify-center text-stone-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {item.category?.name && (
                    <Badge
                      variant="olive"
                      className="absolute top-3 left-3 bg-[#2C362B]/90 backdrop-blur-md text-[11px]"
                    >
                      {item.category.name}
                    </Badge>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h4 className="font-bold text-lg text-stone-100 group-hover:text-[#E55B24] transition-colors line-clamp-1">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-stone-400 line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-800/80">
                    <div>
                      {showStartingPrice && (
                        <span className="text-[10px] text-stone-500 font-mono block uppercase">
                          Starting at
                        </span>
                      )}
                      <span className="text-lg font-black text-[#E55B24]">
                        ${price.toFixed(2)}
                      </span>
                    </div>
                    <Link href={`/products/${item.slug}`}>
                      <Button variant="outline" size="sm" className="font-mono text-xs font-semibold">
                        Inspect →
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};
