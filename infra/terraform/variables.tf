variable "cloudflare_api_token" {
  description = "Cloudflare API token with Account and Zone permissions"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for jacobmiller22.com"
  type        = string
  default     = ""
}

variable "zone_name" {
  description = "Root domain name for the zone"
  type        = string
  default     = "jacobmiller22.com"
}

variable "environment" {
  description = "Deployment environment tier (production, staging, preview)"
  type        = string
  default     = "staging"
}
