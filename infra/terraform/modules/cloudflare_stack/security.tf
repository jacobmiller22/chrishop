resource "cloudflare_turnstile_widget" "checkout" {
  account_id = var.cloudflare_account_id
  name       = "chrishop-${var.environment}-checkout-turnstile"
  domains    = ["${local.primary_record_name}.${var.zone_name}", "localhost"]
  mode       = "managed"
  region     = "world"
}
