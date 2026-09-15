resource "cloudflare_r2_bucket" "media" {
  count      = var.manage_shared_resources ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "chrishop-media-${var.environment}"
  location   = "ENAM"
}
