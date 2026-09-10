# Dependency Specification: Redis OSS (`DEP_REDIS.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for **Redis OSS**, providing zero-cost in-memory stock reservation locks and Directus asset transform caching.

---

## 1. Service Overview & Architecture

- **Deployment**: Containerized Redis OSS (`redis:7-alpine`) running on VPS host.
- **Persistence Strategy**: **Append-Only File (AOF)** enabled (`appendonly yes`) with 1-second sync (`appendfsync everysec`) to ensure reservation durability across container restarts.
- **Primary Use Cases**:
  1. **Pre-Checkout Stock Reservation Engine**: 10-minute TTL key lock preventing overselling during checkout initiation.
  2. **Directus Storage Cache**: Redis asset transform caching (`STORAGE_CACHE_TTL=86400`).

---

## 2. Interaction Tools & Interfaces

- **Client SDK**: `ioredis` (`pnpm add ioredis`)
- **CLI Tool**: `redis-cli` (`redis-cli -h localhost -p 6379`)
- **Container Exec**: `docker exec -it chrishop-redis redis-cli ping`

---

## 3. Pre-Checkout Lock Mechanics

1. **Reservation Key Format**: `reservation:{variation_id}:{session_id}`
2. **TTL Duration**: 600 seconds (10 minutes matching Stripe Checkout session duration).
3. **Available Stock Formula**:
   $$\text{Available Stock} = \text{DB.stock\_quantity} - \sum (\text{Active Redis Key Reservations})$$
4. **Key Expiration**: Automatically releases locked unit if customer abandons checkout session.
5. **Successful Payment**: Stripe webhook deletes key immediately after executing atomic SQL inventory decrement.

---

## 4. Integration Tests & Commands

- **Ping Check**: `redis-cli ping` (Expected: `PONG`)
- **Lock Key Expiration Unit Test**: Verify Redis key automatically disappears after 10-minute TTL or explicit deletion.
