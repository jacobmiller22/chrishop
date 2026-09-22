# Incident Response & On-Call Operational Runbook

**File**: `docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md`  
**Story**: Story 4.17 (#169) — Incident Response & On-Call Paging Spike  
**Author**: Jacob Miller (Lead Architect & Platform Ops)  
**Last Updated**: 2026-09-22  
**Target Environments**: Staging & Production (`chrishop.jacobmiller22.com`)  

---

## 1. Scope & Escalation Hierarchy

This runbook dictates the standard operating procedures when an automated on-call page is dispatched by **Better Stack Incident / On-Call**. All engineers and stakeholders must adhere to this protocol during production outages or service degradations.

### On-Call Escalation Matrix

```
                      ┌────────────────────────────────────────┐
                      │    CRITICAL TELEMETRY BREACH (P0)      │
                      └────────────────────────────────────────┘
                                           │
                        [Better Stack On-Call Triggers]
                                           │
                                           ▼
                      ┌────────────────────────────────────────┐
                      │ PRIMARY ON-CALL: Jacob Miller          │
                      │ Phone Call + SMS + iOS Critical Alert  │
                      └────────────────────────────────────────┘
                                           │
                         [Unacknowledged in 5 Minutes?]
                                           ├── YES ──► Escalates to Chris (Creator Contact)
                                           ▼
                                          NO
                                           │
                                           ▼
                               [Triage & Execute Runbook]
```

| Role | Contact | Escalation Channel | SLA |
| :--- | :--- | :--- | :--- |
| **Primary On-Call** | Jacob Miller (Lead Ops) | Better Stack Voice Call + SMS + Discord | **< 5 minutes** |
| **Secondary Contact** | Chris (Brand Owner) | Phone Call + WhatsApp | **< 10 minutes** |
| **Incident War Room** | Platform & Ops Team | Discord Channel: `#dev-alerts` | Real-time |

---

## 2. Step-by-Step Triage Protocol When Paged

### Step 1: Immediate Acknowledge (< 5 minutes)
1. **Answer Voice Call**: Press `1` on mobile phone keypad to acknowledge the incident.
2. **Or Open Better Stack Mobile App**: Tap "Acknowledge Incident" button.
3. *Why this matters*: Acknowledging halts automated redialing and prevents escalation to secondary contacts.

### Step 2: Open Incident War Room
1. Post immediate status to Discord `#dev-alerts`:
   ```text
   🚨 [INCIDENT TRIAGE] Acknowledging incident INC-<id>. Investigating now.
   ```
2. Verify public status page has transitioned to "Investigating" at `https://status.chrishop.com`.

### Step 3: Fast-Path Health Probe & Root-Cause Isolation (< 3 minutes)
Run external probe directly from terminal:
```bash
curl -sS -i https://chrishop.jacobmiller22.com/api/health
```

Inspect output headers:
- `HTTP/2 200`: Edge is up; issue may be upstream checkout or background queue.
- `HTTP/2 500 / 502 / 503`: Edge runtime error or D1 database crash.
- `Connection Timeout`: DNS resolution or Cloudflare Anycast route failure.

Inspect Sentry real-time exception stream:
```bash
pnpm run sentry:verify
```

---

## 3. Immediate Mitigation Playbooks

### Playbook A: Bad Deployment / Worker Edge Crash (P0)
**Symptoms**: `/api/health` returning 500, edge 5xx rate > 2%, or immediate regression following a production release.

**Mitigation Action**: Execute Cloudflare Workers Instant Rollback (Story 4.5).
```bash
# 1. Trigger automated GitHub Actions rollback workflow
gh workflow run rollback.yml -f environment=production -f reason="Emergency rollback: 5xx spike after deployment"

# 2. Or execute instant rollback CLI locally
pnpm run deploy:prod --rollback
```

Verify edge recovery:
```bash
pnpm run uptime:verify
```

---

### Playbook B: Cloudflare D1 Database Contention / Lockup (P0)
**Symptoms**: `d1_errors_count > 5/min`, SQL statement timeouts, or database connection failures.

**Mitigation Action**:
1. Check migration state and binding status:
   ```bash
   pnpm run d1:migrate
   ```
2. Toggle storefront to **Emergency Read-Only Catalog Cache**:
   - Storefront will serve cached product details and drop countdown from Workers KV.
   - Disables live checkout mutations until D1 connection pool stabilizes.

---

### Playbook C: Shopify Checkout Handshake Failure (P0)
**Symptoms**: Cart creation or checkout redirect failing > 3 times; Shopify Admin API rate limited or offline.

**Mitigation Action**:
1. Verify Shopify Storefront API credentials:
   ```bash
   pnpm run verify:shopify
   ```
2. Activate **Drop Room Queue Buffer**:
   - Throttle checkout redirects to 50 carts/minute to respect Shopify API rate limits.
   - Shoppers receive friendly "Securing Your Order in Queue" waiting room page.

---

### Playbook D: Distributed Bot Attack or Turnstile Bypass (P1)
**Symptoms**: WAF block rate > 20%, Turnstile pass ratio < 50%, suspicious traffic floods.

**Mitigation Action**:
1. Verify WAF edge rules:
   ```bash
   pnpm run waf:verify
   ```
2. Elevate Cloudflare WAF Security Level:
   - In Cloudflare Dashboard, toggle Security Level to **"Under Attack"** mode for `/checkout` and `/api/cart`.

---

## 4. Communication Runbook: Status Page & Creator Notifications

### 4.1 Updating Better Stack Public Status Page
When triage confirms user-facing impact, update `status.chrishop.com`:
```bash
# Synchronize or post status update
pnpm run uptime:sync --status="investigating" --message="We are currently investigating elevated latency on product pages."
```

### 4.2 Communicating with Chris (Brand Owner)
During live merch drops, send direct update via Discord / SMS:
> *"Chris — Heads up: we noticed elevated checkout errors on the drop page. Jacob is actively mitigating (activating queue buffer / rolling back edge). Shoppers will see a queue screen. Will update you in 5 minutes."*

Upon Resolution:
> *"Chris — All systems fully resolved and verified green. Storefront checkout is 100% operational. Total impact window was 4 minutes."*

---

## 5. Post-Incident Review (PIR) Procedure

Within 24 hours of any P0 incident:
1. Conduct blameless retrospective with engineering.
2. File PIR document in `docs/postmortems/YYYY-MM-DD-incident-title.md`.
3. Create GitHub follow-up issues for preventative guardrails and automated tests.
