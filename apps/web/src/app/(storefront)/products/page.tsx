import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge, Button, CountdownTimer } from '@chrishop/ui';
import { fetchProducts, fetchCategories, getAssetUrl, enrichProductsWithShopifyPricing } from '@/lib/catalog';
import { buildCloudflareImageUrl, generateCloudflareImageSrcset } from '@/lib/r2-image';
import { ProductFilters } from './ProductFilters';

export const revalidate = 10;

interface ProductsPageProps {
  searchParams?: Promise<{
    category?: string;
    sort?: string;
    type?: string;
  }>;
}

export async function generateMetadata(props: ProductsPageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const activeCategory = searchParams?.category;
  const activeType = searchParams?.type;

  let title = 'Field Gear & Technical Packs';
  let description =
    'Handcrafted technical outdoor adventure gear, fishing chest rigs, and weatherproof apparel built for rugged exploration.';

  if (activeCategory) {
    const categories = await fetchCategories();
    const category = categories.find((c) => c.slug === activeCategory || c.id === activeCategory);
    if (category) {
      title = `${category.name} | Technical Outdoor Gear`;
      description =
        category.description ||
        `Explore our hand-sewn ${category.name.toLowerCase()} built in Leadville, Colorado.`;
    }
  } else if (activeType === 'micro_batch') {
    title = 'Micro-Batch & Limited Edition Gear';
    description = 'Strictly limited edition small-batch runs hand-sewn in Leadville, Colorado.';
  }

  const canonical = activeCategory ? `/products?category=${activeCategory}` : '/products';

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | BankBeaters`,
      description,
      url: canonical,
      siteName: 'BankBeaters',
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(title)}&badge=${encodeURIComponent('Field Gear Catalog')}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | BankBeaters`,
      description,
      images: [
        `/api/og?title=${encodeURIComponent(title)}&badge=${encodeURIComponent('Field Gear Catalog')}`,
      ],
    },
  };
}

const CATEGORY_ICONS: Record<string, string> = {
  apparel: '🧥',
  'packs-carry': '🎒',
  'field-accessories': '🧰',
  outerwear: '🌧️',
  'waterproof-storm-shells': '⚡',
  'storm-shells': '⚡',
  pants: '👖',
  'technical-brush-pants': '🪨',
  'brush-pants': '🪨',
  'sling-packs': '🎒',
  'chest-rigs': '🎣',
  'dry-bags': '🌊',
  'tool-rolls': '🧵',
  gloves: '🧤',
  headwear: '🧢',
};

