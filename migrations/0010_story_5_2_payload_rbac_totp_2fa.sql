-- Migration: 0010_story_5_2_payload_rbac_totp_2fa.sql
-- Story 5.2: Payload CMS RBAC & Mandatory TOTP 2FA Enforcement
-- Adds roles and TOTP 2FA security fields to the users collection

PRAGMA foreign_keys = OFF;

-- 1. Additive columns for RBAC and TOTP 2FA on the users table
ALTER TABLE users ADD COLUMN roles TEXT DEFAULT '["editor"]';
ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_verified_at TEXT;
ALTER TABLE users ADD COLUMN totp_backup_codes TEXT;

-- 2. Index for fast querying on 2FA status
CREATE INDEX IF NOT EXISTS users_totp_enabled_idx ON users (totp_enabled);

-- 3. Create users_roles subtable for relational SQLite adapters
CREATE TABLE IF NOT EXISTS users_roles (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS users_roles_order_idx ON users_roles (_order);
CREATE INDEX IF NOT EXISTS users_roles_parent_id_idx ON users_roles (_parent_id);
