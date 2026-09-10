# External Dependency Specifications (`docs/deps/`)

This directory contains comprehensive technical, security, networking, and operational specifications for all external services, SaaS providers, and infrastructure dependencies powering **ChrisShop**.

Each specification defines connection parameters, authentication, security controls, payload schemas, rate limits, and operational health check runbooks aligned with the [High Level Design](../HIGH_LEVEL_DESIGN.md).

---

## Active Dependency Matrix

| Dependency | Specification | Core Role & Architecture | Key Interfaces & Protocols |
| :--- | :--- | :--- | :--- |
| **Cloudflare Platform** | [`DEP_CLOUDFLARE.md`](DEP_CLOUDFLARE.md) | Edge runtime (Workers), WAF, global CDN, DNS, Turnstile anti-bot | `@opennextjs/cloudflare`, Wrangler CLI |
| **Cloudflare D1** | [`DEP_CLOUDFLARE_D1.md`](DEP_CLOUDFLARE_D1.md) | Serverless relational SQLite database for Payload CMS content | `@payloadcms/db-d1-sqlite`, Wrangler D1 |
| **Cloudflare R2** | [`DEP_CLOUDFLARE_R2.md`](DEP_CLOUDFLARE_R2.md) | Zero-egress S3-compatible asset storage for artwork and media | `@aws-sdk/client-s3`, Wrangler R2 |
| **Payload CMS v3** | [`DEP_PAYLOAD_CMS.md`](DEP_PAYLOAD_CMS.md) | Embedded Next.js App Router CMS for editorial content and drops | Payload Local API, TypeScript schemas |
| **Shopify Headless** | [`DEP_SHOPIFY.md`](DEP_SHOPIFY.md) | Headless cart, checkout, payments, inventory, and order fulfillment | `@shopify/storefront-api-client`, GraphQL |
| **Resend Email API** | [`DEP_RESEND.md`](DEP_RESEND.md) | Transactional email delivery for order confirmations and tracking | Resend Node.js SDK, DKIM/SPF |
| **Discord Notifications** | [`DEP_DISCORD.md`](DEP_DISCORD.md) | Real-time ops alerts (`#store-orders`, `#dev-alerts`), rich embeds | Discord Webhooks, REST API |

---

## Archived Specifications (`docs/deps/archive/`)

The following legacy infrastructure specifications have been superseded as part of Story 0.2 (Architecture Migration to Cloudflare-Native & Shopify Headless):

- [`archive/DEP_STRIPE.md`](archive/DEP_STRIPE.md) — Replaced by [`DEP_SHOPIFY.md`](DEP_SHOPIFY.md).
- [`archive/DEP_HETZNER.md`](archive/DEP_HETZNER.md) — Replaced by Cloudflare Workers.
- [`archive/DEP_DIRECTUS.md`](archive/DEP_DIRECTUS.md) — Replaced by [`DEP_PAYLOAD_CMS.md`](DEP_PAYLOAD_CMS.md).
- [`archive/DEP_REDIS.md`](archive/DEP_REDIS.md) — Replaced by Shopify native inventory & Workers KV.
- [`archive/DEP_CADDY.md`](archive/DEP_CADDY.md) — Replaced by Cloudflare native TLS and routing.

---

## Status Taxonomy for Referenced Paths

Across all dependency specifications, referenced file paths are annotated using this explicit status taxonomy:

- **`[EXISTS]`**: File is present in the current monorepo commit and actively functional.
- **`[PLANNED: Story X.Y]`**: File path is canonically designated for implementation in an upcoming scheduled user story.
