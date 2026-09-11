# Dependency Specification: Discord Notification Engine (`DEP_DISCORD.md`)

This document specifies the integration architecture, Discord webhook payload schemas, channel routing matrix, rate limiting, and operational testing procedures for the **Discord Notification Engine** in ChrisShop.

---

## 1. Service Overview & Architecture

- **Provider**: Discord Webhook & REST API
- **Module Path**: `packages/notifications`
- **Primary Use Cases**:
  - Immediate operational notifications for new customer orders.
  - Low-stock and sold-out alerts for limited-edition inventory drops.
  - Developer and infrastructure alerts (system health checks, deployment events, Sentry errors).
- **Security**: Webhook URLs are managed as encrypted secrets (`DISCORD_WEBHOOK_ORDERS`, `DISCORD_WEBHOOK_ALERTS`) and injected into runtime environments.

---

## 2. Channel Architecture & Alert Routing Matrix

Notifications are segregated into two distinct Discord channels:

| Channel         | Triggering Event                                       | Embed Color                      | Urgency / Action                     |
| --------------- | ------------------------------------------------------ | -------------------------------- | ------------------------------------ |
| `#store-orders` | Shopify Order Placed (`orders/create` webhook) | Green (`0x2ECC71` / `3066993`)   | Order packing & fulfillment prep     |
| `#store-orders` | Low Stock Warning (`stock_quantity <= 3`)              | Yellow (`0xF1C40F` / `15844367`) | Stock monitoring & drop wrap-up      |
| `#store-orders` | Drop Sold Out (`stock_quantity == 0`)                  | Orange (`0xE67E22` / `15105570`) | Verify sold-out banner on storefront |
| `#dev-alerts`   | Health Check Failure (`/api/health` status $\ne 200$)  | Red (`0xE74C3C` / `15158332`)    | Immediate on-call inspection         |
| `#dev-alerts`   | Uncaught Application Exception (Sentry)                | Purple (`0x9B59B6` / `10181046`) | Debug crash trace                    |
| `#dev-alerts`   | PR Preview / Production Deployment Complete            | Blue (`0x3498DB` / `3447003`)    | Informational                        |

---

## 3. Discord Webhook Payload Schema

Payloads sent to Discord use the standard Rich Embed schema:

```json
{
  "username": "ChrisShop Ops",
  "avatar_url": "https://shop.jacobmiller22.com/brand/avatar.png",
  "embeds": [
    {
      "title": "🛒 New Order #1042",
      "description": "Order successfully placed via Shopify Headless Checkout.",
      "color": 3066993,
      "fields": [
        {
          "name": "Customer",
          "value": "Jane Doe (`jane@example.com`)",
          "inline": true
        },
        {
          "name": "Total Amount",
          "value": "**$177.38 USD**",
          "inline": true
        },
        {
          "name": "Item(s)",
          "value": "• 1x **Midnight Sculpture** (Gold Edition) — SKU: `MS-GOLD-01`",
          "inline": false
        },
        {
          "name": "Shipping Destination",
          "value": "New York, NY 10001, US",
          "inline": false
        }
      ],
      "timestamp": "2026-09-10T17:00:00.000Z",
      "footer": {
        "text": "ChrisShop Order Management"
      }
    }
  ]
}
```

### Low Stock Alert Payload Example:

```json
{
  "username": "ChrisShop Ops",
  "embeds": [
    {
      "title": "⚠️ Low Stock Alert: Midnight Sculpture",
      "description": "Inventory threshold reached for limited-edition release.",
      "color": 15844367,
      "fields": [
        {
          "name": "Variation",
          "value": "Gold Edition (`MS-GOLD-01`)",
          "inline": true
        },
        {
          "name": "Remaining Stock",
          "value": "**2 units left**",
          "inline": true
        }
      ],
      "timestamp": "2026-09-10T17:05:00.000Z"
    }
  ]
}
```

---

## 4. Rate Limiting & Resilience

- **Discord Webhook Limits**: 5 requests every 2 seconds per webhook URL.
- **Header Inspection**:
  - `X-RateLimit-Limit`: Maximum requests allowed in current window.
  - `X-RateLimit-Remaining`: Remaining request allowance.
  - `X-RateLimit-Reset-After`: Wait duration in seconds when throttled (HTTP 429).
- **Queueing Implementation**:
  - `packages/notifications` buffers outgoing alerts in an asynchronous in-memory FIFO queue with an internal 250ms dispatch gate.
  - If HTTP 429 is encountered, the worker pauses queue processing for `X-RateLimit-Reset-After + 0.1` seconds before retrying.

---

## 5. Reconciled Configuration Files & Monorepo Paths

| Path                                              | Status      | Scheduled Story | Description                                          |
| ------------------------------------------------- | ----------- | --------------- | ---------------------------------------------------- |
| `packages/notifications/src/index.ts`             | `[EXISTS]`  | Phase 1         | NotificationProvider interface definitions           |
| `packages/notifications/src/providers/discord.ts` | `[PLANNED]` | Story 3.2       | Discord webhook notification provider                |
| `packages/notifications/tests/discord.test.ts`    | `[PLANNED]` | Story 3.2       | Webhook payload formatting and rate-limit test suite |

---

## 6. Operational Testing & CLI Verification

```bash
# Manual Webhook Test via curl
curl -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "username": "ChrisShop Ops",
    "embeds": [{
      "title": "🔔 Test Webhook Ping",
      "description": "Verifying Discord notifications integration.",
      "color": 3447003
    }]
  }' \
  "${DISCORD_WEBHOOK_ALERTS}"

# Run notifications test suite
pnpm --filter notifications test
```
