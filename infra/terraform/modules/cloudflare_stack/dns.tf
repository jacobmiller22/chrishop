resource "cloudflare_record" "storefront" {
  zone_id = var.cloudflare_zone_id
  name    = local.primary_record_name
  content = "100::"
  type    = "AAAA"
  proxied = true
  comment = "Managed by Terraform - ChrisShop ${var.environment} primary domain"
}

resource "cloudflare_record" "aliases" {
  for_each = toset(var.aliases)
  zone_id  = var.cloudflare_zone_id
  name     = each.key
  content  = "100::"
  type     = "AAAA"
  proxied  = true
  comment  = "Managed by Terraform - ChrisShop ${var.environment} alias domain"
}

resource "cloudflare_workers_domain" "custom_domain" {
  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  hostname    = "${local.primary_record_name}.${var.zone_name}"
  service     = local.service_name
  environment = "production"
}
