import { directusFetch } from './directus-client';

interface CollectionDefinition {
  collection: string;
  meta: {
    icon: string;
    note: string;
  };
  fields: Array<{
    field: string;
    type: string;
    schema?: {
      is_primary_key?: boolean;
      is_nullable?: boolean;
      is_unique?: boolean;
      numeric_precision?: number;
      numeric_scale?: number;
      default_value?: any;
    };
    meta?: {
      interface?: string;
      readonly?: boolean;
      hidden?: boolean;
      required?: boolean;
      special?: string[];
      options?: Record<string, any>;
    };
  }>;
}

interface RelationDefinition {
  collection: string;
  field: string;
  related_collection: string;
  schema?: {
    on_delete?: string;
  };
  meta?: {
    many_collection?: string;
    many_field?: string;
    one_collection?: string;
    one_field?: string | null;
  };
}

const COLLECTIONS: CollectionDefinition[] = [
  {
    collection: 'categories',
    meta: {
      icon: 'category',
      note: 'Product categories and collections',
    },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        schema: { is_primary_key: true, is_nullable: false },
        meta: { readonly: true, hidden: true, special: ['uuid'], interface: 'input' },
      },
      {
        field: 'name',
        type: 'string',
        schema: { is_nullable: false },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'slug',
        type: 'string',
        schema: { is_nullable: false, is_unique: true },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'description',
        type: 'text',
        schema: { is_nullable: true },
        meta: { interface: 'input-multiline' },
      },
      {
        field: 'image',
        type: 'uuid',
        schema: { is_nullable: true },
        meta: { special: ['file'], interface: 'file-image' },
      },
    ],
  },
  {
    collection: 'products',
    meta: {
      icon: 'inventory_2',
      note: 'Base product catalog and artwork offerings',
    },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        schema: { is_primary_key: true, is_nullable: false },
        meta: { readonly: true, hidden: true, special: ['uuid'], interface: 'input' },
      },
      {
        field: 'title',
        type: 'string',
        schema: { is_nullable: false },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'slug',
        type: 'string',
        schema: { is_nullable: false, is_unique: true },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'description',
        type: 'text',
        schema: { is_nullable: true },
        meta: { interface: 'input-multiline' },
      },
      {
        field: 'base_price',
        type: 'decimal',
        schema: { is_nullable: false, numeric_precision: 10, numeric_scale: 2 },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'status',
        type: 'string',
        schema: { is_nullable: false, default_value: 'draft' },
        meta: {
          interface: 'select-dropdown',
          options: {
            choices: [
              { text: 'Draft', value: 'draft' },
              { text: 'Published', value: 'published' },
              { text: 'Archived', value: 'archived' },
            ],
          },
        },
      },
      {
        field: 'category_id',
        type: 'uuid',
        schema: { is_nullable: true },
        meta: { special: ['m2o'], interface: 'select-dropdown-m2o' },
      },
      {
        field: 'hero_image',
        type: 'uuid',
        schema: { is_nullable: true },
        meta: { special: ['file'], interface: 'file-image' },
      },
      {
        field: 'featured_image',
        type: 'uuid',
        schema: { is_nullable: true },
        meta: { special: ['file'], interface: 'file-image' },
      },
    ],
  },
  {
    collection: 'product_variations',
    meta: {
      icon: 'style',
      note: 'Product drop variations and stock quantities',
    },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        schema: { is_primary_key: true, is_nullable: false },
        meta: { readonly: true, hidden: true, special: ['uuid'], interface: 'input' },
      },
      {
        field: 'product_id',
        type: 'uuid',
        schema: { is_nullable: false },
        meta: { special: ['m2o'], interface: 'select-dropdown-m2o', required: true },
      },
      {
        field: 'sku',
        type: 'string',
        schema: { is_nullable: false, is_unique: true },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'name',
        type: 'string',
        schema: { is_nullable: false },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'variation_name',
        type: 'string',
        schema: { is_nullable: false },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'price_override',
        type: 'decimal',
        schema: { is_nullable: true, numeric_precision: 10, numeric_scale: 2 },
        meta: { interface: 'input' },
      },
      {
        field: 'stock_quantity',
        type: 'integer',
        schema: { is_nullable: false, default_value: 0 },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'release_date',
        type: 'dateTime',
        schema: { is_nullable: true },
        meta: { interface: 'datetime' },
      },
      {
        field: 'status',
        type: 'string',
        schema: { is_nullable: false, default_value: 'active' },
        meta: {
          interface: 'select-dropdown',
          options: {
            choices: [
              { text: 'Coming Soon', value: 'coming_soon' },
              { text: 'Active', value: 'active' },
              { text: 'Sold Out', value: 'sold_out' },
              { text: 'Archived', value: 'archived' },
            ],
          },
        },
      },
      {
        field: 'is_limited_edition',
        type: 'boolean',
        schema: { is_nullable: false, default_value: true },
        meta: { interface: 'boolean' },
      },
      {
        field: 'total_edition_count',
        type: 'integer',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
    ],
  },
  {
    collection: 'orders',
    meta: {
      icon: 'shopping_cart',
      note: 'Customer orders and shipping tracking',
    },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        schema: { is_primary_key: true, is_nullable: false },
        meta: { readonly: true, hidden: true, special: ['uuid'], interface: 'input' },
      },
      {
        field: 'stripe_checkout_session_id',
        type: 'string',
        schema: { is_nullable: true, is_unique: true },
        meta: { interface: 'input' },
      },
      {
        field: 'stripe_payment_intent_id',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'customer_email',
        type: 'string',
        schema: { is_nullable: false },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'customer_name',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'shipping_name',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'shipping_address',
        type: 'json',
        schema: { is_nullable: true },
        meta: { interface: 'input-code', options: { language: 'json' } },
      },
      {
        field: 'total_amount',
        type: 'decimal',
        schema: { is_nullable: true, numeric_precision: 10, numeric_scale: 2 },
        meta: { interface: 'input' },
      },
      {
        field: 'amount_total',
        type: 'decimal',
        schema: { is_nullable: true, numeric_precision: 10, numeric_scale: 2 },
        meta: { interface: 'input' },
      },
      {
        field: 'status',
        type: 'string',
        schema: { is_nullable: false, default_value: 'pending' },
        meta: {
          interface: 'select-dropdown',
          options: {
            choices: [
              { text: 'Pending', value: 'pending' },
              { text: 'Paid', value: 'paid' },
              { text: 'Shipped', value: 'shipped' },
              { text: 'Cancelled', value: 'cancelled' },
            ],
          },
        },
      },
      {
        field: 'order_status',
        type: 'string',
        schema: { is_nullable: false, default_value: 'paid' },
        meta: { interface: 'select-dropdown' },
      },
      {
        field: 'shipping_status',
        type: 'string',
        schema: { is_nullable: false, default_value: 'unfulfilled' },
        meta: { interface: 'select-dropdown' },
      },
      {
        field: 'carrier',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'tracking_number',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'tracking_url',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'shippo_transaction_id',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'label_url',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'rate_id',
        type: 'string',
        schema: { is_nullable: true },
        meta: { interface: 'input' },
      },
      {
        field: 'amount_subtotal',
        type: 'decimal',
        schema: { is_nullable: true, numeric_precision: 10, numeric_scale: 2 },
        meta: { interface: 'input' },
      },
      {
        field: 'amount_tax',
        type: 'decimal',
        schema: { is_nullable: true, numeric_precision: 10, numeric_scale: 2 },
        meta: { interface: 'input' },
      },
      {
        field: 'amount_shipping',
        type: 'decimal',
        schema: { is_nullable: true, numeric_precision: 10, numeric_scale: 2 },
        meta: { interface: 'input' },
      },
      {
        field: 'created_at',
        type: 'dateTime',
        schema: { is_nullable: false, default_value: 'CURRENT_TIMESTAMP' },
        meta: { interface: 'datetime' },
      },
    ],
  },
  {
    collection: 'order_items',
    meta: {
      icon: 'format_list_bulleted',
      note: 'Purchased order items',
    },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        schema: { is_primary_key: true, is_nullable: false },
        meta: { readonly: true, hidden: true, special: ['uuid'], interface: 'input' },
      },
      {
        field: 'order_id',
        type: 'uuid',
        schema: { is_nullable: false },
        meta: { special: ['m2o'], interface: 'select-dropdown-m2o', required: true },
      },
      {
        field: 'product_variation_id',
        type: 'uuid',
        schema: { is_nullable: false },
        meta: { special: ['m2o'], interface: 'select-dropdown-m2o', required: true },
      },
      {
        field: 'variation_id',
        type: 'uuid',
        schema: { is_nullable: false },
        meta: { special: ['m2o'], interface: 'select-dropdown-m2o', required: true },
      },
      {
        field: 'quantity',
        type: 'integer',
        schema: { is_nullable: false, default_value: 1 },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'unit_price',
        type: 'decimal',
        schema: { is_nullable: false, numeric_precision: 10, numeric_scale: 2 },
        meta: { required: true, interface: 'input' },
      },
    ],
  },
  {
    collection: 'processed_stripe_events',
    meta: {
      icon: 'verified',
      note: 'Stripe webhook idempotency log',
    },
    fields: [
      {
        field: 'id',
        type: 'string',
        schema: { is_primary_key: true, is_nullable: false },
        meta: { readonly: true, interface: 'input' },
      },
      {
        field: 'event_type',
        type: 'string',
        schema: { is_nullable: false },
        meta: { required: true, interface: 'input' },
      },
      {
        field: 'processed_at',
        type: 'dateTime',
        schema: { is_nullable: false, default_value: 'CURRENT_TIMESTAMP' },
        meta: { interface: 'datetime' },
      },
    ],
  },
];

