# Cloudflare Zone Custom Error Pages Configuration
# Story 4.24: Graceful Edge Timeout Interception & Branded Customer-Facing 504 Fallback (#248)

resource "cloudflare_custom_pages" "errors_500" {
  count   = var.manage_shared_resources && var.enable_custom_error_pages ? 1 : 0
  zone_id = local.zone_id
  type    = "500_errors"
  url     = var.custom_page_500_url != "" ? var.custom_page_500_url : "https://${local.primary_hostname}/error-pages/500-errors.html"
  state   = "customized"
}

resource "cloudflare_custom_pages" "errors_1000" {
  count   = var.manage_shared_resources && var.enable_custom_error_pages ? 1 : 0
  zone_id = local.zone_id
  type    = "1000_errors"
  url     = var.custom_page_1000_url != "" ? var.custom_page_1000_url : "https://${local.primary_hostname}/error-pages/1000-errors.html"
  state   = "customized"
}
