import Link from 'next/link';
import { Card, Badge, Button } from '@chrishop/ui';
import { fetchProducts, fetchCategories, getAssetUrl } from '@/lib/catalog';

export const dynamic = 'force-static';
export const revalidate = 10;

interface ProductsPageProps {
  searchParams?: Promise<{
    category?: string;
  }>;
}

const CATEGORY_ICONS: Record<string, string> = {
  apparel: '🧥',
  'packs-carry': '🎒',
  'field-accessories': '🧰',
  outerwear: '🌧️',
  'waterproof-storm-shells': '⚡',
  pants: '👖',
  'technical-brush-pants': '🪨',
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

  const [products, categories] = await Promise.all([
    fetchProducts({ categorySlug: activeCategory }),
    fetchCategories(),
  ]);

  // Find active category object if selected
  const activeCategoryObj = categories.find((c) => c.slug === activeCategory || c.id === activeCategory);

  // Separate top-level categories (depth 0) and subcategories
  const topCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="border-b border-stone-800/80 pb-8 space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
          <Link href="/" className="hover:text-[#E55B24] transition-colors">
            Home
          </Link>
          <span>/</span>
          {activeCategoryObj ? (
            <Link href="/products" className="hover:text-[#E55B24] transition-colors">
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
        </div>

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

        {/* Depth-2 Category Filter Pills */}
        <div className="space-y-2 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/products"
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono uppercase font-semibold transition-all ${
                !activeCategory
                  ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                  : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-[#E55B24]/50 hover:text-orange-400'
              }`}
            >
              All Gear ({products.length})
            </Link>

            {topCategories.map((cat) => {
              const isSelected = activeCategory === cat.slug;
              const icon = CATEGORY_ICONS[cat.slug] || '🎒';
              return (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono uppercase font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                      : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-[#E55B24]/50 hover:text-orange-400'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{cat.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Subcategory Pills (Level 1 & 2) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-stone-500 uppercase mr-1">Sub-Categories:</span>
            {categories
              .filter((c) => Boolean(c.parent_id))
              .map((cat) => {
                const isSelected = activeCategory === cat.slug;
                return (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className={`px-3 py-1 rounded-full text-[11px] font-mono transition-all ${
                      isSelected
                        ? 'bg-[#2C362B] text-emerald-300 border border-emerald-700 font-bold'
                        : 'bg-stone-900/60 text-stone-400 border border-stone-800/80 hover:text-stone-200 hover:border-stone-700'
                    }`}
                  >
                    {cat.name}
                  </Link>
                );
              })}
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-[#15191E] border border-stone-800 rounded-2xl p-8 space-y-4">
          <span className="text-5xl">🎒</span>
          <h2 className="text-xl font-bold text-stone-200 font-mono uppercase">No Gear In This Category</h2>
          <p className="text-stone-400 text-sm max-w-md mx-auto">
            {activeCategory
              ? `No published equipment found under category "${activeCategory}". View all categories to see available small batches.`
              : 'The equipment catalog is being prepared on the workbench. Check back shortly for active drops!'}
          </p>
          {activeCategory && (
            <Link href="/products">
              <Button variant="outline" size="sm" className="mt-2 font-mono text-xs">
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
              (product.category?.slug && CATEGORY_ICONS[product.category.slug]) || '🎒';
            const price = product.effective_min_price ?? product.base_price;
            const hasMicroBatch = product.variations?.some(
              (v) => v.variation_type === 'micro_batch' || v.variation_type === 'one_of_one'
            );

            return (
              <Card
                key={product.id}
                className="group flex flex-col justify-between overflow-hidden p-0 border-stone-800 hover:border-[#E55B24]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-950/20"
              >
                {/* Visual Header / Image Container */}
                <div className="relative aspect-square w-full bg-[#101317] overflow-hidden flex items-center justify-center border-b border-stone-800/80">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={product.title}
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
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    {product.category?.name && (
                      <Badge variant="olive" className="bg-[#2C362B]/95 backdrop-blur-md text-[11px] font-mono">
                        {product.category.name}
                      </Badge>
                    )}
                    {hasMicroBatch ? (
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
                      <Button variant="primary" size="sm" className="font-mono text-xs uppercase font-bold tracking-wider">
                        Inspect Gear →
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
