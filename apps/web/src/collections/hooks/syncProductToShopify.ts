import type { CollectionAfterChangeHook } from 'payload';
import {
  shopifyAdmin,
  type ShopifyAdminProductInput,
} from '../../lib/shopify-admin';

/**
 * Serializes richText Lexical or string description to clean plain text / HTML.
 */
function serializeDescription(description: any): string {
  if (!description) return '';
  if (typeof description === 'string') return description;

  try {
    const extractText = (node: any): string => {
      if (!node) return '';
      if (typeof node.text === 'string') return node.text;
      if (Array.isArray(node.children)) {
        return node.children.map(extractText).filter(Boolean).join(' ');
      }
      return '';
    };

    if (description.root) {
      const text = extractText(description.root).trim();
      return text ? `<p>${text}</p>` : '';
    }
  } catch {
    // Graceful fallback
  }

  return '';
}

/**
 * Maps Payload CMS product document status to Shopify Admin API ProductStatus enum.
 */
function mapStatusToShopify(status?: string): 'ACTIVE' | 'DRAFT' | 'ARCHIVED' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'archived':
      return 'ARCHIVED';
    case 'draft':
    case 'scheduled':
    default:
      return 'DRAFT';
  }
}

/**
 * Payload CMS afterChange Hook for Products Collection (Story 2.22)
 *
 * Synchronizes editorial metadata (title, description, tags, status, handle)
 * to Shopify Admin API.
 *
 * INVARIANT: Variant stock quantities and inventory levels are NEVER mutated.
 * Errors are caught and logged operationally to ensure Payload CMS saves
 * remain resilient during Shopify network partitions.
 */
export const syncProductToShopify: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  // Prevent recursion if this hook triggered the D1 shopify_product_id write
  if (req?.context?.skipShopifySync) {
    return doc;
  }

  if (!doc || !doc.title) {
    return doc;
  }

  // 1. Prepare Editorial Payload (Strictly Zero Inventory Fields)
  const descriptionHtml =
    serializeDescription(doc.description) ||
    (doc.maker_field_notes ? `<p>${doc.maker_field_notes}</p>` : '') ||
    (doc.artist_statement ? `<p>${doc.artist_statement}</p>` : '');

  const tags: string[] = ['bankbeaters'];
  if (doc.category) tags.push(`category:${doc.category}`);
  if (doc.materials) tags.push(`material:${doc.materials}`);
  if (doc.origin) tags.push(`origin:${doc.origin}`);

  const status = mapStatusToShopify(doc.status);
  const handle = doc.slug || doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const input: ShopifyAdminProductInput = {
    title: doc.title,
    descriptionHtml: descriptionHtml || undefined,
    tags,
    status,
    handle,
  };

  // 2. Provision New Product or Update Existing Editorial Metadata
  try {
    if (!doc.shopify_product_id) {
      // Provision in Shopify Admin API
      const result = await shopifyAdmin.createProduct(input);

      if (result.success && result.product?.id) {
        doc.shopify_product_id = result.product.id;

        // Persist returned Shopify GID back to D1 database
        if (req?.payload?.update && doc.id) {
          try {
            await req.payload.update({
              collection: 'products',
              id: doc.id,
              data: {
                shopify_product_id: result.product.id,
              },
              context: {
                skipShopifySync: true,
              },
            });
          } catch (dbErr) {
            console.warn(
              `[syncProductToShopify:D1PersistenceWarning] Failed to persist shopify_product_id for product ${doc.id}:`,
              dbErr
            );
          }
        }
      } else {
        console.warn(
          `[syncProductToShopify:CreateProductFailed] Shopify product provisioning failed for ${doc.id}: ${result.error}`
        );
      }
    } else {
      // Update existing Shopify product editorial metadata
      input.id = doc.shopify_product_id;
      const result = await shopifyAdmin.updateProduct(input);

      if (!result.success) {
        console.warn(
          `[syncProductToShopify:UpdateProductFailed] Shopify product update failed for ${doc.shopify_product_id}: ${result.error}`
        );
      }
    }
  } catch (err) {
    // Resilient fallback: log error without breaking Payload CMS UI save
    console.error(
      `[syncProductToShopify:UnhandledException] Error syncing product ${doc.id} to Shopify Admin API:`,
      err
    );
  }

  return doc;
};
