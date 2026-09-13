variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
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
