import { fetchProducts } from '@/lib/catalog';
import { StorefrontVibeContainer } from '@/components/storefront/StorefrontVibeContainer';
import type { StorefrontVibe } from '@/components/storefront/VibeSwitcherBar';

const VALID_VIBES: Set<string> = new Set([
  'field_workshop',
  'alpine_minimal',
  'hardware_vault',
  'noir_minimal',
  'cartographer_dispatch',
  'brutalist_foundry',
  'wabi_sabi',
  'swiss_modernist',
  'seventies_retro',
]);

export const revalidate = 60;

export default async function HomePage(props: {
  searchParams?: Promise<{ vibe?: string; [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialVibe =
    searchParams?.vibe && VALID_VIBES.has(searchParams.vibe)
      ? (searchParams.vibe as StorefrontVibe)
      : undefined;

  const products = await fetchProducts();
  return <StorefrontVibeContainer products={products} initialVibe={initialVibe} />;
}
