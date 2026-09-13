output "d1_database_id" {
  description = "D1 Database UUID provisioned by Terraform"
  value       = module.stack.d1_database_id
}

output "d1_database_name" {
  description = "D1 Database Name provisioned by Terraform"
  value       = module.stack.d1_database_name
}

output "kv_namespace_id" {
  description = "Workers KV Namespace ID provisioned by Terraform"
  value       = module.stack.kv_namespace_id
}

output "r2_bucket_name" {
  description = "R2 Bucket Name provisioned by Terraform"
  value       = module.stack.r2_bucket_name
}

output "storefront_url" {
  description = "Storefront public URL"
  value       = module.stack.storefront_url
}

output "turnstile_site_key" {
  description = "Turnstile widget sitekey for bot mitigation"
  value       = module.stack.turnstile_site_key
}
