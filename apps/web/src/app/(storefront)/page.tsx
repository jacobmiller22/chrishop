import Link from 'next/link';
import { Button, Card, Badge, DropCountdown } from '@chrishop/ui';
import { fetchProducts, fetchProductBySlug, getAssetUrl } from '@/lib/catalog';

export const revalidate = 60;

export default async function HomePage() {
  const products = await fetchProducts();
  const featuredProductSlug = products[0]?.slug;

  // Fetch full details with variations for the flagship silhouette
  const featuredProduct = featuredProductSlug
    ? await fetchProductBySlug(featuredProductSlug)
    : null;

  const flagshipVariation = featuredProduct?.variations?.[0];
  const flagshipPrice = flagshipVariation
    ? flagshipVariation.effective_price
    : (featuredProduct?.base_price ?? 0);

  const flagshipImageUrl = featuredProduct
    ? getAssetUrl(featuredProduct.featured_image || featuredProduct.hero_image)
    : null;

  return (
    <div className="space-y-20">
      {/* Hero Banner with BankBeaters Manifesto */}
      <section className="text-center py-16 space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-center">
          <DropCountdown title="Workshop Drop Countdown" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Badge variant="warning" className="uppercase tracking-wider font-mono text-[11px]">
            ⚡ Small-Batch Drop Live
          </Badge>
          <Badge variant="olive" className="uppercase tracking-wider font-mono text-[11px]">
            Hand-Sewn Workshop Origin
          </Badge>
          <Badge variant="neutral" className="uppercase tracking-wider font-mono text-[11px]">
            Lifetime Repair Guarantee
          </Badge>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-mono tracking-widest text-[#E55B24] uppercase font-bold block">
            BankBeaters Adventure Gear
          </span>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-stone-100 uppercase font-mono">
            Curiosity &gt; Fear.
          </h1>
        </div>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-300 leading-relaxed">
          Patagonia-grade technical outerwear, convertible carry rigs, and field accessories hand-sewn
          by Chris for anglers and bushwhackers who work the bank on foot.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <Link href="/products">
            <Button
              variant="primary"
              size="lg"
              className="font-bold uppercase tracking-wider text-sm shadow-lg shadow-orange-950/40 px-8 py-3.5"
            >
              Explore Gear Roster ({products.length})
            </Button>
          </Link>
          {featuredProduct && (
            <Link href={`/products/${featuredProduct.slug}`}>
              <Button variant="outline" size="lg" className="font-bold uppercase tracking-wider text-sm">
                Inspect The Anorak
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Flagship Product Showcase (The Bushwhack Storm Anorak) */}
      {featuredProduct && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div>
              <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest block font-bold">
                Flagship Silhouette
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-100 uppercase tracking-tight">
                Featured Workshop Build
              </h2>
            </div>
            <Link
              href="/products"
              className="text-sm text-[#E55B24] hover:text-orange-400 transition-colors font-mono font-semibold"
            >
              All Gear Specs →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-[#15191E] p-6 sm:p-10 rounded-2xl border border-stone-800/80 shadow-2xl">
            {/* Visual Preview */}
            <div className="md:col-span-6">
              <Card className="aspect-square flex items-center justify-center bg-[#101317] border-stone-800 overflow-hidden relative p-0 shadow-2xl">
                {flagshipImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={flagshipImageUrl}
                    alt={featuredProduct.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center space-y-3 p-8">
                    <span className="text-7xl">🧥</span>
                    <p className="text-sm font-mono text-[#E55B24] uppercase font-bold tracking-wider">
                      Technical Storm Shell
                    </p>
                    <p className="text-xs text-stone-500 font-mono">
                      {featuredProduct.category?.name || 'Waterproof Outerwear'}
                    </p>
                  </div>
                )}

                <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
                  {featuredProduct.category && (
                    <Badge variant="olive" className="bg-[#2C362B]/90 backdrop-blur-md text-xs">
                      {featuredProduct.category.name}
                    </Badge>
                  )}
                  <Badge variant="warning" className="bg-orange-950/90 backdrop-blur-md text-xs">
                    Micro-Batch Variant Available
                  </Badge>
                </div>
              </Card>
            </div>

            {/* Product Meta & Variation Details */}
            <div className="md:col-span-6 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Standard Run: In Stock (12 Units)</Badge>
                  <Badge variant="warning">Micro-Batch: Only 3 Crafted</Badge>
                </div>

                <h3 className="text-3xl font-black text-stone-100 uppercase tracking-tight">
                  {featuredProduct.title}
                </h3>
                <p className="text-stone-300 leading-relaxed text-sm sm:text-base">
                  {featuredProduct.description}
                </p>
              </div>

              {/* Technical Spec Matrix */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#101317] border border-stone-800/80 text-xs font-mono">
                <div>
                  <span className="text-stone-500 block uppercase">Shell Membrane</span>
                  <span className="text-stone-200 font-semibold">3-Layer Toray 20k/20k</span>
                </div>
                <div>
                  <span className="text-stone-500 block uppercase">Forearm Armor</span>
                  <span className="text-stone-200 font-semibold">500D Cordura® Panels</span>
                </div>
                <div>
                  <span className="text-stone-500 block uppercase">Hardware</span>
                  <span className="text-stone-200 font-semibold">YKK® AquaGuard® Zips</span>
                </div>
                <div>
                  <span className="text-stone-500 block uppercase">Weight</span>
                  <span className="text-stone-200 font-semibold">21.4 oz (606g)</span>
                </div>
              </div>

              {/* Price & Action */}
              <div className="flex items-baseline justify-between p-4 rounded-xl bg-stone-900/50 border border-stone-800">
                <div>
                  <span className="text-xs text-stone-500 font-mono block uppercase">Base Silhouette</span>
                  <span className="text-3xl font-black text-[#E55B24]">
                    ${Number(flagshipPrice).toFixed(2)}
                  </span>
                </div>
                <span className="text-xs text-stone-400 font-mono">
                  Micro-batch deadstock edition: $385.00
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={`/products/${featuredProduct.slug}`} className="flex-1">
                  <Button variant="primary" size="lg" className="w-full font-bold uppercase tracking-wider text-sm">
                    Select Silhouettes & Micro-Batches →
                  </Button>
                </Link>
                <Link href="/products">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto font-mono text-xs">
                    Browse All Gear
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Active Drops & Live Catalog Grid */}
      {products.length > 1 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div>
              <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest block font-bold">
                Small-Batch Roster
              </span>
              <h2 className="text-2xl font-black text-stone-100 uppercase tracking-tight">
                Active Bank Equipment
              </h2>
            </div>
            <Link href="/products" className="text-sm text-[#E55B24] hover:text-orange-400 font-mono font-semibold">
              View All {products.length} Gear Silhouettes →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.slice(1, 4).map((item) => {
              const itemImg = getAssetUrl(item.featured_image || item.hero_image);
              return (
                <Card
                  key={item.id}
                  className="group flex flex-col justify-between overflow-hidden p-0 border-stone-800 hover:border-[#E55B24]/60 transition-all duration-300 shadow-lg"
                >
                  <div className="relative aspect-video bg-[#101317] flex items-center justify-center border-b border-stone-800">
                    {itemImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={itemImg} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🎒</span>
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
                      <p className="text-xs text-stone-400 line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-stone-800/80">
                      <div>
                        <span className="text-[10px] text-stone-500 font-mono block uppercase">Base Retail</span>
                        <span className="text-lg font-black text-[#E55B24]">
                          ${Number(item.effective_min_price ?? item.base_price).toFixed(2)}
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
        </section>
      )}

      {/* The Maker's Bench Section */}
      <section
        id="makers-bench"
        className="rounded-2xl border border-stone-800/80 bg-[#101317] p-8 sm:p-12 space-y-8"
      >
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-mono text-[#E55B24] uppercase tracking-widest font-bold block">
            Craftsmanship & Provenance
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-stone-100 uppercase tracking-tight">
            The Maker&apos;s Bench
          </h2>
          <p className="text-stone-300 leading-relaxed text-sm sm:text-base">
            In angling and bushwhacking culture, a <strong>Bank Beater</strong> is someone who explores
            shorelines, cut-banks, tidal marshes, and remote canyon pools on foot. There is no outboard motor
            or cushioned casting deck—just miles through brambles, muddy riprap, and torrential squalls.
          </p>
          <p className="text-stone-400 leading-relaxed text-sm">
            Chris sews gear by hand using bombproof 500D/1000D Cordura®, X-Pac® VX21 sailcloth, and
            bonded nylon thread. Whenever deadstock fabrics or salvaged military-spec textiles cross the
            cutting bench, we craft 2–3 piece <strong>micro-batches</strong> alongside standard production runs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-stone-800/80">
          <div className="space-y-2 p-4 rounded-xl bg-[#15191E] border border-stone-800/60">
            <span className="text-2xl">🛡️</span>
            <h4 className="font-bold text-stone-200 text-sm font-mono uppercase">Bombproof Construction</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Bar-tacked stress points, waterproof AquaGuard® zips, and reinforced high-wear zones engineered to outlast the harshest brambles.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-[#15191E] border border-stone-800/60">
            <span className="text-2xl">🧵</span>
            <h4 className="font-bold text-stone-200 text-sm font-mono uppercase">Micro-Batch Agility</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Limited runs of 2–4 unique pieces using salvaged deadstock camouflage, custom pocketing, and hand-stamped serialized tags.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-[#15191E] border border-stone-800/60">
            <span className="text-2xl">♻️</span>
            <h4 className="font-bold text-stone-200 text-sm font-mono uppercase">Lifetime Repair Guarantee</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Gear is built to be used, not displayed. If you shred an elbow crawling through briars, send it back to the workshop for field repair.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
