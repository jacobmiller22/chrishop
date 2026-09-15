provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "stack" {
  source = "./modules/cloudflare_stack"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  zone_name             = var.zone_name
  environment           = var.environment
  subdomain_prefix      = var.environment == "production" ? "" : var.environment
  aliases               = var.environment == "production" ? ["shop"] : (var.environment == "staging" ? ["staging-shop"] : [])
  media_retention_days  = var.environment == "preview" ? 14 : 90
}
