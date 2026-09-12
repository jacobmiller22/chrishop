import Link from 'next/link';
import Image from 'next/image';
import { Card, Badge, Button, ArtworkMedia, ARTWORK_MEDIA_SIZES } from '@chrishop/ui';
import { fetchProducts, fetchCategories, getAssetUrl } from '@/lib/catalog';

export const revalidate = 10;

interface ProductsPageProps {
  searchParams?: Promise<{
    category?: string;
  }>;
}

const CATEGORY_ICONS: Record<string, string> = {
  sculptures: '🗿',
  prints: '🖼️',
  wearables: '👕',
  'digital-editions': '💎',
};

export default async function ProductsPage(props: ProductsPageProps) {
  const searchParams = await props.searchParams;
  const activeCategory = searchParams?.category;

  const [products, categories] = await Promise.all([
    fetchProducts({ categorySlug: activeCategory }),
    fetchCategories(),
  ]);

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="border-b border-slate-800/80 pb-8 space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/" className="hover:text-amber-400 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium">Catalog</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
              Art Catalog & Limited Drops
            </h1>
            <p className="mt-2 text-slate-400 max-w-2xl text-sm sm:text-base">
              Explore handcrafted sculptures, archival fine art prints, and artisan apparel released
              directly from Chris&apos;s studio.
            </p>
          </div>
          <Badge variant="success" className="self-start md:self-auto py-1 px-3 text-xs">
            Handcrafted Edition
          </Badge>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Link
            href="/products"
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              !activeCategory
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-amber-500/50 hover:text-amber-400'
            }`}
          >
            All Categories ({products.length})
          </Link>
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.slug;
            const icon = CATEGORY_ICONS[cat.slug] || '✨';
            return (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-amber-500/50 hover:text-amber-400'
                }`}
              >
                <span>{icon}</span>
                <span>{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Catalog Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 space-y-4">
          <span className="text-5xl">🎨</span>
          <h2 className="text-xl font-bold text-slate-200">No Products Available</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {activeCategory
              ? `No published products found in category "${activeCategory}". Try viewing all categories.`
              : 'The catalog is currently being prepared. Check back shortly for the next live drop!'}
          </p>
          {activeCategory && (
            <Link href="/products">
              <Button variant="outline" size="sm" className="mt-2">
                View All Categories
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {products.map((product) => {
            const imageUrl = getAssetUrl(product.featured_image || product.hero_image);
            const categoryIcon =
              (product.category?.slug && CATEGORY_ICONS[product.category.slug]) || '✨';
            const price = product.effective_min_price ?? product.base_price;

            return (
              <Card
                key={product.id}
                className="group flex flex-col justify-between overflow-hidden p-0 border-slate-800 hover:border-amber-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5"
              >
                {/* Visual Header / Image Container */}
                <div className="relative aspect-square w-full bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-800/80">
                  {imageUrl ? (
                    <ArtworkMedia
                      src={imageUrl}
                      alt={product.title}
                      sizes={ARTWORK_MEDIA_SIZES.CATALOG_GRID}
                      aspectRatio="square"
                      asImage={Image}
                      imgClassName="group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-center space-y-2 p-6">
                      <span className="text-5xl select-none group-hover:scale-110 transition-transform duration-300 inline-block">
                        {categoryIcon}
                      </span>
                      <p className="text-xs font-mono text-amber-400/70 uppercase tracking-wider">
                        {product.category?.name || 'Limited Edition'}
                      </p>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                    {product.category?.name && (
                      <Badge variant="neutral" className="bg-slate-950/80 backdrop-blur-md text-xs">
                        {product.category.name}
                      </Badge>
                    )}
                    <Badge variant="warning" className="bg-amber-950/80 backdrop-blur-md text-xs">
                      Active Drop
                    </Badge>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                      {product.title}
                    </h2>
                    <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">
                      {product.description ||
                        'Exclusive physical collectible hand-crafted by Chris.'}
                    </p>
                  </div>

                  {/* Price & Action */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">Starting at</span>
                      <span className="text-2xl font-black text-amber-400">
                        ${Number(price).toFixed(2)}
                      </span>
                    </div>

                    <Link href={`/products/${product.slug}`}>
                      <Button variant="primary" size="sm" className="font-semibold">
                        View Editions →
                      </Button>
                    </Link>
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
