# Comparative Evaluation: On-Call Paging & Incident Escalation Architecture

**Document**: `docs/analysis/ONCALL_PAGING_EVALUATION.md`  
**Story**: Story 4.17 (#169) — Incident Response & On-Call Paging Spike  
**Status**: `ACCEPTED`  
**Deciders**: Jacob Miller (Lead Architect & Platform Ops), Chris (Brand Owner & Creator)  
**Date**: 2026-09-22  

---

## 1. Executive Summary & Tooling Decision

During high-velocity YouTube merch drops, downtime or degraded checkout funnels directly translate into lost creator revenue, cart abandonment, and brand reputational damage. ChrisShop requires an automated on-call incident response and paging system capable of waking engineers across sleep cycles and bypassing mobile "Do Not Disturb" focus modes within **< 30 seconds** of critical failure.

We evaluated three candidate alerting and on-call platforms:
1. **PagerDuty** (Enterprise On-Call & Incident Management)
2. **Better Stack Incident / On-Call** (Specialized Developer On-Call & Synthetic Probing)
3. **Sentry Native Alerts** (Application Error & Metric Alerts)

### The Architectural Decision: **Better Stack Incident / On-Call (Primary) + Discord & Sentry (Secondary)**

We have decided to adopt **Better Stack Incident / On-Call** as our primary automated paging system:
- **Synergy with Story 4.7**: Better Stack already executes external synthetic health checks against `/api/health` every 60 seconds from global PoPs. Enabling on-call paging utilizes the existing monitor configuration without adding another SaaS vendor.
- **Critical Alert Capabilities**: Better Stack provides native iOS and Android apps with **Critical Alerts** permissions (bypassing phone Do Not Disturb and silent switches), automated international voice calling, and SMS delivery.
- **Cost Sustainability**: Better Stack On-Call is included or costs \$25/mo flat for the Starter tier, whereas PagerDuty begins at \$21-\$41 per user/month with strict voice/SMS credit caps.
- **Public Status Page**: Better Stack natively updates `status.chrishop.com` immediately upon incident acknowledgement, satisfying our customer communication requirement.
- **Multi-Channel Integration**: P0 critical events trigger Better Stack voice calls and SMS to Jacob, while simultaneously posting emergency alerts to Discord `#dev-alerts`. Sentry exception alerts are forwarded directly to Better Stack via webhook.

---

## 2. On-Call Tooling Comparative Matrix

| Evaluation Dimension | 1. PagerDuty Enterprise | 2. Better Stack Incident / On-Call (Selected) | 3. Sentry Native Alerts |
| :--- | :--- | :--- | :--- |
| **Voice Call Delivery Speed** | < 20 seconds | < 25 seconds | Not Supported |
| **SMS Delivery Speed** | < 15 seconds | < 15 seconds | Not Supported |
| **Mobile Do Not Disturb Bypass**| Supported (iOS Critical Alerts) | Supported (iOS Critical Alerts) | Supported (Mobile Push Only) |
| **Cloudflare Edge Health Integration**| Requires custom webhook router | Native (Story 4.7 `/api/health` probes) | Requires webhook forwarding |
| **Integrated Public Status Page** | Additional product (Statuspage.io)| Native built-in (`status.chrishop.com`)| Not Supported |
| **Base Cost (Solo / 2 Users)** | \$42.00 – \$82.00 / month | \$0.00 (Free) – \$25.00 / month | Included in Sentry Plan |
| **SMS/Voice Overage Risk** | High (strict tier credit limits) | Low (generous international quotas) | N/A |
| **Setup & Maintenance Overhead** | High (complex escalation trees) | Low (turnkey sync via REST API) | Low |
| **Recommendation Status** | **EVALUATED / REJECTED** | **SELECTED (PRIMARY ON-CALL)** | **SELECTED (EXCEPTION FEED)** |

---

## 3. Escalation Tier Hierarchy & Alerting Policies

To prevent alert fatigue while guaranteeing immediate escalation for revenue-impacting events, we define three strict severity tiers:

```
                          [Telemetric Anomaly Detected]
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             │                          │                          │
             ▼                          ▼                          ▼
     ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
     │  P0: CRITICAL │          │   P1: HIGH    │          │  P2: WARNING  │
     └───────────────┘          └───────────────┘          └───────────────┘
             │                          │                          │
             ▼                          ▼                          ▼
  • Voice Call + SMS         • Urgent Mobile Push       • Discord #dev-alerts
  • Bypass Do Not Disturb    • Discord @here Tag        • No Phone Paging
  • Repeats every 60s        • Auto-escalate (15m)      • Review next day
  • Auto-escalate (5m)                  │                          │
             │                          ▼                          │
             └──────────────► [Triage & Runbook] ◄─────────────────┘
```

### 3.1 P0 / Critical (Immediate Wake-Up & SMS Paging)
- **Delivery**: Automated telephone call + high-priority SMS + Discord `@everyone` tag.
- **SLA**: Engineer acknowledgement within **5 minutes**. If unacknowledged after 5 minutes, auto-escalates to secondary creator contact (Chris).
- **Trigger Conditions**:
  1. `/api/health` failing for 2 consecutive check cycles (60s).
  2. Edge HTTP 5xx error rate >= 2% of total traffic over a 2-minute rolling window.
  3. Shopify checkout handshake (`checkout.create` mutation) failures > 3 within 2 minutes.
  4. Cloudflare D1 database connection or query execution errors > 5 within 1 minute.

### 3.2 P1 / High (Urgent Push Notification & Discord `@here`)
- **Delivery**: Better Stack urgent mobile push notification + Discord emergency tag.
- **SLA**: Triage within **15 minutes**.
- **Trigger Conditions**:
  1. Edge p99 response latency > 2000ms over a 5-minute rolling window.
  2. Shopify webhook queue backlog > 50 messages or dead-letter threshold breached.
  3. Sudden Cloudflare WAF block rate surge (> 20% of all ingress traffic).

### 3.3 P2 / Warning (Passive Operational Log)
- **Delivery**: Formatted Discord embed to `#dev-alerts`. No phone/SMS waking.
- **SLA**: Next business day triage.
- **Trigger Conditions**:
  1. Sentry unhandled exception volume > 5 new issue groups.
  2. Workers KV cache hit ratio dropping below 70% for > 3 minutes.
  3. Minor transient upstream timeouts to non-critical external APIs.

---

## 4. Multi-Channel Escalation Architecture

1. **Better Stack On-Call Dispatcher**:
   - Manages on-call schedules, phone number routing, and acknowledgement state.
   - If an alert fires, Better Stack calls Jacob's registered mobile device.
   - Pressing `1` acknowledges the page and halts automated dialing.
2. **Discord `#dev-alerts` Webhook Channel**:
   - Every incident event posts an actionable embed containing:
     - Incident ID and severity badge
     - Direct link to Better Stack triage console
     - Link to [Incident Response Runbook (`docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md`)](file:///Users/jacobmiller22/projects/chrishop.feature-169-incident-response/docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md)
     - Immediate recommended remediation command
3. **Public Status Page Integration**:
   - P0 incidents automatically degrade the public status indicator at `status.chrishop.com` to "Major Outage" or "Degraded Performance".
   - Incident resolution automatically resets the status indicator to "All Systems Operational".

---

## 5. Acceptance Criteria Verification

- [x] Written evaluation report published at `docs/analysis/ONCALL_PAGING_EVALUATION.md`.
- [x] Comparative matrix completed across PagerDuty, Better Stack, and Sentry.
- [x] Objective P0, P1, and P2 threshold definitions formalized and mapped to Story 4.15 catalog.
- [x] TypeScript incident response engine implemented at `apps/web/src/lib/incident-response.ts`.
- [x] Turnkey operational incident response runbook committed at `docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md`.
