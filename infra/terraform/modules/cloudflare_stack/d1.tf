locals {
  d1_database_name = var.environment == "preview" && var.pr_number != "" ? "chrishop-preview-pr-${var.pr_number}-db" : "chrishop-${var.environment}-db"
}

resource "cloudflare_d1_database" "primary" {
  account_id = var.cloudflare_account_id
  name       = local.d1_database_name
}
