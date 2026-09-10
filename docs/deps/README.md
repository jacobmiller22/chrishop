# External Dependency Specifications (`docs/deps/`)

This directory contains comprehensive technical, security, networking, and operational specifications for all external services, SaaS providers, and infrastructure dependencies powering **ChrisShop**.

Each specification defines connection parameters, authentication, security controls, payload schemas, rate limits, and operational health check runbooks aligned with the [High Level Design](../HIGH_LEVEL_DESIGN.md).

---

## Dependency Matrix & Specification Index

| Dependency                | Specification                                  | Core Role & Architecture                                                                         | Key Interfaces & Protocols              |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Hetzner Cloud**         | [`DEP_HETZNER.md`](DEP_HETZNER.md)             | Host VPS (CX22 staging, CPX21 production), OS hardening, cloud-init, UFW firewall                | `hcloud` CLI, Ansible, Cloud-Init       |
| **Directus CMS 11**       | [`DEP_DIRECTUS.md`](DEP_DIRECTUS.md)           | Headless content management, schema snapshots, order fulfillment console                         | `@directus/sdk`, S3 Driver, Redis Cache |
| **Stripe Payments**       | [`DEP_STRIPE.md`](DEP_STRIPE.md)               | Dynamic Checkout sessions (`price_data`), SAQ-A PCI compliance, raw HMAC webhooks, idempotency   | Stripe Node.js SDK, Stripe CLI          |
| **Cloudflare R2**         | [`DEP_CLOUDFLARE_R2.md`](DEP_CLOUDFLARE_R2.md) | S3-compatible zero-egress object storage (`chrishop-media`, `chrishop-backups`), CORS, lifecycle | `@aws-sdk/client-s3`, Wrangler CLI      |
| **Redis 7 OSS**           | [`DEP_REDIS.md`](DEP_REDIS.md)                 | 10-minute pre-checkout stock reservations, atomic Lua scripts, AOF persistence                   | `ioredis`, `redis-cli`                  |
| **Resend Email API**      | [`DEP_RESEND.md`](DEP_RESEND.md)               | Transactional email delivery for order receipts and carrier shipment tracking                    | Resend Node.js SDK, DKIM/SPF            |
| **Discord Notifications** | [`DEP_DISCORD.md`](DEP_DISCORD.md)             | Real-time ops alerts (`#store-orders`, `#dev-alerts`), rich embeds, rate limiting                | Discord Webhooks, REST API              |
| **Caddy Web Server**      | [`DEP_CADDY.md`](DEP_CADDY.md)                 | Edge reverse proxy, automatic Let's Encrypt / ZeroSSL, Cloudflare DNS-01 wildcard TLS            | `xcaddy`, Caddyfile                     |
| **Cloudflare**            | [`DEP_CLOUDFLARE.md`](DEP_CLOUDFLARE.md)       | Authoritative DNS (`shop.jacobmiller22.com`), Full (Strict) SSL, Edge WAF, ACME token            | Cloudflare API v4, Dashboard            |

---

## Status Taxonomy for Referenced Paths

Across all dependency specifications, referenced file paths are annotated using this explicit status taxonomy:

- **`[EXISTS]`**: File is present in the current monorepo commit and actively functional.
- **`[PLANNED: Story X.Y]`**: File path is canonically designated for implementation in an upcoming scheduled user story.
