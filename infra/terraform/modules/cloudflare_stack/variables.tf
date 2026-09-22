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

variable "enable_custom_error_pages" {
  description = "Whether to configure custom branded error pages for 500-series and 1000-series errors"
  type        = bool
  default     = true
}

variable "custom_page_500_url" {
  description = "URL where 500-errors.html is hosted"
  type        = string
  default     = ""
}

variable "custom_page_1000_url" {
  description = "URL where 1000-errors.html is hosted"
  type        = string
  default     = ""
}

variable "enable_cloudflare_access" {
  description = "Whether to provision Cloudflare Access Zero Trust perimeter policies for admin and staging"
  type        = bool
  default     = true
}

variable "access_team_name" {
  description = "Cloudflare Zero Trust organization team name"
  type        = string
  default     = "chrishop"
}

variable "access_allowed_emails" {
  description = "List of authorized administrator email addresses for Cloudflare Access"
  type        = list(string)
  default     = ["maker@bankbeaters.example", "admin@chrishop.com"]
}

variable "access_allowed_domains" {
  description = "List of authorized email domains for Cloudflare Access"
  type        = list(string)
  default     = ["bankbeaters.example", "chrishop.com"]
}

