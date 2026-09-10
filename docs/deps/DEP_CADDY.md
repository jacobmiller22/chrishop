# Dependency Specification: Caddy Web Server (`DEP_CADDY.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for **Caddy Web Server**, providing automatic HTTPS TLS certificates, Cloudflare DNS-01 ACME challenges, wildcard domain routing, and zero-downtime container proxying.

---

## 1. Service Overview & Architecture

- **Role**: Edge Reverse Proxy & Automatic SSL Manager
- **Image**: Custom Caddy build with Cloudflare DNS plugin (`caddy:2-alpine` with `caddy-dns/cloudflare`)
- **Key Capabilities**:
  - Auto-HTTPS via Let's Encrypt / ZeroSSL.
  - Wildcard TLS certificate issuance (`*.preview.chrishop.com`) via Cloudflare DNS-01 API challenge.
  - Dynamic reverse proxying for production (`chrishop.com`), staging (`staging.chrishop.com`), and per-PR preview environments (`pr-X.preview.chrishop.com`).

---

## 2. Configuration & Caddyfile Specifications

- Configuration File: `infra/caddy/Caddyfile`

```caddy
# Global options
{
    email admin@chrishop.com
}

# Production Storefront
chrishop.com {
    reverse_proxy web:3000
}

# Directus Admin UI
admin.chrishop.com {
    reverse_proxy cms:8055
}

# Ephemeral Wildcard PR Previews
*.preview.chrishop.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    @preview header_regexp Host ^pr-(?<pr_id>\d+)\.preview\.chrishop\.com$
    handle @preview {
        reverse_proxy pr-{re.preview.pr_id}-web:3000
    }
}
```

---

## 3. Control Commands & Integration Testing

- **Reload Caddy Config**: `docker exec -it chrishop-caddy caddy reload --config /etc/caddy/Caddyfile`
- **Validate Caddyfile Syntax**: `docker exec -it chrishop-caddy caddy validate --config /etc/caddy/Caddyfile`
- **Wildcard TLS Challenge Test**: Verify SSL handshake on test preview domain `https://pr-1.preview.chrishop.com`.
