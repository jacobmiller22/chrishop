import { Button, Card, Badge } from '@chrishop/ui';
import type { Product, ProductVariation } from '@chrishop/types';

const mockProduct: Product = {
  id: 'prod-001',
  title: 'Midnight Gold Sculpture',
  slug: 'midnight-gold-sculpture',
  description: 'Hand-cast obsidian resin with 24k gold leaf accents. Limited physical edition.',
  base_price: 250,
  status: 'published',
};

const mockVariation: ProductVariation = {
  id: 'var-001',
  product_id: 'prod-001',
  variation_name: 'Edition #1-25',
  sku: 'MNG-001',
  price_override: 250,
  is_limited_edition: true,
  total_edition_count: 25,
  stock_quantity: 5,
  status: 'active',
};

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Banner */}
      <section className="text-center py-12 space-y-4">
        <Badge variant="warning">🔥 Next Drop Live Now</Badge>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
          Exclusive Art & Physical Collectibles
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-slate-400">
          Limited edition sculptures and prints released in timed drops. Direct from creator to collector.
        </p>
      </section>

      {/* Featured Showcase */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <Card className="aspect-square flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 border-amber-900/30">
          <div className="text-center space-y-3">
            <span className="text-6xl">✨</span>
            <p className="text-sm font-mono text-amber-400/80">Interactive 3D Preview Ready</p>
          </div>
        </Card>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge variant="success">In Stock ({mockVariation.stock_quantity} remaining)</Badge>
            <Badge variant="info">Limited Edition of {mockVariation.total_edition_count}</Badge>
          </div>

          <h2 className="text-3xl font-bold text-slate-100">{mockProduct.title}</h2>
          <p className="text-slate-400 leading-relaxed">{mockProduct.description}</p>

          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-extrabold text-amber-400">
              ${mockVariation.price_override || mockProduct.base_price}
            </span>
            <span className="text-xs text-slate-500 font-mono">SKU: {mockVariation.sku}</span>
          </div>

          <div className="flex gap-4">
            <Button variant="primary" size="lg" className="flex-1">
              Reserve & Checkout
            </Button>
            <Button variant="outline" size="lg">
              View Gallery
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
