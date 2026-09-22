# Shopify Headless Operational Setup & Verification Guide (`docs/SHOPIFY_SETUP.md`)

This runbook guides developers and operators through provisioning the Shopify store, configuring the Headless sales channel, generating Storefront and Admin API credentials, configuring Shopify Payments test mode, setting up webhook subscriptions, and executing turnkey setup verification for **ChrisShop**.

---

## 1. Shopify Store Creation & General Settings

1. **Account Setup**:
   - Create a free **Shopify Partner Development Store** (recommended for staging/dev) or initialize a standard **Shopify Basic** store ($29/mo).
   - Recommended store domain convention: `chrishop-dev.myshopify.com` (development) and `chrishop.myshopify.com` (production).
2. **Currency & Store Details**:
   - In Shopify Admin, navigate to **Settings → Store details**.
   - Set **Store currency** to **USD ($)**.
   - Configure store legal name: `ChrisShop LLC / Leadville Workshop`.
3. **Location & Shipping Origin**:
   - Navigate to **Settings → Locations**.
   - Configure fulfillment location: `100 Mountain View Way, Leadville, CO 80461, USA`.

---

## 2. Headless Sales Channel & Storefront API Credentials

The Storefront API powers product queries, cart creation, line item mutations, and edge checkout redirection.

1. In Shopify Admin, navigate to **Settings → Apps and sales channels**.
2. Click **Develop apps** (or install the official **Headless** sales channel).
3. Create a custom app named `ChrisShop Headless Storefront`.
4. Navigate to **Configuration → Storefront API integration** and enable the following **Storefront API access scopes**:
   - `unauthenticated_read_product_listings` — catalog queries and collection listings
   - `unauthenticated_read_product_inventory` — live stock status checks and out-of-stock badges
   - `unauthenticated_read_checkouts` — retrieve checkout state
   - `unauthenticated_write_checkouts` — cart creation and line item modifications
   - `unauthenticated_write_customers` — buyer identity (email, address) binding
5. Click **Save** and **Install app**.
6. Copy the generated **Storefront API public access token** (`SHOPIFY_STOREFRONT_TOKEN`).
7. Add to your local `.env` and Cloudflare environment:
   ```bash
   # Local .env
   SHOPIFY_STORE_DOMAIN="chrishop-dev.myshopify.com"
   SHOPIFY_STOREFRONT_TOKEN="<your-public-storefront-token>"
   NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN="chrishop-dev.myshopify.com"
   NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN="<your-public-storefront-token>"
   ```

---

## 3. Admin API Private App for Payload CMS Sync

To allow Payload CMS to push editorial product metadata to Shopify while strictly enforcing the **Zero Inventory Overwrites** architectural invariant:

1. In the same app (or create a dedicated private app named `ChrisShop CMS Sync`), configure **Admin API access scopes**:
   - `write_products`, `read_products` — push titles, descriptions, categories, and tags
   - `write_inventory`, `read_inventory` — required by Shopify Admin GraphQL for variant association
2. Install the app and copy the **Admin API access token** (starts with `shpat_`).
3. Store this secret securely in Cloudflare Workers Secrets:
   ```bash
   # Development / Staging
   pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env staging

   # Production
   pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env production
   ```

> [!CAUTION]
> **Adversarial Audit Invariant (Zero Inventory Overwrites)**:
> Under NO circumstances does the Payload CMS integration sync or mutate Shopify inventory levels or variant stock quantities. Shopify is the sole authoritative source of truth for stock management. All editorial sync payloads are strictly validated by `assertNoInventoryFields()`.

---

## 4. Shopify Payments & Test Mode Configuration

1. In Shopify Admin, navigate to **Settings → Payments**.
2. Activate **Shopify Payments** (zero transaction fees; native Apple Pay, Google Pay, Shop Pay, and major credit cards).
3. **Test Mode Configuration**:
   - For development and staging stores, scroll to **Shopify Payments** and check **Enable test mode** (or select **(for testing) Bogus Gateway** if Shopify Payments is not yet active).
   - Click **Save**.
4. **Test Card Credentials**:
   - Card Number: `1` (or `2` for failed authorization, `3` for processing error)
   - Expiration Date: Any date in the future (e.g., `12/28`)
   - Cardholder Name: Any name (e.g., `Chris Leadville`)
   - CVV / Security Code: Any 3 digits (e.g., `111`)
5. In **Settings → Checkout**:
   - Require customer email.
   - Enforce address autocomplete.
   - Configure abandoned checkout recovery reminders (10 hours).
