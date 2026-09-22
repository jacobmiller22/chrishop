# Cloudflare Edge Security & WAF Rulesets
# Story 5.5: Cloudflare Integration — WAF, CDN & DDoS Protection (#56)
# Story 5.7: Architectural Spike & Integration Assessment (#165)

resource "cloudflare_turnstile_widget" "checkout" {
  count      = var.manage_shared_resources ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "chrishop-${var.environment}-checkout-turnstile"
  domains    = ["${local.primary_record_name}.${var.zone_name}", "localhost"]
  mode       = "managed"
  region     = "world"
}

resource "cloudflare_ruleset" "waf_custom" {
  count       = var.manage_shared_resources ? 1 : 0
  zone_id     = local.zone_id
  name        = "chrishop-${var.environment}-waf-custom"
  description = "ChrisShop Custom WAF Ruleset: Webhook Bypass, Health Probe, and Threat Defense"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # Rule 1: Bypass WAF for legitimate Shopify Webhooks
  rules {
    action = "skip"
    action_parameters {
      ruleset = "current"
    }
    expression  = "(http.request.uri.path eq \"/api/orders/webhook\" or starts_with(http.request.uri.path, \"/api/webhooks/\")) and http.request.method eq \"POST\""
    description = "Bypass WAF managed inspection for Shopify webhooks (validated via HMAC in worker)"
    enabled     = true
  }

  # Rule 2: Managed Challenge for Elevated Threat Scores
  rules {
    action      = "managed_challenge"
    expression  = "cf.threat_score gt 30 and not (http.request.uri.path eq \"/api/orders/webhook\" or http.request.uri.path eq \"/api/health\")"
    description = "Managed challenge for elevated threat score visitors (>30)"
    enabled     = true
  }
}

resource "cloudflare_ruleset" "rate_limiting" {
  count       = var.manage_shared_resources ? 1 : 0
  zone_id     = local.zone_id
  name        = "chrishop-${var.environment}-rate-limiting"
  description = "ChrisShop Edge Rate Limiting: Cart mutations and checkout handshakes"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action = "managed_challenge"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 30
    }
    expression  = "(starts_with(http.request.uri.path, \"/api/cart\") or starts_with(http.request.uri.path, \"/api/checkout\")) and (http.request.method in [\"POST\", \"PUT\", \"DELETE\"])"
    description = "Rate limit cart and checkout mutations to 30 req/min with managed challenge"
    enabled     = true
  }
}
