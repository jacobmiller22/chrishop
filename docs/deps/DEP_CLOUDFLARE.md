# Dependency Specification: Cloudflare DNS, Edge WAF & CDN (`DEP_CLOUDFLARE.md`)

This document specifies the authoritative DNS architecture, SSL/TLS encryption mode, edge Web Application Firewall (WAF) rules, scoped ACME API tokens, and CDN caching policies for **Cloudflare**, managing network edge security for ChrisShop.

---

## 1. Service Overview & Architecture

- **Provider**: Cloudflare, Inc.
- **Managed Zones**:
  - `jacobmiller22.com` (Active development & staging zone: `shop.jacobmiller22.com`)
  - `chrishop.com` (Production launch target)
- **Core Edge Services**:
  - **Authoritative Anycast DNS**: Ultra-low-latency DNS resolution with instant propagation.
  - **Edge CDN & DDoS Mitigation**: Automatic mitigation of Layer 3/4 and Layer 7 volumetric attacks.
  - **SSL/TLS Full (Strict)**: End-to-end cryptographic encryption between browser, Cloudflare edge, and Hetzner VPS origin.
  - **DNS-01 ACME Challenge API**: Scoped API token enabling Caddy to issue wildcard certificates (`*.preview...`).

---

## 2. DNS Configuration Specification

The following DNS records must be provisioned in the Cloudflare dashboard or via API:

| Record Type | Hostname / Subdomain                             | Target / Destination                                        | Proxy Status         | Purpose                                                     |
| ----------- | ------------------------------------------------ | ----------------------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| `A`         | `shop.jacobmiller22.com` / `@`                   | `<HETZNER_VPS_IP>`                                          | **Proxied (Orange)** | Primary storefront public entrypoint                        |
| `A`         | `admin.shop.jacobmiller22.com` / `admin`         | `<HETZNER_VPS_IP>`                                          | **Proxied (Orange)** | Directus CMS back-office admin UI                           |
| `A`         | `staging.shop.jacobmiller22.com` / `staging`     | `<HETZNER_VPS_IP>`                                          | **Proxied (Orange)** | Permanent staging environment                               |
| `A`         | `*.preview.shop.jacobmiller22.com` / `*.preview` | `<HETZNER_VPS_IP>`                                          | **DNS-Only (Grey)**  | Wildcard ephemeral PR previews (Caddy handles TLS directly) |
| `CNAME`     | `resend._domainkey`                              | `dkim.resend.com`                                           | **DNS-Only (Grey)**  | Resend transactional email DKIM authentication              |
| `TXT`       | `@`                                              | `v=spf1 include:amazonses.com ~all`                         | **DNS-Only (Grey)**  | Resend email SPF record                                     |
| `TXT`       | `_dmarc`                                         | `v=DMARC1; p=none; rua=mailto:dmarc@shop.jacobmiller22.com` | **DNS-Only (Grey)**  | DMARC deliverability reporting                              |
| `MX`        | `feedback`                                       | `feedback-smtp.us-east-1.amazonses.com` (Priority 10)       | **DNS-Only (Grey)**  | Inbound bounce feedback processing                          |

---

## 3. SSL/TLS Encryption Configuration

To enforce strict security and eliminate man-in-the-middle vulnerabilities:

- **SSL/TLS Mode**: **Full (Strict)**
  - _Browser ➔ Cloudflare Edge_: Secured via Cloudflare Universal SSL certificate.
  - _Cloudflare Edge ➔ Origin (Hetzner VPS)_: Cloudflare verifies valid Let's Encrypt / ZeroSSL TLS certificates presented by origin Caddy web server.
- **Minimum TLS Version**: **TLS 1.2** (TLS 1.3 enabled by default).
- **Opportunistic Encryption**: **Enabled**.
- **Always Use HTTPS**: **Enabled** (Automatic 301 redirect from HTTP to HTTPS at edge).
- **HTTP Strict Transport Security (HSTS)**:
  - `max-age=31536000` (1 Year)
  - `includeSubDomains: true`
  - `preload: true`

---

## 4. Edge WAF & Security Rules

### 4.1 Bot Protection & Drop Scalper Mitigation

Limited-edition drops are targets for automated scalper bots. Cloudflare Bot Fight Mode is enabled to challenge automated scrapers.

### 4.2 Critical Webhook Bypass Rule