const RELATIONS: RelationDefinition[] = [
  {
    collection: 'categories',
    field: 'image',
    related_collection: 'directus_files',
    schema: { on_delete: 'SET NULL' },
    meta: {
      many_collection: 'categories',
      many_field: 'image',
      one_collection: 'directus_files',
      one_field: null,
    },
  },
  {
    collection: 'products',
    field: 'category_id',
    related_collection: 'categories',
    schema: { on_delete: 'SET NULL' },
    meta: {
      many_collection: 'products',
      many_field: 'category_id',
      one_collection: 'categories',
      one_field: null,
    },
  },
  {
    collection: 'products',
    field: 'hero_image',
    related_collection: 'directus_files',
    schema: { on_delete: 'SET NULL' },
    meta: {
      many_collection: 'products',
      many_field: 'hero_image',
      one_collection: 'directus_files',
      one_field: null,
    },
  },
  {
    collection: 'products',
    field: 'featured_image',
    related_collection: 'directus_files',
    schema: { on_delete: 'SET NULL' },
    meta: {
      many_collection: 'products',
      many_field: 'featured_image',
      one_collection: 'directus_files',
      one_field: null,
    },
  },
  {
    collection: 'product_variations',
    field: 'product_id',
    related_collection: 'products',
    schema: { on_delete: 'CASCADE' },
    meta: {
      many_collection: 'product_variations',
      many_field: 'product_id',
      one_collection: 'products',
      one_field: null,
    },
  },
  {
    collection: 'order_items',
    field: 'order_id',
    related_collection: 'orders',
    schema: { on_delete: 'CASCADE' },
    meta: {
      many_collection: 'order_items',
      many_field: 'order_id',
      one_collection: 'orders',
      one_field: null,
    },
  },
  {
    collection: 'order_items',
    field: 'product_variation_id',
    related_collection: 'product_variations',
    schema: { on_delete: 'RESTRICT' },
    meta: {
      many_collection: 'order_items',
      many_field: 'product_variation_id',
      one_collection: 'product_variations',
      one_field: null,
    },
  },
  {
    collection: 'order_items',
    field: 'variation_id',
    related_collection: 'product_variations',
    schema: { on_delete: 'RESTRICT' },
    meta: {
      many_collection: 'order_items',
      many_field: 'variation_id',
      one_collection: 'product_variations',
      one_field: null,
    },
  },
];

