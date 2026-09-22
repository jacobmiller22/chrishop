# Cloudflare Edge Caching & Zone Settings Configuration
# Story 4.8: Cloudflare DNS & Edge Caching Configuration (#67)

resource "cloudflare_zone_settings_override" "settings" {
  count   = var.manage_shared_resources ? 1 : 0
  zone_id = local.zone_id

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    brotli                   = "on"
    early_hints              = "on"
    http3                    = "on"
    zero_rtt                 = "on"
    tls_1_3                  = "on"
    min_tls_version          = "1.2"
    ssl                      = "strict"

    security_header {
      enabled            = true
      max_age            = 31536000
      include_subdomains = true
      preload            = true
      nosniff            = true
    }
  }
}

resource "cloudflare_page_rule" "cache_static_assets" {
  count    = var.manage_shared_resources ? 1 : 0
  zone_id  = local.zone_id
  target   = "*${var.zone_name}/_next/static/*"
  priority = 1

  actions {
    cache_level       = "cache_everything"
    edge_cache_ttl    = 31536000
    browser_cache_ttl = 31536000
  }
}

resource "cloudflare_page_rule" "cache_media" {
  count    = var.manage_shared_resources ? 1 : 0
  zone_id  = local.zone_id
  target   = "*${var.zone_name}/media/*"
  priority = 2

  actions {
    cache_level       = "cache_everything"
    edge_cache_ttl    = 31536000
    browser_cache_ttl = 31536000
  }
}

resource "cloudflare_page_rule" "bypass_admin" {
  count    = var.manage_shared_resources ? 1 : 0
  zone_id  = local.zone_id
  target   = "*${var.zone_name}/admin*"
  priority = 3

  actions {
    cache_level = "bypass"
  }
}

resource "cloudflare_page_rule" "bypass_api" {
  count    = var.manage_shared_resources ? 1 : 0
  zone_id  = local.zone_id
  target   = "*${var.zone_name}/api/*"
  priority = 4

  actions {
    cache_level = "bypass"
  }
}
