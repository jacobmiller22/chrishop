import { fetchProducts } from '@/lib/catalog';
import { StorefrontVibeContainer } from '@/components/storefront/StorefrontVibeContainer';
import type { StorefrontVibe } from '@/components/storefront/VibeSwitcherBar';

export const revalidate = 60;

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage(props: PageProps) {
  const products = await fetchProducts();
  const searchParams = props.searchParams ? await props.searchParams : {};
  const vibeParam =
    typeof searchParams?.vibe === 'string' &&
    ['field_workshop', 'alpine_minimal', 'hardware_vault'].includes(searchParams.vibe)
      ? (searchParams.vibe as StorefrontVibe)
      : 'field_workshop';

  return <StorefrontVibeContainer products={products} initialVibe={vibeParam} />;
}
