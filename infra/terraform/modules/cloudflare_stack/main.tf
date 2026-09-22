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
  is_apex = var.use_apex_domain || var.subdomain_prefix == "@"
  primary_record_name = local.is_apex ? "@" : (
    var.subdomain_prefix == "" ? "chrishop" : (
      var.environment == "staging" ? "staging-chrishop" : "${var.subdomain_prefix}-chrishop"
    )
  )
  primary_hostname = local.is_apex ? var.zone_name : "${local.primary_record_name}.${var.zone_name}"
  service_name = var.environment == "production" ? "chrishop" : (
    var.environment == "staging" ? "chrishop-staging" : "chrishop-${var.subdomain_prefix}"
  )
}
