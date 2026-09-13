terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }

  backend "s3" {
    bucket                      = "chrishop-terraform-state"
    key                         = "environments/staging/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
    endpoints = {
      s3 = "https://placeholder.r2.cloudflarestorage.com"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "staging_stack" {
  source = "../../modules/cloudflare_stack"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  zone_name             = var.zone_name
  environment           = "staging"
  subdomain_prefix      = "staging"
  aliases               = ["staging-shop"]
  media_retention_days  = 90
}
