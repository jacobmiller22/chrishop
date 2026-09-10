# Dependency Specification: Resend Email API (`DEP_RESEND.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for **Resend**, providing transactional email delivery for order receipts and carrier shipment tracking notifications.

---

## 1. Service Overview & Architecture

- **Provider**: Resend Email API (`https://resend.com`)
- **Domain Verification**: Custom DNS DKIM/SPF records verified on `chrishop.com`.
- **Primary Use Cases**:
  - Customer Order Receipts (`receipt@chrishop.com`)
  - Carrier Shipping & Tracking Notifications (`fulfillment@chrishop.com`)
- **Local Dev Mock**: Console / Log provider fallback when `RESEND_API_KEY` is omitted.

---

## 2. Interaction Tools & Interfaces

- **Node.js SDK**: `resend` SDK (`pnpm add resend`)
- **Dashboard**: Resend Dashboard UI (`https://resend.com/overview`)
- **Directus Extension**: Custom Directus action hook calling Resend API upon shipping update.

---

## 3. Email Template Specs

### Shipping Tracking Notification Template:

- **Subject**: `Your ChrisShop order #{order_number} has shipped! 📦`
- **Body HTML**: Includes customer name, items ordered, carrier name (USPS, UPS, FedEx), clickable carrier tracking URL (`tracking_url`), and customer support contact details.

---

## 4. Integration Tests & Health Checks

- **Domain Status Check**: Verify DKIM/SPF verification status via Resend API (`resend.domains.get()`).
- **Transactional Test Email**: `pnpm --filter notifications test:email` sending test message to verified test address.
