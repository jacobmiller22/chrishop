import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  fetchProducts,
  fetchProductBySlug,
  fetchCategories,
  setDatabase,
  resetDatabase,
  type StorefrontProduct,
  type Category,
  type D1DatabaseLike,
} from '../../apps/web/src/lib/catalog';
import {
  getCatalogRevalidationHistory,
  clearCatalogRevalidationHistory,
  type CatalogRevalidationEvent,
} from '../../apps/web/src/collections/hooks/revalidateCatalog';

// Ensure CJS/ESM interop for @next/env under tsx/esbuild
try {
  const nextEnv = require('../../apps/web/node_modules/@next/env');
  if (nextEnv && !nextEnv.default) {
    nextEnv.default = nextEnv;
  }
} catch {}

export interface TestHarnessProductInput {
  id: string;
  title: string;
  slug: string;
  base_price: number;
  price?: number;
  category: string;
  category_id?: string;
  status: 'draft' | 'active' | 'archived';
  description?: any;
  maker_field_notes?: string;
  materials?: string;
  weight?: string;
  fit_profile?: string;
  options?: Array<{ name: string; value: string; sku_suffix: string }>;
}

export interface TestHarnessVariationInput {
  id: string;
  variation_name: string;
  sku: string;
  product_id: string;
  variation_type?: 'standard' | 'micro_batch' | 'one_of_one' | 'prototype';
  edition_badge?: string;
  variation_notes?: string;
  price_override?: number;
  stock_quantity?: number;
  is_limited_edition?: boolean;
  total_edition_count?: number;
  status?: 'active' | 'sold_out' | 'archived' | 'coming_soon';
}

export interface TestHarnessCategoryInput {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
}

export interface PayloadStorefrontHarness {
  db: DatabaseSync;
  mockD1: D1DatabaseLike;
  payload: any;
  createdCategoryIds: Set<string>;
  createdProductIds: Set<string>;
  createdVariationIds: Set<string>;
  createCategory(data: TestHarnessCategoryInput): Promise<any>;
  createProduct(data: TestHarnessProductInput): Promise<any>;
  createVariation(data: TestHarnessVariationInput): Promise<any>;
  updateProduct(id: string, data: Partial<TestHarnessProductInput>): Promise<any>;
  updateVariation(id: string, data: Partial<TestHarnessVariationInput>): Promise<any>;
  deleteProduct(id: string): Promise<any>;
  deleteCategory(id: string): Promise<any>;
  queryStorefrontProduct(slug: string): Promise<StorefrontProduct | null>;
  queryStorefrontProducts(options?: { categorySlug?: string; limit?: number }): Promise<StorefrontProduct[]>;
  queryStorefrontCategories(): Promise<Category[]>;
  getRevalidationHistory(): CatalogRevalidationEvent[];
  clearRevalidationHistory(): void;
  teardown(): Promise<void>;
}

export function createMockD1(db: DatabaseSync): D1DatabaseLike {
  return {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          return {
            all: async () => ({ results: db.prepare(sql).all(...params), success: true }),
            first: async () => db.prepare(sql).get(...params) || null,
            get: async () => db.prepare(sql).get(...params) || null,
            run: async () => {
              const res = db.prepare(sql).run(...params);
              return { success: true, meta: { changes: (res as any).changes } };
            },
            raw: async () => db.prepare(sql).all(...params).map((r: any) => Object.values(r)),
          };
        },
        all: async (...params: any[]) => ({ results: db.prepare(sql).all(...params), success: true }),
        first: async (...params: any[]) => db.prepare(sql).get(...params) || null,
        get: async (...params: any[]) => db.prepare(sql).get(...params) || null,
        run: async (...params: any[]) => {
          const res = db.prepare(sql).run(...params);
          return { success: true, meta: { changes: (res as any).changes } };
        },
        raw: async (...params: any[]) => db.prepare(sql).all(...params).map((r: any) => Object.values(r)),
      };
    },
    batch: async (stmts: any[]) => stmts.map(() => ({ results: [], success: true })),
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
}

export function initializeTestDatabase(rootDir: string = process.cwd()): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF;');

  const migrationDir = path.join(rootDir, 'migrations');
  if (fs.existsSync(migrationDir)) {
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const m of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationDir, m), 'utf-8');
      db.exec(sql);
    }
  }

  const seedSql = fs.readFileSync(path.join(rootDir, 'scripts/seed.sql'), 'utf-8');
  db.exec(seedSql);

  return db;
}