Stripe webhooks originate from automated Stripe servers and must never be challenged by Bot Fight Mode or interactive CAPTCHAs.

- **Rule Name**: `Bypass WAF for Stripe Webhooks`
- **Expression**:
  ```text
  (http.request.uri.path eq "/api/webhooks/stripe")
  ```
- **Action**: **Skip**
  - Skip all remaining WAF Managed Rules, Bot Management, and Interactive Challenges.

### 4.3 Rate Limiting Rules

1. **Checkout Burst Protection**:
   - **Expression**: `(http.request.uri.path eq "/api/checkout")`
   - **Characteristics**: IP address
   - **Threshold**: 10 requests per 10 seconds
   - **Action**: Managed Challenge
   - **Rationale**: Prevents botnets from exhausting Redis reservation locks during high-traffic drops.

2. **Directus Admin Brute Force Protection**:
   - **Expression**: `(http.request.uri.path eq "/admin/auth/login")`
   - **Characteristics**: IP address
   - **Threshold**: 5 requests per 1 minute
   - **Action**: Block for 15 minutes
   - **Rationale**: Mitigates credential stuffing attacks on administrative accounts.

---

## 5. Scoped API Token Permissions (Caddy DNS-01)

For Caddy to autonomously solve ACME DNS-01 challenges for `*.preview.chrishop.com` and `*.preview.shop.jacobmiller22.com`, a least-privilege Cloudflare API token is required.

### 5.1 Token Specification

- **Token Name**: `ChrisShop Caddy DNS-01 ACME Token`
- **Permissions**:
  - `Zone` — `DNS` — `Edit`
  - `Zone` — `Zone` — `Read`
- **Zone Resources**:
  - `Include` — `Specific Zone` — `jacobmiller22.com`
  - `Include` — `Specific Zone` — `chrishop.com`
- **Client IP Address Filtering**: Restricted to Hetzner VPS Static IPv4/IPv6 address.
- **TTL / Expiration**: Permanent (monitored with annual rotation).

### 5.2 Token Usage

The token value is injected into the Caddy Docker container as an environment variable:

```env
CLOUDFLARE_API_TOKEN="<your-scoped-cloudflare-api-token>"
```

---

## 6. CDN Edge Caching & Cache Rules

To minimize origin server load on Next.js and Directus while guaranteeing immediate freshness for checkout:

### 6.1 Static Asset Cache Rule

- **Name**: `Cache Next.js Static Assets & Media`
- **Expression**:
  ```text
  (http.request.uri.path starts_with "/_next/static/") or
  (http.request.uri.path starts_with "/images/") or
  (http.request.uri.path eq "/favicon.ico")
  ```
- **Settings**:
  - Cache Level: Cache Everything
  - Edge TTL: 1 month (`2592000s`)
  - Browser TTL: 1 month (`2592000s`)

### 6.2 Dynamic Route Bypass Rule

- **Name**: `Bypass Cache for Dynamic APIs & Admin`
- **Expression**:
  ```text
  (http.request.uri.path starts_with "/api/") or
  (http.request.uri.path starts_with "/admin/") or
  (http.request.uri.path starts_with "/checkout/")
  ```
- **Settings**:
  - Cache Level: Bypass Cache

---

## 7. Reconciled Configuration Files & Monorepo Paths

| Path                                     | Status      | Scheduled Story       | Description                                                     |
| ---------------------------------------- | ----------- | --------------------- | --------------------------------------------------------------- |
| `infra/caddy/Caddyfile`                  | `[EXISTS]`  | Phase 1               | Uses Cloudflare DNS plugin for wildcard TLS                     |
| `infra/scripts/deps/cloudflare_setup.sh` | `[PLANNED]` | Story 4.8 / Story 5.5 | Automated script configuring DNS, WAF rules, and tokens via API |

---

## 8. Operational Commands & API Verification

```bash
# Verify API Token validity
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
     -H "Content-Type: application/json"
# Expected response: {"result":{"id":"...","status":"active"},"success":true,...}

# Query Zone ID for jacobmiller22.com
curl -X GET "https://api.cloudflare.com/client/v4/zones?name=jacobmiller22.com" \
     -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

# List active DNS records
curl -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
     -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

# Purge CDN edge cache for updated assets
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
     -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"purge_everything":true}'
```
