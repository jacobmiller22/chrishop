import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Button, CountdownTimer } from '@chrishop/ui';
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
      <div className="border-b border-[#DDD0BE] pb-8 space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#685A4E] flex-wrap">
          <Link href="/" className="hover:text-[#A8472A] transition-colors py-2 inline-flex items-center">
            Home
          </Link>
          <span>/</span>
          {activeCategoryObj ? (
            <Link href="/products" className="hover:text-[#A8472A] transition-colors py-2 inline-flex items-center">
              Equipment Catalog
            </Link>
          ) : (
            <span className="text-[#2B2118] font-semibold uppercase">Equipment Catalog</span>
          )}
          {activeCategoryObj && (
            <>
              <span>/</span>
              <span className="text-[#A8472A] font-semibold">{activeCategoryObj.name}</span>
            </>
          )}
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-[#A8472A] uppercase font-bold tracking-widest block">
              Hand-Sewn Technical Silhouettes
            </span>
            <h1 className="text-3xl sm:text-4xl font-journal-serif italic tracking-tight text-[#2B2118] mt-1">
              BankBeaters Equipment Catalog
            </h1>
            <p className="mt-2 text-[#685A4E] max-w-2xl text-sm sm:text-base leading-relaxed">
              Explore 3-layer waterproof storm shells, 1000D Cordura guide pants, and convertible carry
              systems built for anglers and bushwhackers who work the bank on foot.
            </p>
          </div>
          <span className="self-start md:self-auto py-1 px-3 text-xs font-mono bg-[#EFE8DC] text-[#2B2118] border border-[#DDD0BE] rounded-full font-semibold">
            Hand-Crafted in Workshop
          </span>
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
        <div className="text-center py-16 bg-[#EFE8DC] border border-[#DDD0BE] rounded-2xl p-8 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-xl border border-[#DDD0BE] bg-[#F8F5EE] flex items-center justify-center text-[#685A4E]">
            <svg className="w-8 h-8 text-[#685A4E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[#2B2118] font-mono uppercase tracking-wider">
            {hasActiveFilters ? '[ NO MATCHING GEAR SPECIFICATIONS ]' : '[ NO GEAR IN THIS CATEGORY ]'}
          </h2>
          <p className="text-[#685A4E] text-xs max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'No equipment matches the active category, batch type, or filter combination. Reset filters to explore all bench builds.'
              : 'The equipment catalog is being prepared on the workbench. Check back shortly for active drops!'}
          </p>
          {hasActiveFilters && (
            <Link href="/products">
              <Button variant="outline" size="sm" className="mt-2 font-mono text-xs min-h-[44px] border-[#DDD0BE] text-[#2B2118] hover:bg-[#F8F5EE]">
                Reset All Filters
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {products.map((product) => {
            const imageUrl = getAssetUrl(product.featured_image || product.hero_image);
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
                className="group flex flex-col justify-between overflow-hidden p-0 !bg-[#EFE8DC] !border-[#DDD0BE] hover:!border-[#A8472A]/70 transition-all duration-300 hover:shadow-xl hover:shadow-[#2B2118]/5 rounded-2xl"
              >
                {/* Visual Header / Image Container (4:5 Portrait Aspect Ratio per Section 4.3) */}
                <div className="relative aspect-[4/5] w-full bg-[#E5DDCF] overflow-hidden flex items-center justify-center border-b border-[#DDD0BE]">
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
                      <div className="mx-auto w-12 h-12 rounded-lg border border-[#DDD0BE] bg-[#F8F5EE] flex items-center justify-center text-[#685A4E] mb-1 group-hover:border-[#A8472A]/60 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-[11px] font-mono text-[#A8472A] uppercase tracking-wider font-bold">
                        [ SPEC // SILHOUETTE ]
                      </p>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none gap-2">
                    {product.category?.name && (
                      <span className="bg-[#F8F5EE]/95 backdrop-blur-md text-[11px] font-mono text-[#2B2118] border border-[#DDD0BE] px-2.5 py-0.5 rounded-full font-semibold">
                        {product.category.name}
                      </span>
                    )}
                    {isUpcoming && releaseDate ? (
                      <CountdownTimer targetDate={releaseDate} compact />
                    ) : hasMicroBatch ? (
                      <span className="bg-[#A8472A] text-white backdrop-blur-md text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                        Micro-Batch
                      </span>
                    ) : (
                      <span className="bg-[#EFE8DC]/95 text-[#685A4E] backdrop-blur-md text-[11px] font-mono border border-[#DDD0BE] px-2.5 py-0.5 rounded-full">
                        Standard Run
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-journal-serif italic text-[#2B2118] group-hover:text-[#A8472A] transition-colors line-clamp-1">
                      {product.title}
                    </h2>
                    <p className="text-[#685A4E] text-xs line-clamp-2 leading-relaxed">
                      {product.description ||
                        'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris.'}
                    </p>
                  </div>

                  {/* Technical Specs Preview */}
                  {product.materials && (
                    <div className="p-2.5 rounded-lg bg-[#F8F5EE] border border-[#DDD0BE] text-[11px] font-mono space-y-1">
                      <div className="text-[#2B2118] truncate">
                        <span className="text-[#685A4E] uppercase mr-1">Materials:</span>
                        {product.materials}
                      </div>
                      {product.weight && (
                        <div className="text-[#685A4E]">
                          <span className="text-[#685A4E] uppercase mr-1">Weight:</span>
                          {product.weight}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price & Action */}
                  <div className="pt-2 border-t border-[#DDD0BE] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#685A4E] block font-mono uppercase">Starting at</span>
                      <span className="text-2xl font-black text-[#A8472A]">
                        ${Number(price).toFixed(2)}
                      </span>
                    </div>

                    <Link href={`/products/${product.slug}`}>
                      <Button
                        variant={isUpcoming ? 'outline' : 'primary'}
                        size="sm"
                        className="font-mono text-xs uppercase font-bold tracking-wider min-h-[44px] px-4 !bg-[#A8472A] hover:!bg-[#8C371D] text-white border-none shadow-xs"
                      >
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
