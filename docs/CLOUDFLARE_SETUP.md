# Cloudflare Operational Setup Guide (`docs/CLOUDFLARE_SETUP.md`)

This runbook guides operators through provisioning and configuring the complete Cloudflare platform suite (Workers, D1, KV, R2, Secrets, and Custom Domains) for **ChrisShop**.

---

## 1. Prerequisites

- Cloudflare account with a Workers Paid subscription ($5/mo).
- Cloudflare API Token with permissions for Workers, D1, KV, R2, and DNS.
- Installed Wrangler CLI (`pnpm exec wrangler`).

Authenticate locally:

```bash
pnpm exec wrangler login
```

---

## 2. D1 Database Provisioning

Provision isolated D1 relational databases for staging and production:

```bash
# Create Staging D1 Database
pnpm exec wrangler d1 create chrishop-staging-db

# Create Production D1 Database
pnpm exec wrangler d1 create chrishop-prod-db
```

Copy the output `database_id` values into `wrangler.toml` under `[[d1_databases]]` and `[[env.staging.d1_databases]]`.

---

## 3. Workers KV Namespace Creation

Provision KV namespaces for ISR edge caching:

```bash
# Create Staging KV Namespace
pnpm exec wrangler kv:namespace create NEXT_CACHE_WORKERS_KV --env staging

# Create Production KV Namespace
pnpm exec wrangler kv:namespace create NEXT_CACHE_WORKERS_KV
```

Copy the resulting `id` strings into the corresponding sections of `wrangler.toml`.

---

## 4. Cloudflare R2 Bucket Creation

Provision R2 buckets for product galleries and limited edition artwork:

```bash
# Create Staging Bucket
pnpm exec wrangler r2 bucket create chrishop-media-staging

# Create Production Bucket
pnpm exec wrangler r2 bucket create chrishop-media-prod
```

Apply CORS configuration to permit image requests from the storefront:

```bash
pnpm exec wrangler r2 bucket cors set chrishop-media-prod --file infra/r2/cors-media.json
```

---

## 5. Secret Management

Populate encrypted edge secrets using `wrangler secret put`:

```bash
# Staging Secrets
pnpm exec wrangler secret put PAYLOAD_SECRET --env staging
pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env staging
pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env staging
pnpm exec wrangler secret put RESEND_API_KEY --env staging

# Production Secrets
pnpm exec wrangler secret put PAYLOAD_SECRET
pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN
pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET
pnpm exec wrangler secret put RESEND_API_KEY
```

---

## 6. Custom Domain & DNS Mapping

Attach the Workers project to Chris's custom domains in Cloudflare Dashboard (or via `wrangler.toml` routes):

- Production: `chrishop.com` and `www.chrishop.com`
- Staging: `staging.chrishop.com`

---

## 7. Deployment & Verification

Deploy and test health endpoints:

```bash
# Deploy to Staging
pnpm exec wrangler deploy --env staging

# Deploy to Production
pnpm exec wrangler deploy --env production

# Verify Health
curl -s -f https://chrishop.com/api/health | jq .
```
