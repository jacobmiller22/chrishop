import Link from 'next/link';
import { Button, Card, Badge } from '@chrishop/ui';
import { fetchProducts, fetchProductBySlug, getAssetUrl } from '@/lib/directus';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await fetchProducts();
  const featuredProductSlug = products[0]?.slug;

  // Fetch full details with variations for the flagship product
  const featuredProduct = featuredProductSlug
    ? await fetchProductBySlug(featuredProductSlug)
    : null;

  const flagshipVariation = featuredProduct?.variations?.[0];
  const flagshipPrice = flagshipVariation
    ? flagshipVariation.effective_price
    : featuredProduct?.base_price ?? 0;

  const flagshipImageUrl = featuredProduct
    ? getAssetUrl(featuredProduct.featured_image || featuredProduct.hero_image)
    : null;

  return (
    <div className="space-y-16">
      {/* Hero Banner */}
      <section className="text-center py-12 space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Badge variant="warning">🔥 Next Drop Live Now</Badge>
          <Badge variant="info">Directus CMS Synced</Badge>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
          Exclusive Art & Physical Collectibles
        </h1>
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400">
          Limited edition sculptures, archival fine art prints, and artisan apparel released in timed
          drops. Direct from creator to collector.
        </p>
        <div className="pt-2 flex items-center justify-center gap-4">
          <Link href="/products">
            <Button variant="primary" size="lg" className="font-semibold shadow-lg shadow-amber-500/20">
              Explore All Drops ({products.length})
            </Button>
          </Link>
          {featuredProduct && (
            <Link href={`/products/${featuredProduct.slug}`}>
              <Button variant="outline" size="lg">
                View Flagship Drop
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Featured Showcase (Live from Directus CMS) */}
      {featuredProduct && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-amber-400 uppercase tracking-widest block">
                Flagship Showcase
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Featured Live Release
              </h2>
            </div>
            <Link href="/products" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
              View All Catalog →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900/40 p-6 sm:p-8 rounded-2xl border border-slate-800">
            {/* Visual Preview */}
            <Card className="aspect-square flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 border-amber-900/30 overflow-hidden relative p-0 shadow-2xl">
              {flagshipImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={flagshipImageUrl}
                  alt={featuredProduct.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <span className="text-7xl">✨</span>
                  <p className="text-sm font-mono text-amber-400/80">Interactive Edition Preview</p>
                  <p className="text-xs text-slate-500 font-mono">
                    Directus CMS: {featuredProduct.category?.name || 'Sculptures'}
                  </p>
                </div>
              )}

              {featuredProduct.category && (
                <div className="absolute top-4 left-4">
                  <Badge variant="neutral" className="bg-slate-950/80 backdrop-blur-md text-xs">
                    {featuredProduct.category.name}
                  </Badge>
                </div>
              )}
            </Card>

            {/* Product Meta & Variation Details */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                {flagshipVariation ? (
                  <>
                    <Badge variant="success">
                      In Stock ({flagshipVariation.stock_quantity} remaining)
                    </Badge>
                    {flagshipVariation.is_limited_edition && flagshipVariation.total_edition_count && (
                      <Badge variant="info">
                        Limited Edition of {flagshipVariation.total_edition_count}
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="success">Published Release</Badge>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-3xl font-bold text-slate-100">{featuredProduct.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
                  {featuredProduct.description}
                </p>
              </div>

              <div className="flex items-baseline gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-3xl font-extrabold text-amber-400">
                  ${Number(flagshipPrice).toFixed(2)}
                </span>
                {flagshipVariation?.sku && (
                  <span className="text-xs text-slate-500 font-mono">
                    SKU: {flagshipVariation.sku} ({flagshipVariation.variation_name})
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={`/products/${featuredProduct.slug}`} className="flex-1">
                  <Button variant="primary" size="lg" className="w-full">
                    Reserve & View Editions
                  </Button>
                </Link>
                <Link href="/products">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Browse All ({products.length})
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Drops & Live Catalog Grid */}
      {products.length > 1 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-amber-400 uppercase tracking-widest block">
                Catalog
              </span>
              <h2 className="text-2xl font-bold text-slate-100">More Live Releases</h2>
            </div>
            <Link href="/products" className="text-sm text-amber-400 hover:text-amber-300">
              View All {products.length} Products →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.slice(1, 4).map((item) => {
              const itemImg = getAssetUrl(item.featured_image || item.hero_image);
              return (
                <Card
                  key={item.id}
                  className="group flex flex-col justify-between overflow-hidden p-0 border-slate-800 hover:border-amber-500/40 transition-all duration-300"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center border-b border-slate-800">
                    {itemImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={itemImg} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🎨</span>
                    )}
                    {item.category?.name && (
                      <Badge
                        variant="neutral"
                        className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-xs"
                      >
                        {item.category.name}
                      </Badge>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-lg text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-lg font-bold text-amber-400">
                        ${Number(item.effective_min_price ?? item.base_price).toFixed(2)}
                      </span>
                      <Link href={`/products/${item.slug}`}>
                        <Button variant="outline" size="sm">
                          View →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
