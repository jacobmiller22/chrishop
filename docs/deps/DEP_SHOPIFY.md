# Dependency Specification: Shopify Headless Commerce (`DEP_SHOPIFY.md`)

This document specifies the headless commerce architecture, Storefront API client integration, Admin API catalog synchronization, Shopify Payments checkout workflow, webhook ingestion, and development environment for **Shopify**.

---

## 1. Architectural Decision Record: Shopify Headless (Replacing Stripe Checkout)

### Why We Are Replacing Stripe with Shopify Headless

This rationale is preserved verbatim from Issue #88 as the official architectural decision record.

#### The Problem with the Custom Stripe Implementation

The Stripe Checkout approach required us to own and maintain the entire commerce transaction layer:

- Custom `/api/checkout` route (Stripe session creation, price validation, stock checks)
- Custom `/api/webhooks/stripe` route (cryptographic signature verification, idempotency table, atomic stock decrement, oversell refund logic)
- `processed_stripe_events` idempotency collection to prevent double-processing
- Atomic inventory management logic (`UPDATE ... WHERE stock_quantity >= qty`)
- Oversell edge case handling (automatic refund + email)
- PCI compliance surface area in our own codebase
- Shipping rate management wired into Stripe Checkout options
- Tax calculation configuration

Every one of these is solved infrastructure that Shopify provides as a managed platform.

#### Why Shopify Headless

Shopify via the Storefront API separates the _presentation layer_ (our Next.js/Cloudflare app) from the _commerce layer_ (Shopify's managed checkout, payments, inventory, and orders). Benefits:

- **PCI compliance fully offloaded** — all payment data flows through Shopify's certified infrastructure; our codebase never touches card data
- **Inventory management** — Shopify tracks stock quantities, handles sold-out states, and prevents overselling natively
- **Checkout** — Shopify Checkout is a battle-tested, high-converting checkout experience. We don't build or maintain it
- **Orders, fulfillment, customer data** — Shopify Admin becomes Chris's order management dashboard, eliminating the need for Payload to manage order records
- **Tax and shipping** — configured once in Shopify Admin, not in code
- **Shopify Payments** — zero transaction fee when using Shopify Payments (vs. Stripe's per-transaction fee)
- **Storefront API is available on Shopify Basic ($29/mo)** — accessible pricing for a boutique shop

#### Why We Still Need Payload CMS Alongside Shopify

Shopify's native product model is designed for standard commerce (variants by size/color/material). It does not support the product complexity required for Chris's limited-edition art drops:

- Artist statements and editorial copy per product
- Limited edition metadata (edition number, total run, certificate of authenticity details)
- Drop mechanics (release date, countdown timer, `coming_soon` → `active` status transitions)
- Rich gallery with multiple high-resolution images stored in Cloudflare R2
- Category and editorial structure not expressible in Shopify's taxonomy

**Shopify owns the commerce layer. Payload owns the content layer.**

#### The Data Split

| Data Domain                   | Owner                       | Why                                            |
| :---------------------------- | :-------------------------- | :--------------------------------------------- |
| Price / SKU                   | Shopify                     | Source of truth for checkout                   |
| Stock quantity                | Shopify                     | Native inventory management                    |
| Cart & Checkout               | Shopify                     | Managed, PCI-compliant                         |
| Orders / Customers            | Shopify                     | Shopify Admin = Chris's fulfillment dashboard  |
| Tax / Shipping                | Shopify                     | Configured in Admin, not in code               |
| Product title                 | Payload (synced to Shopify) | Payload is source of truth; synced via webhook |
| Rich description / editorial  | Payload                     | Not expressible in Shopify                     |
| Gallery images (R2)           | Payload                     | Native Shopify CDN not required                |
| Edition metadata              | Payload                     | Custom fields not in Shopify model             |
| Release date / drop countdown | Payload                     | Custom drop mechanics                          |
| Categories / collections      | Payload                     | Editorial structure                            |

#### The Integration Bridge

Each Payload product record stores a `shopify_product_id` field. When a product is published in Payload (status → `active`), a Payload hook calls the Shopify Admin API to create or update the corresponding Shopify product/variant with correct title, price, SKU, and inventory. The storefront fetches rich content from Payload and pricing/availability from the Shopify Storefront API, merging at render time.

#### What This Eliminates

- `apps/web/src/app/api/checkout/route.ts` (replaced by Shopify Storefront API cart mutations)
- `apps/web/src/app/api/webhooks/stripe/route.ts` (replaced by Shopify order webhooks for Discord notifications)
- `processed_stripe_events` Payload collection (Shopify handles idempotency)
- All atomic stock decrement logic (Shopify handles inventory)
- `DEP_STRIPE.md` → replaced by `DEP_SHOPIFY.md`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env vars

---

## 2. Storefront API Client Integration

The storefront communicates with Shopify via the lightweight official client `@shopify/storefront-api-client`:

```typescript
import { createStorefrontApiClient } from '@shopify/storefront-api-client';

export const shopifyClient = createStorefrontApiClient({
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN!,
  apiVersion: '2025-01',
  publicAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
});
```

### Core GraphQL Mutations

#### 1. Create Cart with Line Items (`cartCreate`)

```graphql
mutation CartCreate($lines: [CartLineInput!]) {
  cartCreate(input: { lines: $lines }) {
    cart {
      id
      checkoutUrl
      lines(first: 10) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### 2. Append Line Items (`cartLinesAdd`)

```graphql
mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart {
      id
      checkoutUrl
      totalQuantity
    }
  }
}
```

---

## 3. Shopify Admin API & Synchronization Hook

When an artwork drop is published or updated in Payload CMS, an `afterChange` collection hook triggers a synchronization GraphQL call to the Shopify Admin API:

```typescript
// apps/web/src/collections/products/hooks/syncToShopify.ts
export const syncProductToShopify = async ({ doc, operation }) => {
  if (doc.status !== 'active') return doc;

  if (!doc.shopify_product_id) {
    // Call productCreate GraphQL mutation
    const res = await shopifyAdminClient.request(CREATE_PRODUCT_MUTATION, {
      input: {
        title: doc.title,
        status: 'ACTIVE',
        variants: doc.variations?.map((v) => ({
          price: v.price_override || doc.base_price,
          sku: v.sku,
          inventoryQuantities: [{ availableQuantity: v.stock_quantity, locationId }],
        })),
      },
    });
    doc.shopify_product_id = res.data.productCreate.product.id;
  } else {
    // Call productUpdate mutation
    await shopifyAdminClient.request(UPDATE_PRODUCT_MUTATION, {
      input: {
        id: doc.shopify_product_id,
        title: doc.title,
      },
    });
  }
  return doc;
};
```

---

## 4. Webhook Ingestion & HMAC Verification

Shopify emits HTTP POST webhooks for lifecycle events:

- `orders/create`: Triggers Discord order announcement in `#store-orders`.
- `orders/fulfilled`: Triggers dispatch of customer tracking notification.

### Signature Verification

```typescript
import crypto from 'node:crypto';

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf-8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}
```

---

## 5. Development & Testing Workflow

1. **Shopify CLI**: Install and authenticate via `shopify auth login`.
2. **Local Dev Store**: Connect to a free Shopify Partner development store (`chrishop-dev.myshopify.com`).
3. **Trigger Test Webhooks**:
   ```bash
   shopify app webhook trigger --topic orders/create --address http://localhost:3000/api/webhooks/shopify
   ```
