-- Migration: 0007_story_3_19_catalog_schema_reconciliation.sql
-- Reconciles catalog schema: adds material_preset, preserves maker_field_notes, prunes redundant artist_statement

PRAGMA foreign_keys = OFF;

-- 1. Preserve any legacy artist_statement by migrating to maker_field_notes if null
UPDATE products
SET maker_field_notes = artist_statement
WHERE (maker_field_notes IS NULL OR maker_field_notes = '')
  AND (artist_statement IS NOT NULL AND artist_statement != '');

-- 2. Add material_preset controlled vocabulary column to products
ALTER TABLE products ADD COLUMN material_preset TEXT;

-- 3. Populate default material_preset where materials match standard textiles
UPDATE products SET material_preset = 'toray_cordura' WHERE materials LIKE '%Toray%';
UPDATE products SET material_preset = 'stretch_cordura' WHERE materials LIKE '%Stretch%Ripstop%' OR materials LIKE '%1000D Cordura%Knee%';
UPDATE products SET material_preset = 'xpac_vx21' WHERE materials LIKE '%X-Pac%' OR materials LIKE '%VX21%';
UPDATE products SET material_preset = 'cordura_eva' WHERE materials LIKE '%500D Mil-Spec%' AND materials LIKE '%EVA%';
UPDATE products SET material_preset = 'martexin_blaze' WHERE materials LIKE '%Martexin%';
UPDATE products SET material_preset = 'waxed_eva' WHERE materials LIKE '%Waxed Cotton%' AND materials LIKE '%EVA%';
UPDATE products SET material_preset = 'dyneema_composite' WHERE materials LIKE '%Dyneema%';

CREATE INDEX IF NOT EXISTS products_material_preset_idx ON products (material_preset);