export async function createPayloadStorefrontHarness(rootDir: string = process.cwd()): Promise<PayloadStorefrontHarness> {
  const db = initializeTestDatabase(rootDir);
  const mockD1 = createMockD1(db);

  (globalThis as any).DB = mockD1;
  setDatabase(mockD1);
  clearCatalogRevalidationHistory();

  const mod = await import('../../apps/web/payload.config');
  const config = mod.default;

  const { getPayload } = require('../../apps/web/node_modules/payload');
  const payload = await getPayload({ config });

  const createdCategoryIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdVariationIds = new Set<string>();

  const harness: PayloadStorefrontHarness = {
    db,
    mockD1,
    payload,
    createdCategoryIds,
    createdProductIds,
    createdVariationIds,

    async createCategory(data: TestHarnessCategoryInput) {
      createdCategoryIds.add(data.id);
      return payload.create({
        collection: 'categories',
        data,
      });
    },

    async createProduct(data: TestHarnessProductInput) {
      createdProductIds.add(data.id);
      return payload.create({
        collection: 'products',
        data: {
          ...data,
          // Format rich text lexical description if string provided
          description:
            typeof data.description === 'string'
              ? {
                  root: {
                    type: 'root',
                    children: [
                      {
                        type: 'paragraph',
                        children: [{ type: 'text', text: data.description }],
                      },
                    ],
                  },
                }
              : data.description,
        },
      });
    },

    async createVariation(data: TestHarnessVariationInput) {
      createdVariationIds.add(data.id);
      return payload.create({
        collection: 'product_variations',
        data,
      });
    },

    async updateProduct(id: string, data: Partial<TestHarnessProductInput>) {
      const updatePayload: any = { ...data };
      if (typeof data.description === 'string') {
        updatePayload.description = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: data.description }],
              },
            ],
          },
        };
      }
      return payload.update({
        collection: 'products',
        id,
        data: updatePayload,
      });
    },

    async updateVariation(id: string, data: Partial<TestHarnessVariationInput>) {
      return payload.update({
        collection: 'product_variations',
        id,
        data,
      });
    },

    async deleteProduct(id: string) {
      createdProductIds.delete(id);
      return payload.delete({
        collection: 'products',
        id,
      });
    },

    async deleteCategory(id: string) {
      createdCategoryIds.delete(id);
      return payload.delete({
        collection: 'categories',
        id,
      });
    },

    async queryStorefrontProduct(slug: string): Promise<StorefrontProduct | null> {
      return fetchProductBySlug(slug, { db: mockD1 });
    },

    async queryStorefrontProducts(options?: { categorySlug?: string; limit?: number }): Promise<StorefrontProduct[]> {
      return fetchProducts({ db: mockD1, ...options });
    },

    async queryStorefrontCategories(): Promise<Category[]> {
      return fetchCategories({ db: mockD1 });
    },

    getRevalidationHistory(): CatalogRevalidationEvent[] {
      return getCatalogRevalidationHistory();
    },

    clearRevalidationHistory(): void {
      clearCatalogRevalidationHistory();
    },

    async teardown(): Promise<void> {
      // 1. Remove any created variations
      for (const varId of createdVariationIds) {
        try {
          await payload.delete({ collection: 'product_variations', id: varId });
        } catch {
          try {
            db.exec(`DELETE FROM product_variations WHERE id = '${varId}';`);
          } catch {}
        }
      }
      createdVariationIds.clear();

      // 2. Remove any created products
      for (const prodId of createdProductIds) {
        try {
          await payload.delete({ collection: 'products', id: prodId });
        } catch {
          try {
            db.exec(`DELETE FROM products WHERE id = '${prodId}';`);
          } catch {}
        }
      }
      createdProductIds.clear();

      // 3. Remove any created categories
      for (const catId of createdCategoryIds) {
        try {
          await payload.delete({ collection: 'categories', id: catId });
        } catch {
          try {
            db.exec(`DELETE FROM categories WHERE id = '${catId}';`);
          } catch {}
        }
      }
      createdCategoryIds.clear();

      // 4. Reset global state
      clearCatalogRevalidationHistory();
      resetDatabase();
      (globalThis as any).DB = undefined;
    },
  };

  return harness;
}
