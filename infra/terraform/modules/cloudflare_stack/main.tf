terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }
}

locals {
  primary_record_name = var.subdomain_prefix == "" ? "chrishop" : (
    var.environment == "staging" ? "staging-chrishop" : "${var.subdomain_prefix}-chrishop"
  )
  service_name = var.environment == "production" ? "chrishop" : (
    var.environment == "staging" ? "chrishop-staging" : "chrishop-${var.subdomain_prefix}"
  )
}
