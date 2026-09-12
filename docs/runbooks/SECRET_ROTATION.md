# Operational Runbook: Production Edge Secret Rotation Procedures (`docs/runbooks/SECRET_ROTATION.md`)

- **Owner**: Platform Engineering & Security Operations
- **Scope**: Cloudflare Workers Secrets, GitHub Actions CI Secrets, and Third-Party API Credentials
- **Related Stories**: Story 2.29 ([#140](https://github.com/jacobmiller22/chrishop/issues/140)), Story 2.35 ([#158](https://github.com/jacobmiller22/chrishop/issues/158))
- **Architecture Standard**: `docs/decisions/ADR_CLOUDFLARE_SECRETS_EVALUATION.md`

---

## 1. Overview & Secret Inventory

This runbook defines the mandatory, step-by-step procedures for scheduled credential rollover, emergency revocation, and post-incident verification across the ChrisShop platform.

Per ADR-2026-09-11 (`ADR_CLOUDFLARE_SECRETS_EVALUATION.md`), application runtime credentials reside exclusively inside encrypted **Cloudflare Workers Secrets**, while CI/CD runners only retain deployment-scoped Cloudflare API credentials.

### Master Secret Inventory:

| Secret Identifier | Target Store | Environment(s) | Rotation Cadence | Blast Radius / Impact |
| :--- | :--- | :--- | :--- | :--- |
| **`PAYLOAD_SECRET`** | Cloudflare Workers Secret | Production, Staging, Preview | 90 Days / Incident | Invalidation of active Admin sessions |
| **`SHOPIFY_ADMIN_TOKEN`** | Cloudflare Workers Secret | Production, Staging | 90 Days / Incident | Disruption of Shopify Admin API queries |
| **`SHOPIFY_STOREFRONT_TOKEN`** | Cloudflare Workers Secret | Production, Staging | 180 Days / Incident | Disruption of live cart creation / checkout |
| **`SHOPIFY_WEBHOOK_SECRET`** | Cloudflare Workers Secret | Production, Staging | 180 Days / Incident | Failed HMAC validation for order webhooks |
| **`RESEND_API_KEY`** | Cloudflare Workers Secret | Production, Staging | 180 Days / Incident | Transactional email notification delivery |
| **`OPS_ALERT_WEBHOOK_URL`** | Cloudflare Workers Secret | Production, Staging | 365 Days / Incident | Operational webhook alerts delivery |
| **`DISCORD_WEBHOOK_URL`** | Cloudflare Workers Secret (Legacy) | Production, Staging | 365 Days / Incident | Legacy internal team alerts delivery |
| **`CLOUDFLARE_API_TOKEN`** | GitHub Repository Secret | GitHub Actions CI/CD | 90 Days / Incident | Automated deployment pipelines blocked |

---

## 2. Pre-Rotation Checklist & Verification Tooling

Before performing any secret rotation:

1. **Verify Wrangler CLI Authentication**:
   ```bash
   pnpm exec wrangler whoami
   ```
   Confirm your active account possesses `Workers Scripts: Edit` permissions for `chrishop` and `chrishop-staging`.

2. **Inspect Existing Active Secret Names**:
   ```bash
   # Staging Environment
   pnpm exec wrangler secret list --env staging

   # Production Environment
   pnpm exec wrangler secret list --env production
   ```

3. **Verify Edge Health Baseline**:
   Ensure edge endpoints return HTTP 200 before making changes:
   ```bash
   curl -s -f https://chrishop.jacobmiller22.com/api/health | jq .
   curl -s -f https://staging-chrishop.jacobmiller22.com/api/health | jq .
   ```

---

## 3. Step-by-Step Secret Rotation Procedures

### 3.1 `PAYLOAD_SECRET` (Payload CMS Session Encryption Key)

The `PAYLOAD_SECRET` is a 32+ character high-entropy key used to sign and verify JWT authentication tokens for Payload CMS administrators.

> [!NOTE]
> Rotating `PAYLOAD_SECRET` invalidates all active administrator login sessions. Administrators will be prompted to log in again upon their next request. Storefront customer browsing is completely unaffected.

#### Rotation Procedure:
1. **Generate Cryptographic Key**:
   ```bash
   NEW_PAYLOAD_SECRET=$(openssl rand -hex 32)
   ```

2. **Deploy Secret to Staging**:
   ```bash
   echo "$NEW_PAYLOAD_SECRET" | pnpm exec wrangler secret put PAYLOAD_SECRET --env staging
   ```

3. **Validate Staging Admin Login & Health**:
   ```bash
   # Verify health probe passes
   curl -s -f https://staging-chrishop.jacobmiller22.com/api/health | jq .
   # Visit https://staging-chrishop.jacobmiller22.com/admin in browser and test admin authentication
   ```

4. **Deploy Secret to Production**:
   ```bash
   echo "$NEW_PAYLOAD_SECRET" | pnpm exec wrangler secret put PAYLOAD_SECRET --env production
   ```

5. **Validate Production Admin Health**:
   ```bash
   curl -s -f https://chrishop.jacobmiller22.com/api/health | jq .
   ```

---

### 3.2 Shopify Access Tokens (`SHOPIFY_ADMIN_TOKEN` & `SHOPIFY_STOREFRONT_TOKEN`)

Shopify access tokens authorize backend communication with the Shopify Headless Storefront and Admin GraphQL APIs.

#### Rotation Procedure (Zero-Downtime Rollover):
1. **Issue New Token in Shopify Partners / Store Admin**:
   - Log into Shopify Partner Dashboard -> Store -> Apps -> ChrisShop Headless App.
   - Under API credentials, generate a secondary API access token (or create a replacement private app credential).
   - Copy the newly generated token.

2. **Deploy New Token to Staging**:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env staging
   pnpm exec wrangler secret put SHOPIFY_STOREFRONT_TOKEN --env staging
   ```

3. **Execute Live Integration Probes**:
   ```bash
   # Probe staging storefront cart creation
   curl -s -f -X POST https://staging-chrishop.jacobmiller22.com/api/health | jq .
   ```

4. **Deploy New Token to Production**:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env production
   pnpm exec wrangler secret put SHOPIFY_STOREFRONT_TOKEN --env production
   ```

5. **Verify Production Storefront & Checkout**:
   - Perform a live checkout dry-run: add item to cart and confirm redirection to `checkout.shopify.com`.
   - Verify zero errors in live edge log tail:
     ```bash
     pnpm exec wrangler tail --env production --status error
     ```

6. **Revoke Old Token**:
   - Return to Shopify Partner Dashboard and revoke the decommissioned token.

---

### 3.3 `SHOPIFY_WEBHOOK_SECRET` (HMAC SHA-256 Webhook Verification)

Used to cryptographically verify the `X-Shopify-Hmac-Sha256` signature header on incoming order creation and inventory webhooks.

#### Rotation Procedure:
1. **Generate New Webhook Secret** in Shopify Notifications / Webhooks settings.
2. **Update Staging**:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env staging
   ```
3. **Dispatch Test Webhook from Shopify Admin** to `https://staging-chrishop.jacobmiller22.com/api/webhooks/shopify` and verify HTTP 200 response in Shopify delivery history.
4. **Update Production**:
   ```bash
   pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env production
   ```
5. **Verify Production Webhook Verification**:
   - Check Cloudflare edge logs for successful HMAC verification logs.

---

### 3.4 `RESEND_API_KEY` (Transactional Customer Email)

1. Navigate to https://resend.com/api-keys.
2. Create new API key: `chrishop-edge-<YYYY-MM>` with sending permissions.
3. Deploy to Staging & Production:
   ```bash
   pnpm exec wrangler secret put RESEND_API_KEY --env staging
   pnpm exec wrangler secret put RESEND_API_KEY --env production
   ```
4. Trigger test email dispatch and verify delivery.
5. Delete legacy key in Resend dashboard.

---

### 3.5 `OPS_ALERT_WEBHOOK_URL` & `DISCORD_WEBHOOK_URL` (Operational Alerts)

1. **`OPS_ALERT_WEBHOOK_URL`** (Generic Webhooks / Slack / Zapier):
   ```bash
   pnpm exec wrangler secret put OPS_ALERT_WEBHOOK_URL --env staging
   pnpm exec wrangler secret put OPS_ALERT_WEBHOOK_URL --env production
   ```
2. **`DISCORD_WEBHOOK_URL`** (Legacy / Deprecated):
   ```bash
   pnpm exec wrangler secret put DISCORD_WEBHOOK_URL --env staging
   pnpm exec wrangler secret put DISCORD_WEBHOOK_URL --env production
   ```
3. Verify test webhook alert receipt.

---

### 3.6 `CLOUDFLARE_API_TOKEN` (CI/CD Deployment Token)

The `CLOUDFLARE_API_TOKEN` resides in GitHub Actions Repository Secrets.

#### Rotation Procedure:
1. Navigate to **Cloudflare Dashboard** -> **My Profile** -> **API Tokens**.
2. Click **Create Token** using the **Edit Cloudflare Workers** template.
3. Ensure account permissions:
   - `Account` > `Workers Scripts` > `Edit`
   - `Account` > `Workers KV Storage` > `Edit`
   - `Account` > `D1` > `Edit`
   - `Account` > `Workers R2 Storage` > `Edit`
   - `Zone` > `Workers Routes` > `Edit`
4. Update GitHub Actions Secret via GitHub CLI:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --body "<NEW_TOKEN>"
   ```
5. Trigger manual deployment workflow dispatch on staging to verify authentication:
   ```bash
   gh workflow run deploy.yml -f environment=staging
   ```
6. Once validated, delete the expired token in Cloudflare Dashboard.

---

## 4. Emergency Credential Revocation Protocol

In the event of suspected key exfiltration or developer workstation compromise:

1. **Immediate Revocation**:
   - Immediately delete or revoke the compromised key at the external provider console (Shopify, Resend, Cloudflare, Discord).
2. **Edge Overwrite**:
   - Immediately overwrite the Cloudflare Worker secret with a dummy value to sever rogue worker traffic:
     ```bash
     echo "REVOKED_$(date +%s)" | pnpm exec wrangler secret put <COMPROMISED_KEY> --env production
     ```
3. **Issue Replacement Key**:
   - Generate and upload fresh credentials following the procedures in Section 3.
4. **Audit Log Inspection**:
   - Review Cloudflare Audit Logs: Dashboard -> Manage Account -> Audit Log.
   - Review Shopify App access logs for unauthorized GraphQL API invocations.
5. **Post-Mortem Documentation**:
   - File an incident post-mortem ticket in GitHub Issues tagged `type:security`.

---

## 5. Secret Rotation Audit Log Template

Record every rotation event in the team incident / security log:

```markdown
### Secret Rotation Audit Record
- **Date & Time (UTC)**: YYYY-MM-DD HH:MM:SS
- **Operator**: <GitHub Handle / Engineer Name>
- **Target Secret**: PAYLOAD_SECRET / SHOPIFY_ADMIN_TOKEN / ...
- **Environment**: Staging / Production
- **Reason**: Scheduled 90-Day Rotation / Emergency Revocation
- **Health Verification Status**: PASS (HTTP 200 on /api/health)
- **Previous Token Revoked in Provider Console**: YES / NO
```
