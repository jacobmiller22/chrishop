locals {
  kv_namespace_title = var.environment == "preview" && var.pr_number != "" ? "NEXT_CACHE_WORKERS_KV_PREVIEW_PR_${var.pr_number}" : "NEXT_CACHE_WORKERS_KV_${upper(var.environment)}"
}

resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = local.kv_namespace_title
}