6. In **Settings → Shipping and delivery**:
   - Set flat-rate shipping rules for domestic US and international orders.
   - Configure free shipping thresholds if applicable.

---

## 5. Webhook Subscriptions & Cryptographic Verification

Shopify emits webhooks for order lifecycle events (`orders/create`, `orders/paid`, `orders/fulfilled`).

1. Navigate to **Settings → Notifications → Webhooks** (or configure via Admin API).
2. Create Webhook:
   - **Event**: `Order creation` (`orders/create`)
   - **Format**: `JSON`
   - **URL**: `https://chrishop.jacobmiller22.com/api/webhooks/shopify` (production) or `https://staging-chrishop.jacobmiller22.com/api/webhooks/shopify` (staging)
   - **Webhook API Version**: Latest stable (`2025-01`)
3. Create additional webhooks for `Order transaction` (`orders/paid`) and `Fulfillment creation` (`orders/fulfilled`).
4. Copy the **Webhook signing secret** at the bottom of the Webhooks page.
5. Store as `SHOPIFY_WEBHOOK_SECRET` in Cloudflare Secrets and `.env`:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env staging
   pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env production
   ```

---

## 6. Testing Webhook Delivery via Shopify CLI & Local Proxy

During local development, test webhooks can be triggered directly using the Shopify CLI or through the built-in synthetic test harness.

### 6.1 Using Shopify CLI Webhook Forwarding

1. Authenticate with your development store:
   ```bash
   shopify auth login
   ```
2. Trigger test webhooks to your local dev proxy:
   ```bash
   # Trigger order creation webhook to local Next.js dev server
   shopify app webhook trigger \
     --topic orders/create \
     --address http://localhost:3000/api/webhooks/shopify

   # Trigger order paid webhook
   shopify app webhook trigger \
     --topic orders/paid \
     --address http://localhost:3000/api/webhooks/shopify
   ```
3. The local endpoint will:
   - Verify the HMAC-SHA256 signature using `crypto.subtle`.
   - Check the idempotency gate (`order_webhook:<id>` with 24-hour TTL).
   - Dispatch customer receipts via Resend (or log dev fallback).
   - Send order alerts to Discord `#store-orders`.
   - Return HTTP 200 OK within 500ms.

---

## 7. Turnkey Verification CLI (`pnpm run verify:shopify`)

ChrisShop provides an automated turnkey verification tool `scripts/verify-shopify.ts` that validates all 5 stages of Shopify setup:

```bash
# Run verification with in-process mock engine (default for CI/offline)
pnpm run verify:shopify --mock

# Run dry-run syntax and argument verification
pnpm run verify:shopify --dry-run

# Run against live Shopify development store
pnpm run verify:shopify \
  --target live \
  --store chrishop-dev.myshopify.com \
  --storefront-token "<token>" \
  --admin-token "<shpat_token>"

# Run webhook test against a local running server
pnpm run verify:shopify --webhook-url http://localhost:3000/api/webhooks/shopify

# Output JSON report for CI pipelines
pnpm run verify:shopify --json
```

### Verification Matrix

| Stage | Verification Objective | Success Criteria |
| :--- | :--- | :--- |
| **Stage 1** | Storefront API Credentials & Scopes | Shop metadata reachable, USD currency, public token scopes verified |
| **Stage 2** | Headless Cart & Checkout URL | `cartCreate`, `cartLinesAdd`, buyer IP forwarding, valid `/checkouts/c/` URL |
| **Stage 3** | Admin API Credentials & Scopes | Admin API shop query, required scopes, Zero Inventory Overwrite invariant |
| **Stage 4** | Shopify Payments & Test Mode | Default USD currency, Bogus Gateway / test card mode configured |
| **Stage 5** | Webhook Delivery & Local Proxy | Web Crypto HMAC-SHA256 valid, HTTP 200 OK, idempotency deduplication active |

---

## 8. Story 2.20 Acceptance Criteria Checklist

- [x] **Storefront API and Admin API credentials verified and active**: Verified through `verifyStorefrontApi` and `verifyAdminApi` in `scripts/verify-shopify.ts` and automated test suite.
- [x] **Headless sales channel configured**: Verified cart creation, line additions, buyer IP forwarding, and checkout redirection URL format.
- [x] **Test webhooks deliver to local development proxy**: Tested via in-process NextRequest delivery, Shopify CLI trigger documentation, and automated idempotency deduplication.
