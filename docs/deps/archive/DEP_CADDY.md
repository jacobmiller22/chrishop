# Dependency Specification: Caddy Web Server (`DEP_CADDY.md`)

This document specifies the integration architecture, automated HTTPS, Cloudflare DNS-01 ACME wildcard challenges, reverse proxy routing, rate limiting, and operational commands for **Caddy Web Server**, the edge gateway for ChrisShop.

---

## 1. Service Overview & Architecture

- **Role**: Edge Reverse Proxy, TLS Termination, and Ephemeral PR Preview Router
- **Base Image**: Custom Docker container built with `xcaddy` including `github.com/caddy-dns/cloudflare` plugin (`infra/caddy/Dockerfile`).
- **Core Capabilities**:
  - Fully automated Let's Encrypt / ZeroSSL TLS certificates with automatic renewal.
  - Wildcard certificate issuance (`*.preview.chrishop.com` and `*.preview.shop.jacobmiller22.com`) via Cloudflare DNS-01 API challenge.
  - HTTP/3 (QUIC) support enabled out of the box for fast mobile shopping experiences.
  - Zero-downtime hot configuration reloads (`caddy reload`).

---

## 2. Custom Docker Image Specification (`infra/caddy/Dockerfile`)

Caddy's official image does not include third-party DNS provider plugins. The custom build uses `xcaddy`:

```dockerfile
# infra/caddy/Dockerfile
FROM caddy:2-builder-alpine AS builder

RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
```

---

## 3. Configuration & Caddyfile Specification

The active configuration resides at `infra/caddy/Caddyfile`:

```caddy
# Global Options
{
    email admin@chrishop.com
    admin off
}

# Snippet: Standard Security Headers
(security_headers) {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}

# Production Storefront (Next.js)
shop.jacobmiller22.com, chrishop.com {
    import security_headers
    reverse_proxy web:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

# Directus CMS Admin UI & API
admin.shop.jacobmiller22.com, admin.chrishop.com {
    import security_headers
    reverse_proxy cms:8055 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

# Permanent Staging Environment
staging.chrishop.com, staging.shop.jacobmiller22.com {
    import security_headers
    reverse_proxy staging-web:3000
}

# Ephemeral Wildcard PR Previews (*.preview.chrishop.com / *.preview.shop.jacobmiller22.com)
*.preview.chrishop.com, *.preview.shop.jacobmiller22.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
        resolvers 1.1.1.1 1.0.0.1
    }

    import security_headers

    @preview header_regexp Host ^pr-(?<pr_id>\d+)\.preview\.(chrishop\.com|shop\.jacobmiller22\.com)$
    handle @preview {
        reverse_proxy pr-{re.preview.pr_id}-web:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }

    handle {
        respond "Preview environment not found or has been torn down." 404
    }
}
```

---

## 4. Wildcard TLS & Cloudflare DNS-01 Challenge

1. **Why DNS-01?**: ACME HTTP-01 challenges cannot issue wildcard certificates (`*.preview...`). The ACME server requires a `_acme-challenge` TXT record in the authoritative DNS zone.
2. **DNS-01 Flow**:
   - Caddy receives a request for `pr-42.preview.chrishop.com`.
   - Caddy calls the Cloudflare API using `CLOUDFLARE_API_TOKEN` to provision `_acme-challenge.preview.chrishop.com`.
   - Let's Encrypt verifies the TXT record via public recursive resolvers (`1.1.1.1`).
   - Caddy obtains the certificate and automatically deletes the temporary TXT record.
   - The certificate covers all `*.preview...` subdomains and auto-renews at 60 days.

---

## 5. Reverse Proxy Security, Buffering & Rate Limiting

- **Sensitive Endpoint Protection**:
  - `/api/checkout`: Caddy enforces burst buffering and request throttling (e.g. 10 requests / 10s) before traffic reaches Next.js.
  - `/api/webhooks/stripe`: Unbuffered body streaming allows raw HMAC verification without chunk alteration.
- **Docker Compose Networking**: Caddy sits on both the public-facing edge network and the internal bridge network (`chrishop-internal`), allowing it to resolve container DNS names (`web:3000`, `cms:8055`).

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                     | Status      | Scheduled Story | Description                                                        |
| ------------------------ | ----------- | --------------- | ------------------------------------------------------------------ |
| `infra/caddy/Caddyfile`  | `[EXISTS]`  | Phase 1         | Caddy reverse proxy and wildcard SSL configuration                 |
| `infra/caddy/Dockerfile` | `[PLANNED]` | Story 2.11      | Multi-stage Dockerfile compiling xcaddy with Cloudflare DNS plugin |

---

## 7. Operational Commands & Integration Testing

```bash
# Validate Caddyfile syntax without restarting
docker exec -it chrishop-caddy caddy validate --config /etc/caddy/Caddyfile

# Hot reload Caddyfile without dropping active customer connections
docker exec -it chrishop-caddy caddy reload --config /etc/caddy/Caddyfile

# Inspect active certificates managed by Caddy
docker exec -it chrishop-caddy caddy list-certificates

# Test HTTPS handshake and certificate validity
curl -Iv https://shop.jacobmiller22.com
curl -Iv https://pr-42.preview.chrishop.com
```
