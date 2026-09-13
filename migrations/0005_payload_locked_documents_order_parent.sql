-- Migration 0005: Align payload_locked_documents_rels column mappings ("order", "parent_id") with Drizzle ORM
-- Story 3.1: Ensures Drizzle / Payload CMS document locking operations succeed on SQLite / Cloudflare D1

ALTER TABLE payload_locked_documents_rels ADD COLUMN "order" INTEGER;
ALTER TABLE payload_locked_documents_rels ADD COLUMN parent_id INTEGER;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_order_idx ON payload_locked_documents_rels ("order");
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_parent_idx ON payload_locked_documents_rels (parent_id);

-- Backfill any existing relation references
UPDATE payload_locked_documents_rels SET "order" = _order WHERE "order" IS NULL AND _order IS NOT NULL;
UPDATE payload_locked_documents_rels SET parent_id = _parent_id WHERE parent_id IS NULL AND _parent_id IS NOT NULL;
