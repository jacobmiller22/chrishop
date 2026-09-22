output "d1_database_id" {
  description = "UUID of the provisioned D1 database"
  value       = cloudflare_d1_database.primary.id
}

output "d1_database_name" {
  description = "Name of the provisioned D1 database"
  value       = cloudflare_d1_database.primary.name
}

output "kv_namespace_id" {
  description = "ID of the Workers KV cache namespace"
  value       = cloudflare_workers_kv_namespace.cache.id
}

output "r2_bucket_name" {
  description = "Name of the R2 media bucket"
  value       = var.manage_shared_resources ? cloudflare_r2_bucket.media[0].name : "chrishop-media-${var.environment}"
}

output "storefront_url" {
  description = "Authoritative storefront endpoint URL"
  value       = "https://${local.primary_record_name}.${var.zone_name}"
}

output "turnstile_site_key" {
  description = "Turnstile widget site key"
  value       = var.manage_shared_resources ? cloudflare_turnstile_widget.checkout[0].id : ""
}

output "access_admin_application_id" {
  description = "ID of the Cloudflare Access Admin application"
  value       = var.enable_cloudflare_access && var.manage_shared_resources ? cloudflare_access_application.admin[0].id : ""
}

output "access_admin_aud" {
  description = "AUD tag of the Cloudflare Access Admin application"
  value       = var.enable_cloudflare_access && var.manage_shared_resources ? cloudflare_access_application.admin[0].aud : ""
}

output "access_service_token_id" {
  description = "ID of the Cloudflare Access CI probe service token"
  value       = var.enable_cloudflare_access && var.manage_shared_resources ? cloudflare_access_service_token.ci_probe[0].id : ""
}

output "waf_ruleset_id" {
  description = "ID of the Cloudflare Custom WAF ruleset"
  value       = var.manage_shared_resources ? cloudflare_ruleset.waf_custom[0].id : ""
}

output "rate_limit_ruleset_id" {
  description = "ID of the Cloudflare Edge Rate Limiting ruleset"
  value       = var.manage_shared_resources ? cloudflare_ruleset.rate_limiting[0].id : ""
}

