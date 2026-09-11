# Shopify Headless Operational Setup Guide (`docs/SHOPIFY_SETUP.md`)

This runbook guides developers and operators through setting up the Shopify store, provisioning Storefront and Admin API credentials, configuring the Headless sales channel, and establishing webhook subscriptions for **ChrisShop**.

---

## 1. Shopify Store Creation & Plan Selection

1. Sign up for **Shopify Basic** ($29/mo) or create a free **Shopify Partner Development Store** for testing.
2. Select your store currency (USD) and configure store shipping origin address in **Settings → Locations**.

---

## 2. Headless Sales Channel & Storefront API Credentials

1. In Shopify Admin, navigate to **Settings → Apps and sales channels**.
2. Click **Develop apps** (or install the official **Headless** sales channel).
3. Create a custom app named `ChrisShop Storefront`.
4. Configure **Storefront API access scopes**:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_checkouts`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_write_customers`
5. Install the app and copy the generated **Storefront API public access token**.
6. Store this token as `SHOPIFY_STOREFRONT_TOKEN` in your environment configuration.

---

## 3. Admin API Credentials for Payload CMS Sync

To allow Payload CMS to push published products to Shopify:

1. In the same custom app (or create a private app named `ChrisShop CMS Sync`), configure **Admin API access scopes**:
   - `write_products`, `read_products`
   - `write_inventory`, `read_inventory`
2. Install the app and copy the **Admin API access token** (begins with `shpat_`).
3. Store this secret securely in Cloudflare Secrets:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN
   ```

---

## 4. Webhook Subscriptions Configuration

Configure webhook notifications for order processing and Discord announcements:

1. Navigate to **Settings → Notifications → Webhooks** (or configure via Admin API).
2. Create Webhook:
   - **Event**: `Order creation`
   - **Format**: `JSON`
   - **URL**: `https://chrishop.jacobmiller22.com/api/webhooks/shopify`
   - **Webhook API Version**: Latest stable (`2025-01`)
3. Copy the **Webhook signing secret** from the bottom of the Webhooks page.
4. Store as `SHOPIFY_WEBHOOK_SECRET`:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET
   ```

---

## 5. Shopify Payments & Checkout Configuration

1. In Shopify Admin, navigate to **Settings → Payments**.
2. Activate **Shopify Payments** (zero transaction fees; supports credit cards, Apple Pay, Google Pay, Shop Pay).
3. In **Settings → Checkout**:
   - Require customer email.
   - Enforce address autocomplete.
   - Set up abandoned checkout reminder emails.
4. In **Settings → Shipping and delivery**:
   - Set up flat-rate shipping rules for domestic and international orders.
   - Configure free shipping thresholds if applicable.
