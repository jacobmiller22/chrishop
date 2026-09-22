import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Products,
  MATERIAL_PRESET_MAP,
  MATERIAL_PRESET_OPTIONS,
  FIT_PROFILE_OPTIONS,
} from '../src/collections/Products';
import {
  ProductVariations,
  deriveEditionBadge,
} from '../src/collections/ProductVariations';

describe('Story 3.19: Catalog Schema Capability Reconciliation & Ergonomics', () => {
  describe('Products Schema & Controlled Vocabularies', () => {
    it('prunes redundant artist_statement field from schema while preserving maker_field_notes', () => {
      const fieldNames = (Products.fields as any[]).map((f) => f.name);
      assert.ok(!fieldNames.includes('artist_statement'), 'artist_statement must be pruned from Products schema');
      assert.ok(fieldNames.includes('maker_field_notes'), 'maker_field_notes must be preserved');
      assert.ok(fieldNames.includes('material_preset'), 'material_preset must be present in Products schema');
    });

    it('exposes standard BankBeaters technical textile presets in MATERIAL_PRESET_MAP', () => {
      assert.ok(MATERIAL_PRESET_MAP.toray_cordura.includes('Toray'));
      assert.ok(MATERIAL_PRESET_MAP.stretch_cordura.includes('4-Way Stretch'));
      assert.ok(MATERIAL_PRESET_MAP.xpac_vx21.includes('X-Pac® VX21'));
      assert.ok(MATERIAL_PRESET_MAP.cordura_eva.includes('500D Mil-Spec Cordura®'));
      assert.ok(MATERIAL_PRESET_MAP.martexin_blaze.includes('12oz Martexin'));
      assert.ok(MATERIAL_PRESET_MAP.waxed_eva.includes('Waxed Cotton'));
      assert.ok(MATERIAL_PRESET_MAP.dyneema_composite.includes('Dyneema®'));

      // Ensure every preset has a corresponding option in MATERIAL_PRESET_OPTIONS
      for (const key of Object.keys(MATERIAL_PRESET_MAP)) {
        assert.ok(
          MATERIAL_PRESET_OPTIONS.some((opt) => opt.value === key),
          `Option for ${key} must exist in MATERIAL_PRESET_OPTIONS`
        );
      }
    });

    it('exposes controlled fit profiles in FIT_PROFILE_OPTIONS', () => {
      const values = FIT_PROFILE_OPTIONS.map((o) => o.value);
      assert.ok(values.some((v) => v.includes('Technical Straight')));
      assert.ok(values.some((v) => v.includes('Relaxed Athletic')));
      assert.ok(values.some((v) => v.includes('Harness')));
      assert.ok(values.some((v) => v.includes('Sling')));
      assert.ok(values.some((v) => v.includes('Tri-Fold')));
      assert.ok(values.some((v) => v.includes('5-Panel')));
    });

    it('beforeChange hook auto-populates materials when material_preset is selected and materials is blank', async () => {
      const beforeChangeHook = Products.hooks?.beforeChange?.[0];
      assert.ok(typeof beforeChangeHook === 'function', 'beforeChange hook must be defined on Products');

      const mockData = {
        title: 'New Storm Anorak',
        material_preset: 'toray_cordura',
        materials: '',
      };

      const result = await beforeChangeHook({
        data: mockData,
        req: {} as any,
        operation: 'create',
      } as any);

      assert.equal(
        result.materials,
        MATERIAL_PRESET_MAP.toray_cordura,
        'materials should be auto-filled from preset map'
      );
    });

    it('beforeChange hook preserves custom materials when explicitly entered by maker', async () => {
      const beforeChangeHook = Products.hooks?.beforeChange?.[0];
      assert.ok(typeof beforeChangeHook === 'function');

      const customSpec = 'Custom 70D Diamond Ripstop with Titanium Hardware';
      const mockData = {
        title: 'Experimental Rig',
        material_preset: 'custom',
        materials: customSpec,
      };

      const result = await beforeChangeHook({
        data: mockData,
        req: {} as any,
        operation: 'create',
      } as any);

      assert.equal(result.materials, customSpec, 'Custom materials spec should never be overwritten');
    });
  });

  describe('ProductVariations Smart Edition Badges', () => {
    it('deriveEditionBadge returns correct badge tag for each variation type', () => {
      assert.equal(deriveEditionBadge('one_of_one'), '1-of-1 Prototype');
      assert.equal(deriveEditionBadge('micro_batch', 5), 'Only 5 Crafted');
      assert.equal(deriveEditionBadge('micro_batch', 0), 'Limited Micro-Batch');
      assert.equal(deriveEditionBadge('micro_batch', null), 'Limited Micro-Batch');
      assert.equal(deriveEditionBadge('prototype'), 'Archive Sample');
      assert.equal(deriveEditionBadge('standard'), 'Standard Production');
      assert.equal(deriveEditionBadge(null), 'Standard Production');
    });

    it('beforeChange hook auto-derives edition_badge when omitted', async () => {
      const beforeChangeHook = ProductVariations.hooks?.beforeChange?.[0];
      assert.ok(typeof beforeChangeHook === 'function', 'beforeChange hook must be defined on ProductVariations');

      const mockData = {
        variation_name: 'Deadstock Camo Edition',
        variation_type: 'micro_batch',
        total_edition_count: 3,
        edition_badge: '',
      };

      const result = await beforeChangeHook({
        data: mockData,
        req: {} as any,
        operation: 'create',
      } as any);

      assert.equal(result.edition_badge, 'Only 3 Crafted');
    });

    it('beforeChange hook respects explicit custom edition_badge', async () => {
      const beforeChangeHook = ProductVariations.hooks?.beforeChange?.[0];
      assert.ok(typeof beforeChangeHook === 'function');

      const customBadge = 'Founders Edition No. 1';
      const mockData = {
        variation_name: 'Commemorative Edition',
        variation_type: 'micro_batch',
        total_edition_count: 5,
        edition_badge: customBadge,
      };

      const result = await beforeChangeHook({
        data: mockData,
        req: {} as any,
        operation: 'create',
      } as any);

      assert.equal(result.edition_badge, customBadge, 'Explicit custom badge should be preserved');
    });
  });

  describe('D1 SQLite Migration 0007 Reconcile Execution', () => {
    it('successfully applies migration 0007 and migrates legacy data', () => {
      const db = new DatabaseSync(':memory:');

      // Create pre-migration products table with artist_statement
      db.exec(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL,
          maker_field_notes TEXT,
          artist_statement TEXT,
          materials TEXT
        );
      `);

      // Insert mock rows representing legacy schema state
      const insertStmt = db.prepare(`
        INSERT INTO products (id, title, slug, maker_field_notes, artist_statement, materials)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run('prod-1', 'Legacy Shell', 'legacy-shell', null, 'Original artist statement text', '3-Layer DWR Toray Ripstop');
      insertStmt.run('prod-2', 'Pack with Both', 'pack-both', 'Existing maker notes', 'Ignored statement', 'Waterproof X-Pac VX21');
      insertStmt.run('prod-3', 'No Statement', 'no-statement', 'Only notes here', null, '12oz Martexin Original Waxed Canvas');

      // Read and execute migration 0007
      const migrationPath = fileURLToPath(
        new URL('../../../migrations/0007_story_3_19_catalog_schema_reconciliation.sql', import.meta.url)
      );
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      db.exec(migrationSql);

      // Verify migration outcomes
      const getStmt = db.prepare('SELECT * FROM products WHERE id = ?');
      const prod1: any = getStmt.get('prod-1');
      assert.equal(prod1.maker_field_notes, 'Original artist statement text', 'artist_statement migrated to maker_field_notes');
      assert.equal(prod1.material_preset, 'toray_cordura', 'material_preset backfilled from materials pattern');

      const prod2: any = getStmt.get('prod-2');
      assert.equal(prod2.maker_field_notes, 'Existing maker notes', 'Existing maker notes preserved');
      assert.equal(prod2.material_preset, 'xpac_vx21', 'material_preset backfilled for X-Pac');

      const prod3: any = getStmt.get('prod-3');
      assert.equal(prod3.maker_field_notes, 'Only notes here');
      assert.equal(prod3.material_preset, 'martexin_blaze', 'material_preset backfilled for Martexin');

      db.close();
    });
  });
});
