data "cloudflare_zone" "primary" {
  count      = var.cloudflare_zone_id == "" ? 1 : 0
  name       = var.zone_name
  account_id = var.cloudflare_account_id
}

locals {
  zone_id = var.cloudflare_zone_id != "" ? var.cloudflare_zone_id : data.cloudflare_zone.primary[0].id
}

resource "cloudflare_record" "storefront" {
  zone_id = local.zone_id
  name    = local.primary_record_name
  content = "100::"
  type    = "AAAA"
  proxied = true
  comment = "Managed by Terraform - ChrisShop ${var.environment} primary domain"
}

resource "cloudflare_record" "aliases" {
  for_each = toset(var.aliases)
  zone_id  = local.zone_id
  name     = each.key
  content  = "100::"
  type     = "AAAA"
  proxied  = true
  comment  = "Managed by Terraform - ChrisShop ${var.environment} alias domain"
}

resource "cloudflare_workers_domain" "custom_domain" {
  count       = var.environment == "preview" ? 0 : 1
  account_id  = var.cloudflare_account_id
  zone_id     = local.zone_id
  hostname    = "${local.primary_record_name}.${var.zone_name}"
  service     = local.service_name
  environment = "production"
}
