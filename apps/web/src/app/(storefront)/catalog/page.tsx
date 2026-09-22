import { redirect } from 'next/navigation';

interface CatalogPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Story 3.1b: Route alias / redirect from /catalog to /products.
 * Preserves all incoming URL query parameters (category, sort, type, etc.).
 */
export default async function CatalogRedirectPage(props: CatalogPageProps) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string') {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, v);
        }
      }
    }
  }

  const queryString = params.toString();
  redirect(`/products${queryString ? `?${queryString}` : ''}`);
}
