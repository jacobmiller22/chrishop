resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = "NEXT_CACHE_WORKERS_KV_${upper(var.environment)}"
}
