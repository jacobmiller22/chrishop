resource "cloudflare_r2_bucket" "media" {
  account_id = var.cloudflare_account_id
  name       = "chrishop-media-${var.environment}"
  location   = "ENAM"
}