export default async function ProductsPage(props: ProductsPageProps) {
  const searchParams = await props.searchParams;
  const activeCategory = searchParams?.category;
  const activeSort = searchParams?.sort || 'latest';
  const activeType = searchParams?.type || 'all';

  const [rawProducts, categories] = await Promise.all([
    fetchProducts({ categorySlug: activeCategory }),
    fetchCategories(),
  ]);

  // Enrich products with real-time Shopify Storefront pricing & stock
  const enrichedProducts = await enrichProductsWithShopifyPricing(rawProducts);

  // Find active category object if selected
  const activeCategoryObj = categories.find(
    (c) => c.slug === activeCategory || c.id === activeCategory
  );

  // Apply batch type filtering
  let products = enrichedProducts;
  if (activeType === 'micro_batch') {
    products = products.filter((p) =>
      p.variations?.some(
        (v) =>
          v.variation_type === 'micro_batch' ||
          v.variation_type === 'one_of_one' ||
          v.is_limited_edition
      )
    );
  } else if (activeType === 'standard') {
    products = products.filter(
      (p) =>
        !p.variations?.some(
          (v) =>
            v.variation_type === 'micro_batch' ||
            v.variation_type === 'one_of_one' ||
            v.is_limited_edition
        )
    );
  }

  // Apply sorting
  if (activeSort === 'price-asc') {
    products = [...products].sort(
      (a, b) => (a.effective_min_price ?? a.base_price) - (b.effective_min_price ?? b.base_price)
    );
  } else if (activeSort === 'price-desc') {
    products = [...products].sort(
      (a, b) => (b.effective_min_price ?? b.base_price) - (a.effective_min_price ?? a.base_price)
    );
  } else if (activeSort === 'title') {
    products = [...products].sort((a, b) => a.title.localeCompare(b.title));
  }

  const hasActiveFilters = Boolean(
    activeCategory || (activeSort && activeSort !== 'latest') || (activeType && activeType !== 'all')
  );

  return (
    <div className="space-y-10">
      {/* Page Header & Navigation */}
      <div className="border-b border-stone-800/80 pb-8 space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-stone-400 flex-wrap">
          <Link href="/" className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center">
            Home
          </Link>
          <span>/</span>
          {activeCategoryObj ? (
            <Link href="/products" className="hover:text-[#E55B24] transition-colors py-2 inline-flex items-center">
              Equipment Catalog
            </Link>
          ) : (
            <span className="text-stone-200 font-semibold uppercase">Equipment Catalog</span>
          )}
          {activeCategoryObj && (
            <>
              <span>/</span>
              <span className="text-[#E55B24] font-semibold">{activeCategoryObj.name}</span>
            </>
          )}
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-[#E55B24] uppercase font-bold tracking-widest block">
              Hand-Sewn Technical Silhouettes
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-100 uppercase font-mono mt-1">
              BankBeaters Equipment Catalog
            </h1>
            <p className="mt-2 text-stone-300 max-w-2xl text-sm sm:text-base leading-relaxed">
              Explore 3-layer waterproof storm shells, 1000D Cordura guide pants, and convertible carry
              systems built for anglers and bushwhackers who work the bank on foot.
            </p>
          </div>
          <Badge variant="olive" className="self-start md:self-auto py-1 px-3 text-xs font-mono">
            Hand-Crafted in Workshop
          </Badge>
        </div>

        {/* Interactive Filter Drawer & Category Toolbar */}
        <ProductFilters
          categories={categories}
          activeCategory={activeCategory}
          activeSort={activeSort}
          activeType={activeType}
          totalCount={products.length}
        />
      </div>

      {/* Catalog Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-[#15191E] border border-stone-800 rounded-2xl p-8 space-y-4">
          <span className="text-5xl">🎒</span>
          <h2 className="text-xl font-bold text-stone-200 font-mono uppercase">
            {hasActiveFilters ? 'No Matching Gear Found' : 'No Gear In This Category'}
          </h2>
          <p className="text-stone-400 text-sm max-w-md mx-auto">
            {hasActiveFilters
              ? 'No equipment matches the active category, batch type, or filter combination. Reset filters to explore all bench builds.'
              : 'The equipment catalog is being prepared on the workbench. Check back shortly for active drops!'}
          </p>
          {hasActiveFilters && (
            <Link href="/products">
              <Button variant="outline" size="sm" className="mt-2 font-mono text-xs min-h-[44px]">
                Reset All Filters
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {products.map((product) => {
            const imageUrl = getAssetUrl(product.featured_image || product.hero_image);
            const categoryIcon =
              (product.category?.slug && CATEGORY_ICONS[product.category.slug]) || '🎒';
            const price = product.effective_min_price ?? product.base_price;
            const hasMicroBatch = product.variations?.some(
              (v) => v.variation_type === 'micro_batch' || v.variation_type === 'one_of_one' || v.is_limited_edition
            );
            const releaseDate =
              product.release_date || product.variations?.find((v) => v.release_date)?.release_date;
            const isUpcoming =
              (product.status === 'coming_soon' ||
                product.variations?.some((v) => v.status === 'coming_soon')) &&
              Boolean(releaseDate);

            return (
              <Card
                key={product.id}
                className="group flex flex-col justify-between overflow-hidden p-0 border-stone-800 hover:border-[#E55B24]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-950/20"
              >
                {/* Visual Header / Image Container (4:5 Portrait Aspect Ratio per Section 4.3) */}
                <div className="relative aspect-[4/5] w-full bg-[#101317] overflow-hidden flex items-center justify-center border-b border-stone-800/80">
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
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt={product.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-center space-y-2 p-6">
                      <span className="text-5xl select-none group-hover:scale-110 transition-transform duration-300 inline-block">
                        {categoryIcon}
                      </span>
                      <p className="text-xs font-mono text-[#E55B24] uppercase tracking-wider font-bold">
                        {product.category?.name || 'Technical Gear'}
                      </p>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none gap-2">
                    {product.category?.name && (
                      <Badge variant="olive" className="bg-[#2C362B]/95 backdrop-blur-md text-[11px] font-mono">
                        {product.category.name}
                      </Badge>
                    )}
                    {isUpcoming && releaseDate ? (
                      <CountdownTimer targetDate={releaseDate} compact />
                    ) : hasMicroBatch ? (
                      <Badge variant="warning" className="bg-orange-950/95 backdrop-blur-md text-[11px] font-mono">
                        Micro-Batch
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="bg-stone-900/90 backdrop-blur-md text-[11px] font-mono">
                        Standard Run
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-stone-100 group-hover:text-[#E55B24] transition-colors line-clamp-1 uppercase font-mono">
                      {product.title}
                    </h2>
                    <p className="text-stone-400 text-xs line-clamp-2 leading-relaxed">
                      {product.description ||
                        'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris.'}
                    </p>
                  </div>

                  {/* Technical Specs Preview */}
                  {product.materials && (
                    <div className="p-2.5 rounded-lg bg-[#101317] border border-stone-800/80 text-[11px] font-mono space-y-1">
                      <div className="text-stone-300 truncate">
                        <span className="text-stone-500 uppercase mr-1">Materials:</span>
                        {product.materials}
                      </div>
                      {product.weight && (
                        <div className="text-stone-400">
                          <span className="text-stone-500 uppercase mr-1">Weight:</span>
                          {product.weight}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price & Action */}
                  <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-500 block font-mono uppercase">Starting at</span>
                      <span className="text-2xl font-black text-[#E55B24]">
                        ${Number(price).toFixed(2)}
                      </span>
                    </div>

                    <Link href={`/products/${product.slug}`}>
                      <Button variant={isUpcoming ? 'outline' : 'primary'} size="sm" className="font-mono text-xs uppercase font-bold tracking-wider min-h-[44px] px-4">
                        {isUpcoming ? 'Inspect Drop →' : 'Inspect Gear →'}
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
