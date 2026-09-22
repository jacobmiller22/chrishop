# Cloudflare Access (Zero Trust) Identity Perimeter Configuration
# Story 5.6: Cloudflare Access (Zero Trust) Identity Gate & CLI Tooling (#139)

# 1. Access Application for Payload CMS Admin Panel (/admin/*)
resource "cloudflare_access_application" "admin" {
  count                     = var.enable_cloudflare_access && var.manage_shared_resources ? 1 : 0
  zone_id                   = local.zone_id
  name                      = var.environment == "production" ? "ChrisShop Admin (Production)" : "ChrisShop Admin (${var.environment})"
  domain                    = "${local.primary_hostname}/admin"
  type                      = "self_hosted"
  session_duration          = "8h"
  auto_redirect_to_identity = false
}

# 2. Access Application for Non-Production / Staging Environments
resource "cloudflare_access_application" "staging_perimeter" {
  count                     = var.enable_cloudflare_access && var.manage_shared_resources && var.environment != "production" ? 1 : 0
  zone_id                   = local.zone_id
  name                      = "ChrisShop Staging Perimeter (${var.environment})"
  domain                    = local.primary_hostname
  type                      = "self_hosted"
  session_duration          = "24h"
  auto_redirect_to_identity = false
}

# 3. CI/CD & Synthetic Monitoring Service Token
resource "cloudflare_access_service_token" "ci_probe" {
  count                = var.enable_cloudflare_access && var.manage_shared_resources ? 1 : 0
  account_id           = var.cloudflare_account_id
  name                 = "chrishop-${var.environment}-ci-probe"
  min_days_for_renewal = 30

  lifecycle {
    create_before_destroy = true
  }
}

# 4. Access Policy: Allow Authorized Team Emails to Admin Panel
resource "cloudflare_access_policy" "admin_allow_team" {
  count          = var.enable_cloudflare_access && var.manage_shared_resources ? 1 : 0
  application_id = cloudflare_access_application.admin[0].id
  zone_id        = local.zone_id
  name           = "Allow Authorized Admin Team"
  decision       = "allow"
  precedence     = 1

  include {
    email        = var.access_allowed_emails
    email_domain = var.access_allowed_domains
  }
}

# 5. Access Policy: Service Token Bypass for CI/CD & Automated Probes
resource "cloudflare_access_policy" "admin_bypass_service_token" {
  count          = var.enable_cloudflare_access && var.manage_shared_resources ? 1 : 0
  application_id = cloudflare_access_application.admin[0].id
  zone_id        = local.zone_id
  name           = "Bypass for CI & Synthetic Monitors"
  decision       = "bypass"
  precedence     = 2

  include {
    service_token = [cloudflare_access_service_token.ci_probe[0].id]
  }
}
