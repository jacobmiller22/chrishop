import { fetchProducts } from '@/lib/catalog';
import { StorefrontVibeContainer } from '@/components/storefront/StorefrontVibeContainer';
export const revalidate = 60;

export default async function HomePage() {
  const products = await fetchProducts();
  return <StorefrontVibeContainer products={products} />;
}
