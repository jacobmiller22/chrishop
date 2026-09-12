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
  value       = cloudflare_r2_bucket.media.name
}

output "storefront_url" {
  description = "Authoritative storefront endpoint URL"
  value       = "https://${local.primary_record_name}.${var.zone_name}"
}

output "turnstile_site_key" {
  description = "Turnstile widget site key"
  value       = cloudflare_turnstile_widget.checkout.id
}
