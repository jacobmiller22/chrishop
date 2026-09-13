resource "cloudflare_d1_database" "primary" {
  account_id = var.cloudflare_account_id
  name       = "chrishop-${var.environment}-db"
}
