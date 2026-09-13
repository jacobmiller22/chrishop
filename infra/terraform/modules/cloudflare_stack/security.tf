resource "cloudflare_turnstile_widget" "checkout" {
  count      = var.manage_shared_resources ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "chrishop-${var.environment}-checkout-turnstile"
  domains    = ["${local.primary_record_name}.${var.zone_name}", "localhost"]
  mode       = "managed"
  region     = "world"
}