export async function setupSchema(): Promise<void> {
  console.log('📦 Starting Directus Schema Provisioning...');

  // 1. Fetch existing collections
  const existingCollsRes = await directusFetch('/collections');
  const existingColls = new Set<string>(
    Array.isArray(existingCollsRes.data) ? existingCollsRes.data.map((c: any) => c.collection) : []
  );

  // 2. Create or verify collections
  for (const colDef of COLLECTIONS) {
    if (!existingColls.has(colDef.collection)) {
      console.log(`Creating collection: ${colDef.collection}`);
      const createRes = await directusFetch('/collections', {
        method: 'POST',
        body: JSON.stringify({
          collection: colDef.collection,
          meta: colDef.meta,
          schema: {},
          fields: [colDef.fields[0]], // Create PK field with collection
        }),
      });
      if (!createRes.ok) {
        throw new Error(
          `Failed to create collection ${colDef.collection}: ${JSON.stringify(createRes.errors || createRes.data)}`
        );
      }
    } else {
      console.log(`Collection exists: ${colDef.collection}`);
    }

    // Fetch existing fields for collection
    const fieldsRes = await directusFetch(`/fields/${colDef.collection}`);
    const existingFields = new Set<string>(
      Array.isArray(fieldsRes.data) ? fieldsRes.data.map((f: any) => f.field) : []
    );

    // Create missing fields
    for (const f of colDef.fields.slice(1)) {
      if (!existingFields.has(f.field)) {
        console.log(`  Adding field ${colDef.collection}.${f.field}`);
        const fieldRes = await directusFetch(`/fields/${colDef.collection}`, {
          method: 'POST',
          body: JSON.stringify(f),
        });
        if (!fieldRes.ok) {
          throw new Error(
            `Failed to create field ${colDef.collection}.${f.field}: ${JSON.stringify(fieldRes.errors || fieldRes.data)}`
          );
        }
      }
    }
  }

  // 3. Create or verify relations
  const existingRelationsRes = await directusFetch('/relations');
  const existingRelations = Array.isArray(existingRelationsRes.data)
    ? existingRelationsRes.data
    : [];

  for (const relDef of RELATIONS) {
    const exists = existingRelations.some(
      (r: any) =>
        r.collection === relDef.collection &&
        r.field === relDef.field &&
        r.related_collection === relDef.related_collection
    );

    if (!exists) {
      console.log(
        `Creating relation: ${relDef.collection}.${relDef.field} -> ${relDef.related_collection}`
      );
      const relRes = await directusFetch('/relations', {
        method: 'POST',
        body: JSON.stringify(relDef),
      });
      if (!relRes.ok) {
        console.warn(
          `Note: Relation ${relDef.collection}.${relDef.field} creation response:`,
          relRes.errors || relRes.data
        );
      }
    } else {
      console.log(
        `Relation exists: ${relDef.collection}.${relDef.field} -> ${relDef.related_collection}`
      );
    }
  }

  // 4. Configure Public read permissions for published catalog items
  console.log('🔒 Configuring Public Role permissions for storefront...');
  const policiesRes = await directusFetch('/policies');
  const publicPolicy = Array.isArray(policiesRes.data)
    ? policiesRes.data.find((p: any) => p.name === '$t:public_label')
    : null;

  if (publicPolicy?.id) {
    const permissionsRes = await directusFetch('/permissions');
    const existingPerms = Array.isArray(permissionsRes.data) ? permissionsRes.data : [];

    const publicReadCollections = [
      'categories',
      'products',
      'product_variations',
      'directus_files',
    ];

    for (const col of publicReadCollections) {
      const hasPerm = existingPerms.some(
        (perm: any) =>
          perm.policy === publicPolicy.id && perm.collection === col && perm.action === 'read'
      );

      if (!hasPerm) {
        console.log(`  Granting public read permission for: ${col}`);
        await directusFetch('/permissions', {
          method: 'POST',
          body: JSON.stringify({
            policy: publicPolicy.id,
            collection: col,
            action: 'read',
            fields: ['*'],
          }),
        });
      }
    }
  }

  console.log('✅ Directus Schema Provisioning Completed Successfully.');
}

if (process.argv[1]?.includes('setup-schema')) {
  setupSchema().catch((err) => {
    console.error('❌ Schema setup failed:', err);
    process.exit(1);
  });
}
