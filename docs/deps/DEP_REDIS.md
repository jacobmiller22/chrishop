# Dependency Specification: Redis OSS (`DEP_REDIS.md`)

This document specifies the integration, persistence architecture, cache key namespaces, stock lock Lua script specifications, and operational commands for **Redis OSS**, which provides pre-checkout stock reservations and Directus caching for ChrisShop.

---

## 1. Service Overview & Architecture

- **Deployment**: Containerized Redis OSS (`redis:7-alpine`) running on host VPS.
- **Port**: `6379` (bound strictly to private Docker bridge network `chrishop-internal`; **never exposed on public network interfaces**).
- **Memory Allocation & Policy**:
  - `maxmemory 256mb`
  - `maxmemory-policy noeviction` (**CRITICAL**: Prevents silent eviction of active stock reservation locks).
- **Primary Roles**:
  1. **Pre-Checkout Stock Reservation Engine**: 10-minute atomic key locks preventing inventory overselling during checkout initiation.
  2. **Directus Storage & Asset Cache**: Directus asset transform caching (`STORAGE_CACHE_TTL=86400`).
  3. **Rate Limiting Engine**: IP-based request burst throttling.

---

## 2. Persistence Strategy (Append-Only File)

To ensure that stock reservations survive container restarts and system maintenance, Redis runs with **Append-Only File (AOF)** persistence:

```ini
# redis.conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

- **`appendfsync everysec`**: Fsyncs writes to disk once every second, providing optimal balance between microsecond throughput and catastrophic crash resilience.

---

## 3. Cache Key Namespaces & TTL Policies

| Key Pattern                               | Data Type        | TTL           | Purpose                                                             |
| ----------------------------------------- | ---------------- | ------------- | ------------------------------------------------------------------- |
| `reservation:{variation_id}:{session_id}` | String (Integer) | 600s (10 min) | Holds reserved stock quantity for an active Stripe Checkout session |
| `cache:catalog:products`                  | String (JSON)    | 60s           | Cached storefront catalog list                                      |
| `cache:catalog:product:{slug}`            | String (JSON)    | 60s           | Cached product detail response                                      |
| `ratelimit:{ip}:{endpoint}`               | String (Integer) | 60s           | Request counter for API rate limiting                               |
| `directus:storage:*`                      | Binary           | 86400s (24h)  | Directus image thumbnail transform cache                            |

---

## 4. Pre-Checkout Stock Lock Lua Script Specifications

To prevent race conditions during high-demand limited-edition drops, all stock reservations MUST execute atomically using a Redis Lua script.

### 4.1 Atomic Stock Reservation Lua Script (`reserve_stock.lua`)

```lua
-- KEYS[1]: variation_id (string)
-- KEYS[2]: session_id (string)
-- ARGV[1]: requested_qty (number)
-- ARGV[2]: current_db_stock (number)
-- ARGV[3]: ttl_seconds (number, e.g. 600)
-- Returns: 1 if reservation acquired, 0 if insufficient stock

local variation_id = KEYS[1]
local session_id = KEYS[2]
local requested_qty = tonumber(ARGV[1])
local current_db_stock = tonumber(ARGV[2])
local ttl_seconds = tonumber(ARGV[3])

-- Scan all existing active reservation keys for this variation
local pattern = "reservation:" .. variation_id .. ":*"
local keys = redis.call("KEYS", pattern)
local total_reserved = 0

for i = 1, #keys do
  -- Exclude current session in case of re-entrant checkout attempt
  if keys[i] ~= ("reservation:" .. variation_id .. ":" .. session_id) then
    local val = tonumber(redis.call("GET", keys[i]) or 0)
    total_reserved = total_reserved + val
  end
end

local available_stock = current_db_stock - total_reserved

if available_stock >= requested_qty then
  local target_key = "reservation:" .. variation_id .. ":" .. session_id
  redis.call("SET", target_key, requested_qty, "EX", ttl_seconds)
  return 1
else
  return 0
end
```

### 4.2 Atomic Stock Release Lua Script (`release_stock.lua`)

Executes upon Stripe webhook completion, customer checkout cancellation, or session expiration:

```lua
-- KEYS[1]: variation_id
-- KEYS[2]: session_id
-- Returns: 1 if deleted, 0 if key did not exist

local target_key = "reservation:" .. KEYS[1] .. ":" .. KEYS[2]
return redis.call("DEL", target_key)
```

---

## 5. Client Integration (`ioredis`)

In `apps/web`:

```typescript
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Execute atomic reservation
export async function reserveStock(
  variationId: string,
  sessionId: string,
  requestedQty: number,
  currentDbStock: number
): Promise<boolean> {
  const result = await redis.eval(
    RESERVE_STOCK_LUA,
    2,
    variationId,
    sessionId,
    requestedQty,
    currentDbStock,
    600 // 10 minutes TTL
  );
  return result === 1;
}
```

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                                  | Status      | Scheduled Story | Description                                         |
| ------------------------------------- | ----------- | --------------- | --------------------------------------------------- |
| `infra/docker/docker-compose.dev.yml` | `[EXISTS]`  | Phase 1         | Containerized Redis 7 service for local development |
| `apps/web/src/lib/redis.ts`           | `[PLANNED]` | Story 3.2       | Redis client and Lua script wrapper                 |
| `apps/web/tests/redis-lock.test.ts`   | `[PLANNED]` | Story 3.2       | Concurrency and lock expiration integration tests   |

---

## 7. Operational Testing & Commands

```bash
# Verify Redis responsiveness
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Check AOF persistence status
redis-cli -h localhost -p 6379 info persistence | grep aof_enabled
# Expected: aof_enabled:1

# List active reservation keys
redis-cli -h localhost -p 6379 --scan --pattern "reservation:*"

# Inspect TTL on specific reservation
redis-cli -h localhost -p 6379 ttl "reservation:<variation_id>:<session_id>"
```
