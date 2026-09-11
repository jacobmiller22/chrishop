# Dependency Specification: Resend Email API (`DEP_RESEND.md`)

This document specifies the integration architecture, sender domain authentication, email payload schemas, HTML template designs, rate limiting, and testing procedures for **Resend**, the transactional email provider for ChrisShop.

---

## 1. Service Overview & Architecture

- **Provider**: Resend, Inc. (`https://resend.com`)
- **SDK**: `resend` Node.js SDK (`pnpm add resend`)
- **Integration Layer**: `packages/notifications`
- **Primary Use Cases**:
  1. **Order Confirmation Receipts**: Dispatched immediately upon Shopify checkout completion (`orders@shop.jacobmiller22.com`).
  2. **Shipping & Carrier Tracking Notifications**: Dispatched when an order is fulfilled (`fulfillment@shop.jacobmiller22.com`).
- **Local Dev Mock**: When `RESEND_API_KEY` is undefined, `packages/notifications` outputs formatted emails to `stdout` via `ConsoleNotificationProvider` without network calls.

---

## 2. Sender Domain Verification & DNS Records

To guarantee high inbox deliverability and prevent spoofing, the following DNS records must be configured in Cloudflare:

| Record Type | Hostname / Name     | Value / Target                                              | Proxy Status        | Rationale                         |
| ----------- | ------------------- | ----------------------------------------------------------- | ------------------- | --------------------------------- |
| `CNAME`     | `resend._domainkey` | `dkim.resend.com`                                           | **DNS-Only (Grey)** | Cryptographic DKIM email signing  |
| `TXT`       | `@` (or `shop`)     | `v=spf1 include:amazonses.com ~all`                         | **DNS-Only (Grey)** | Sender Policy Framework (SPF)     |
| `TXT`       | `_dmarc`            | `v=DMARC1; p=none; rua=mailto:dmarc@shop.jacobmiller22.com` | **DNS-Only (Grey)** | DMARC policy & delivery reporting |
| `MX`        | `feedback`          | `feedback-smtp.us-east-1.amazonses.com` (Priority 10)       | **DNS-Only (Grey)** | Bounce and complaint processing   |

Domain verification is verified via Resend API:

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
const domain = await resend.domains.get('<domain_id>');
console.log(domain.status); // Expected: "verified"
```

---

## 3. Email Notification Payload Schemas

### 3.1 Order Confirmation Payload Schema

```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "order_number": "#1042",
  "customer_name": "Jane Doe",
  "customer_email": "jane@example.com",
  "items": [
    {
      "title": "Midnight Sculpture",
      "variation_name": "Gold Edition",
      "sku": "MS-GOLD-01",
      "quantity": 1,
      "unit_price": 150.0
    }
  ],
  "amount_subtotal": 150.0,
  "amount_shipping": 15.0,
  "amount_tax": 12.38,
  "amount_total": 177.38,
  "shipping_address": {
    "street": "123 Art Gallery Way",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "created_at": "2026-09-10T17:00:00.000Z"
}
```

### 3.2 Shipping & Tracking Notification Payload Schema

```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "order_number": "#1042",
  "customer_name": "Jane Doe",
  "customer_email": "jane@example.com",
  "carrier": "USPS",
  "tracking_number": "9400100000000000000000",
  "tracking_url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
  "items": [
    {
      "title": "Midnight Sculpture",
      "variation_name": "Gold Edition",
      "quantity": 1
    }
  ]
}
```

---

## 4. Email Template Specifications

Templates are built using responsive HTML with accessible high-contrast inline styling:

### 4.1 Order Receipt Template Layout:

- **Header**: Minimalist ChrisShop brand wordmark.
- **Hero**: `Thank you for your order, Jane!`
- **Order Summary**: Line item breakdown, SKU, edition information, subtotal, tax, and total.
- **Shipping Destination**: Formatted address card.
- **Footer**: Support contact (`support@shop.jacobmiller22.com`).

### 4.2 Shipping Tracking Template Layout:

- **Header**: Minimalist ChrisShop brand wordmark.
- **Hero**: `Your order #1042 is on the way! 📦`
- **Carrier Details**: Carrier name (`USPS`), Tracking number (`9400...`).
- **Primary CTA**: Styled button linking directly to carrier tracking URL:
  ```html
  <a
    href="{{tracking_url}}"
    style="background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;"
  >
    Track Your Package
  </a>
  ```
- **Plain-Text Alternative**: All emails MUST include an RFC-compliant plain-text version for accessibility and spam score mitigation.

---

## 5. Rate Limiting, Retry Logic & Resilience

- **Resend API Rate Limits**:
  - Free Tier: 2 requests / second.
  - Production Tier: 100 requests / second.
- **Retry Mechanism**: The `packages/notifications` engine implements exponential backoff with jitter for HTTP 429 (Rate Limit) and 5xx responses:
  - Base delay: 500ms
  - Max retries: 3 attempts
  - Jitter factor: $\pm 20\%$

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                                             | Status      | Scheduled Story | Description                                             |
| ------------------------------------------------ | ----------- | --------------- | ------------------------------------------------------- |
| `packages/notifications/src/index.ts`            | `[EXISTS]`  | Phase 1         | Canonical notification provider interfaces              |
| `packages/notifications/src/providers/resend.ts` | `[PLANNED]` | Story 3.2       | Resend provider implementation                          |
| `packages/notifications/src/templates/`          | `[PLANNED]` | Story 3.2       | HTML and plaintext email templates                      |
| `packages/notifications/tests/email.test.ts`     | `[PLANNED]` | Story 3.2       | Unit tests for email generation and SDK payload mocking |

---

## 7. Operational Testing & Verification

```bash
# Verify Resend API connection and domain verification status
node -e "
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  resend.domains.list().then(console.log);
"

# Run notifications test suite
pnpm --filter notifications test
```
