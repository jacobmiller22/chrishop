#!/usr/bin/env bash
set -euo pipefail

# ChrisShop Cloudflare D1 Local Emulation & Migration Setup Script
#
# This script provisions and validates local Cloudflare D1 SQLite emulation
# powered by Miniflare under .wrangler/state/v3/d1 per docs/deps/DEP_CLOUDFLARE_D1.md.

DB_NAME="${1:-chrishop-prod-db}"

echo "================================================================"
echo "  🚀 ChrisShop Local Cloudflare D1 Setup & Emulation Harness   "
echo "================================================================"
echo "Target Database: ${DB_NAME}"
echo "Local State Directory: .wrangler/state/v3/d1"
echo ""

# 1. Verify wrangler CLI is installed
if ! command -v pnpm &> /dev/null; then
  echo "❌ Error: pnpm is required but not found in PATH."
  exit 1
fi

echo "▶ 1. Applying initial D1 migrations locally..."
pnpm exec wrangler d1 migrations apply "${DB_NAME}" --local

echo ""
echo "▶ 2. Verifying database tables and query indexes..."
pnpm exec wrangler d1 execute "${DB_NAME}" --local --command "
  SELECT type, name FROM sqlite_master 
  WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'
  ORDER BY type, name;
"

echo ""
echo "▶ 3. Executing D1 schema and index integrity validation query..."
pnpm exec wrangler d1 execute "${DB_NAME}" --local --command "
  SELECT 
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('categories', 'products', 'product_variations')) AS table_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name IN ('idx_products_slug', 'idx_products_shopify_id', 'idx_product_variations_sku', 'idx_product_variations_product_id', 'idx_categories_slug')) AS index_count;
"

echo ""
echo "✅ Cloudflare D1 local emulation is operational and up-to-date!"
