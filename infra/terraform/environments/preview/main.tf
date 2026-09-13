terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }

  backend "local" {}
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "preview_stack" {
  source = "../../modules/cloudflare_stack"

  cloudflare_account_id   = var.cloudflare_account_id
  cloudflare_zone_id      = var.cloudflare_zone_id
  zone_name               = var.zone_name
  environment             = "preview"
  subdomain_prefix        = var.pr_number != "" ? "pr-${var.pr_number}" : "preview"
  pr_number               = var.pr_number
  manage_shared_resources = var.pr_number == ""
  aliases                 = []
  media_retention_days    = 14
}
