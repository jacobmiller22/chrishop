variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID (optional, dynamically resolved via zone_name if omitted)"
  type        = string
  default     = ""
}

variable "zone_name" {
  description = "Root domain name for the zone (e.g. jacobmiller22.com)"
  type        = string
  default     = "jacobmiller22.com"
}

variable "environment" {
  description = "Deployment tier (production, staging, preview)"
  type        = string
}

variable "subdomain_prefix" {
  description = "Subdomain prefix for the storefront (empty for root prod chrishop)"
  type        = string
  default     = ""
}

variable "aliases" {
  description = "List of alternative DNS alias hostnames"
  type        = list(string)
  default     = []
}

variable "media_retention_days" {
  description = "Retention period in days before ephemeral media deletion"
  type        = number
  default     = 90
}

variable "manage_shared_resources" {
  description = "Whether to manage shared tier resources like the R2 media bucket and Turnstile widget (false for ephemeral PR previews)"
  type        = bool
  default     = true
}

variable "pr_number" {
  description = "Pull request number for ephemeral preview stack isolation"
  type        = string
  default     = ""
}

variable "use_apex_domain" {
  description = "Whether the primary storefront route binds directly to the zone apex domain (@)"
  type        = bool
  default     = false
}

variable "enable_media_cname" {
  description = "Whether to provision a public CNAME record for R2 media custom domain (media.<zone_name>)"
  type        = bool
  default     = false
}

