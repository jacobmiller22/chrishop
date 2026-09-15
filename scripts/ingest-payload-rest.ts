import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

// Parse CLI arguments
const args = process.argv.slice(2);
const baseUrlArg = args.find((a) => a.startsWith('--base-url='));
const BASE_URL = (baseUrlArg ? baseUrlArg.split('=')[1] : 'http://127.0.0.1:8787').replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL || 'admin@chrishop.jacobmiller22.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Password123!';

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  parent?: string | null;
  description?: string;
}

interface ProductData {
  id: string;
  title: string;
  slug: string;
  base_price: number;
  status: 'active' | 'draft';
  category_id: string;
  shopify_product_id?: string;
  featured_image_path: string;
  gallery_paths: string[];
  maker_field_notes?: string;
  artist_statement?: string;
  materials?: string;
  weight?: string;
  fit_profile?: string;
  origin?: string;
  description_text: string;
}

interface VariationData {
  id: string;
  product_id: string;
  shopify_variant_id?: string;
  variation_name: string;
  sku: string;
  variation_type: 'standard' | 'micro_batch' | 'one_of_one' | 'prototype';
  edition_badge?: string;
  variation_notes?: string;
  variation_image_paths?: Array<{ path: string; caption?: string }>;
  price_override?: number;
  is_limited_edition: boolean;
  total_edition_count?: number;
  status: 'active' | 'coming_soon';
}

const CATEGORIES: CategoryData[] = [
  {
    id: 'cat-accessories',
    name: 'Field Accessories',
    slug: 'field-accessories',
    parent: null,
    description: 'Waxed canvas tool rolls, Kevlar-reinforced casting gloves, and floating brim guide caps.',
  },
  {
    id: 'cat-apparel',
    name: 'Apparel',
    slug: 'apparel',
    parent: null,
    description: 'Technical foul-weather outerwear, guide pants, and active midlayers hand-sewn for bank anglers.',
  },
  {
    id: 'cat-packs',
    name: 'Packs & Carry',
    slug: 'packs-carry',
    parent: null,
    description: 'Waterproof composite lumbar slings, modular chest rigs, and submersible gear duffels.',
  },
  {
    id: 'cat-gloves',
    name: 'Gloves & Handwear',
    slug: 'gloves',
    parent: 'cat-accessories',
    description: 'Braid-resistant Kevlar stripping gloves and sun protection.',
  },
  {
    id: 'cat-headwear',
    name: 'Caps & Headwear',
    slug: 'headwear',
    parent: 'cat-accessories',
    description: 'Floating brim 5-panel guide caps and waxed cotton sun covers.',
  },
  {
    id: 'cat-tool-rolls',
    name: 'Tool Rolls & Wallets',
    slug: 'tool-rolls',
    parent: 'cat-accessories',
    description: 'Martexin waxed canvas leader rolls and tool organizers.',
  },
  {
    id: 'cat-midlayers',
    name: 'Midlayers & Fleece',
    slug: 'midlayers',
    parent: 'cat-apparel',
    description: 'Breathable grid fleece pullovers and thermal insulation.',
  },
  {
    id: 'cat-outerwear',
    name: 'Outerwear',
    slug: 'outerwear',
    parent: 'cat-apparel',
    description: 'Weather-defense storm shells, wind anoraks, and wading jackets.',
  },
  {
    id: 'cat-pants',
    name: 'Pants & Shorts',
    slug: 'pants',
    parent: 'cat-apparel',
    description: 'Heavyweight ripstop guide pants with Cordura brush reinforcement.',
  },
  {
    id: 'cat-storm-shells',
    name: 'Waterproof Storm Shells',
    slug: 'waterproof-storm-shells',
    parent: 'cat-outerwear',
    description: '3-layer fully seam-taped waterproof breathable membranes with Cordura abrasion armor.',
  },
  {
    id: 'cat-chest-rigs',
    name: 'Chest Rigs & Harnesses',
    slug: 'chest-rigs',
    parent: 'cat-packs',
    description: 'Modular chest workstations with drop-down fly/tackle shelves.',
  },
  {
    id: 'cat-dry-bags',
    name: 'Submersible Bags',
    slug: 'dry-bags',
    parent: 'cat-packs',
    description: 'RF-welded TPU submersible bags that keep essentials dry in marsh mud.',
  },
  {
    id: 'cat-sling-packs',
    name: 'Lumbar & Sling Packs',
    slug: 'sling-packs',
    parent: 'cat-packs',
    description: 'One-handed access lumbar and sling packs engineered for uninhibited casting.',
  },
  {
    id: 'cat-brush-pants',
    name: 'Technical Brush Pants',
    slug: 'technical-brush-pants',
    parent: 'cat-pants',
    description: '4-way stretch DWR pants with 1000D Cordura knee and ankle scuff guards.',
  },
];

const PRODUCTS: ProductData[] = [
  {
    id: 'prod-bushwhack-anorak',
    title: 'The Bushwhack Storm Anorak',
    slug: 'bushwhack-storm-anorak',
    base_price: 340,
    status: 'active',
    category_id: 'cat-storm-shells',
    shopify_product_id: 'gid://shopify/Product/101',
    featured_image_path: '/media/bushwhack-storm-anorak/hero.jpeg',
    gallery_paths: [
      '/media/bushwhack-storm-anorak/field-action.jpeg',
      '/media/bushwhack-storm-anorak/workbench-detail.jpeg',
      '/media/bushwhack-storm-anorak/camo-variation.jpeg',
    ],
    maker_field_notes:
      'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles. Features two-way pit-to-hem venting zips.',
    artist_statement:
      'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles. Features two-way pit-to-hem venting zips.',
    materials: '3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®',
    weight: '21.4 oz (606g)',
    fit_profile: 'Relaxed Athletic (Engineered for layering and overhead casting mobility)',
    origin: "Hand-cut & sewn in small batches in Chris's workshop",
    description_text:
      'Patagonia-grade 3-layer waterproof storm shell with 500D Cordura reinforced forearms and oversized kangaroo tackle pouch. Built to crawl through thorns, stay dry in torrential downpours, and cast all day.',
  },
  {
    id: 'prod-bramble-buster-pant',
    title: 'Bramble-Buster Technical Guide Pant',
    slug: 'bramble-buster-technical-guide-pant',
    base_price: 215,
    status: 'active',
    category_id: 'cat-brush-pants',
    shopify_product_id: 'gid://shopify/Product/102',
    featured_image_path: '/media/bramble-buster-technical-guide-pant/hero.jpeg',
    gallery_paths: [
      '/media/bramble-buster-technical-guide-pant/field-action.jpeg',
      '/media/bramble-buster-technical-guide-pant/workbench-detail.jpeg',
      '/media/bramble-buster-technical-guide-pant/camo-variation.jpeg',
    ],
    maker_field_notes:
      'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks, taking the direct abuse from blackberry canes and sharp limestone riprap without puncturing.',
    artist_statement:
      'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks, taking the direct abuse from blackberry canes and sharp limestone riprap without puncturing.',
    materials: 'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels, Mil-Spec Snap Closure',
    weight: '17.8 oz (505g)',
    fit_profile: 'Technical Straight (Articulated knees, gusseted seat for steep cut-bank scrambles)',
    origin: "Hand-cut & sewn in small batches in Chris's workshop",
    description_text:
      'Heavyweight stretch ripstop guide pants fortified with 1000D Cordura scuff guards on knees and ankles. Built for scrambles up 60-degree dirt cuts and briar-choked access trails.',
  },
  {
    id: 'prod-cutbank-sling-pack',
    title: 'The Cutbank Lumbar & Sling Convertible Pack',
    slug: 'the-cutbank-lumbar-sling-pack',
    base_price: 195,
    status: 'active',
    category_id: 'cat-sling-packs',
    shopify_product_id: 'gid://shopify/Product/103',
    featured_image_path: '/media/the-cutbank-lumbar-sling-pack/hero.jpeg',
    gallery_paths: [
      '/media/the-cutbank-lumbar-sling-pack/field-action.jpeg',
      '/media/the-cutbank-lumbar-sling-pack/workbench-detail.jpeg',
      '/media/the-cutbank-lumbar-sling-pack/coyote-variation.jpeg',
    ],
    maker_field_notes:
      'When you are wading chest-deep or scrambling over downed timber, you need your pack out of your stroke until the second you land a fish. The Cutbank swings smoothly from lumbar to chest with one hand, featuring an integrated magnetic net dock.',
    artist_statement:
      'When you are wading chest-deep or scrambling over downed timber, you need your pack out of your stroke until the second you land a fish. The Cutbank swings smoothly from lumbar to chest with one hand, featuring an integrated magnetic net dock.',
    materials: 'Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, YKK AquaGuard®, Hypalon Plier Dock',
    weight: '14.2 oz (402g)',
    fit_profile: 'Ambidextrous Sling / Lumbar Switchable with Breathable 3D Spacer Mesh',
    origin: "Hand-crafted in Chris's workshop",
    description_text:
      'Waterproof X-Pac composite sling that converts to a lumbar pack in seconds. Features an integrated magnetic net slot, Hypalon plier sheath with safety dock, and waterproof zipper compartments.',
  },
  {
    id: 'prod-minimalist-chest-rig',
    title: 'Minimalist Bank Chest Rig',
    slug: 'minimalist-bank-chest-rig',
    base_price: 135,
    status: 'active',
    category_id: 'cat-chest-rigs',
    shopify_product_id: 'gid://shopify/Product/104',
    featured_image_path: '/media/minimalist-bank-chest-rig/hero.jpeg',
    gallery_paths: [
      '/media/minimalist-bank-chest-rig/field-action.jpeg',
      '/media/minimalist-bank-chest-rig/workbench-detail.jpeg',
      '/media/minimalist-bank-chest-rig/prototype-variation.jpeg',
    ],
    maker_field_notes:
      'Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking your terminal fly boxes. Fold-down front panel creates an instant workbench for knot-tying in heavy river current.',
    artist_statement:
      'Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking your terminal fly boxes. Fold-down front panel creates an instant workbench for knot-tying in heavy river current.',
    materials: '500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch, Duraflex® Mojave Buckles',
    weight: '9.6 oz (272g)',
    fit_profile: 'Low-Profile 4-Point Harness (Rides high above deep wading lines)',
    origin: "Hand-crafted in Chris's workshop",
    description_text:
      'Ultralight modular chest station with fold-down tackle workbench shelf and interchangeable high-density EVA fly/lure patch. Straps cleanly over waders or breathable sun hoodies.',
  },
  {
    id: 'prod-waxed-tool-roll',
    title: 'Waxed Canvas & Cordura Tool Roll / Leader Wallet',
    slug: 'waxed-canvas-cordura-tool-roll',
    base_price: 75,
    status: 'active',
    category_id: 'cat-tool-rolls',
    shopify_product_id: 'gid://shopify/Product/105',
    featured_image_path: '/media/waxed-canvas-cordura-tool-roll/hero.jpeg',
    gallery_paths: [
      '/media/waxed-canvas-cordura-tool-roll/field-action.jpeg',
      '/media/waxed-canvas-cordura-tool-roll/workbench-detail.jpeg',
      '/media/waxed-canvas-cordura-tool-roll/charcoal-variation.jpeg',
    ],
    maker_field_notes:
      'Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina. Lined with blaze orange packcloth so terminal split-shot and micro-swivels never get lost in low dusk light.',
    artist_statement:
      'Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina. Lined with blaze orange packcloth so terminal split-shot and micro-swivels never get lost in low dusk light.',
    materials: '12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth, Solid Antiqued Brass Snaps',
    weight: '6.5 oz (184g)',
    fit_profile: 'Tri-Fold Compact (Fits into any thigh pocket or pack exterior sleeve)',
    origin: 'Hand-cut, waxed, and stitched with bonded nylon thread',
    description_text:
      'Heavyweight waxed canvas organizer with 6 internal slots for tippet spools, leader wallets, pliers, hook hones, and knot tools. Fastens securely with twin solid brass button snaps.',
  },
  {
    id: 'prod-5panel-guide-cap',
    title: 'The BankBeaters 5-Panel Guide Cap',
    slug: 'the-bankbeaters-5-panel-guide-cap',
    base_price: 44,
    status: 'active',
    category_id: 'cat-headwear',
    shopify_product_id: 'gid://shopify/Product/106',
    featured_image_path: '/media/the-bankbeaters-5-panel-guide-cap/hero.jpeg',
    gallery_paths: [
      '/media/the-bankbeaters-5-panel-guide-cap/field-action.jpeg',
      '/media/the-bankbeaters-5-panel-guide-cap/workbench-detail.jpeg',
      '/media/the-bankbeaters-5-panel-guide-cap/bark-brown-variation.jpeg',
    ],
    maker_field_notes:
      'If your hat blows off in a river rapid, normal caps sink immediately. We built this with an EVA foam core brim that stays buoyant and recovers its shape after being stuffed into a pack for three days.',
    artist_statement:
      'If your hat blows off in a river rapid, normal caps sink immediately. We built this with an EVA foam core brim that stays buoyant and recovers its shape after being stuffed into a pack for three days.',
    materials: 'Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim, Antiqued Brass Mesh Eyelets',
    weight: '2.9 oz (82g)',
    fit_profile: 'Low Crown 5-Panel with Nylon Webbing Quick-Release Adjuster',
    origin: 'Sewn and shaped in workshop',
    description_text:
      'Waxed cotton 5-panel guide cap engineered with an unsinkable floatable EVA foam brim, dark glare-reducing underbill, and breathable brass ventilation eyelets.',
  },
];

const VARIATIONS: VariationData[] = [
  {
    id: 'var-anorak-olive',
    product_id: 'prod-bushwhack-anorak',
    shopify_variant_id: 'gid://shopify/ProductVariant/201',
    variation_name: 'Field Olive — Standard Run',
    sku: 'BWK-ANRK-OLV-STD',
    variation_type: 'standard',
    edition_badge: 'Standard Production',
    variation_notes:
      'Standard production run in bombproof 3-layer olive ripstop with black 500D Cordura scuff guards.',
    is_limited_edition: true,
    total_edition_count: 25,
    status: 'active',
  },
  {
    id: 'var-anorak-camo-micro',
    product_id: 'prod-bushwhack-anorak',
    shopify_variant_id: 'gid://shopify/ProductVariant/202',
    variation_name: 'Deadstock Duck Camo Pocket Edition',
    sku: 'BWK-ANRK-CAMO-LTD',
    variation_type: 'micro_batch',
    edition_badge: 'Only 3 Crafted',
    variation_notes:
      'Crafted at the sewing bench using salvaged 1990s deadstock Mil-Spec duck camo Cordura for the oversized kangaroo chest drop pouch. Only 3 jackets crafted in this micro-batch run. Signed and numbered interior label.',
    variation_image_paths: [
      {
        path: '/media/bushwhack-storm-anorak/camo-variation.jpeg',
        caption: 'Bench shot: Deadstock 500D duck camo chest pouch under machine needle',
      },
      {
        path: '/media/bushwhack-storm-anorak/workbench-detail.jpeg',
        caption: 'Bench shot: AquaGuard zipper bar-tacking and hand-stamped edition tag',
      },
    ],
    price_override: 385,
    is_limited_edition: true,
    total_edition_count: 3,
    status: 'active',
  },
  {
    id: 'var-pant-32',
    product_id: 'prod-bramble-buster-pant',
    shopify_variant_id: 'gid://shopify/ProductVariant/203',
    variation_name: 'Size 32 / Regular (Standard)',
    sku: 'BMB-PNT-32R',
    variation_type: 'standard',
    edition_badge: 'Standard Run',
    is_limited_edition: true,
    total_edition_count: 30,
    status: 'active',
  },
  {
    id: 'var-pant-34',
    product_id: 'prod-bramble-buster-pant',
    shopify_variant_id: 'gid://shopify/ProductVariant/204',
    variation_name: 'Size 34 / Regular (Standard)',
    sku: 'BMB-PNT-34R',
    variation_type: 'standard',
    edition_badge: 'Standard Run',
    is_limited_edition: true,
    total_edition_count: 30,
    status: 'active',
  },
  {
    id: 'var-pant-camo-knees',
    product_id: 'prod-bramble-buster-pant',
    shopify_variant_id: 'gid://shopify/ProductVariant/205',
    variation_name: 'Micro-Batch Deadstock Camo Knee Edition',
    sku: 'BMB-PNT-CAMO-LTD',
    variation_type: 'micro_batch',
    edition_badge: 'Only 4 Crafted',
    variation_notes:
      'Workbench micro-batch built with rare deadstock Mil-Spec camo Cordura knee reinforcements and high-tensile orange bar-tacks.',
    variation_image_paths: [
      {
        path: '/media/bramble-buster-technical-guide-pant/camo-variation.jpeg',
        caption: 'Bench shot: Triple-stitched camo knee overlay with bonded nylon thread',
      },
      {
        path: '/media/bramble-buster-technical-guide-pant/workbench-detail.jpeg',
        caption: 'Bench shot: Heavyweight DWR ripstop scuff guard seam detail',
      },
    ],
    price_override: 245,
    is_limited_edition: true,
    total_edition_count: 4,
    status: 'active',
  },
  {
    id: 'var-cutbank-slate',
    product_id: 'prod-cutbank-sling-pack',
    shopify_variant_id: 'gid://shopify/ProductVariant/206',
    variation_name: 'VX21 Slate Grey — Standard Edition',
    sku: 'CTB-SLG-GRY-STD',
    variation_type: 'standard',
    edition_badge: 'Standard Production',
    is_limited_edition: true,
    total_edition_count: 40,
    status: 'active',
  },
  {
    id: 'var-cutbank-coyote',
    product_id: 'prod-cutbank-sling-pack',
    shopify_variant_id: 'gid://shopify/ProductVariant/207',
    variation_name: 'Coyote Tan & Blaze Orange Micro-Run',
    sku: 'CTB-SLG-CYT-LTD',
    variation_type: 'micro_batch',
    edition_badge: 'Only 5 Crafted',
    variation_notes:
      'Micro-batch crafted with Coyote Tan X-Pac VX21 exterior shell and high-visibility blaze orange internal packcloth liner for quick tackle identification.',
    variation_image_paths: [
      {
        path: '/media/the-cutbank-lumbar-sling-pack/coyote-variation.jpeg',
        caption: 'Bench shot: Coyote Tan sailcloth assembly with blaze orange interior bind',
      },
      {
        path: '/media/the-cutbank-lumbar-sling-pack/workbench-detail.jpeg',
        caption: 'Bench shot: Magnetic net dock and Hypalon plier sheath testing',
      },
    ],
    price_override: 225,
    is_limited_edition: true,
    total_edition_count: 5,
    status: 'active',
  },
  {
    id: 'var-chestrig-ranger',
    product_id: 'prod-minimalist-chest-rig',
    shopify_variant_id: 'gid://shopify/ProductVariant/208',
    variation_name: 'Ranger Olive — Standard Station',
    sku: 'MCR-RIG-OLV-STD',
    variation_type: 'standard',
    edition_badge: 'Standard Run',
    is_limited_edition: true,
    total_edition_count: 35,
    status: 'active',
  },
  {
    id: 'var-chestrig-proto',
    product_id: 'prod-minimalist-chest-rig',
    shopify_variant_id: 'gid://shopify/ProductVariant/209',
    variation_name: 'Archive Workshop Prototype 01',
    sku: 'MCR-RIG-PROTO-01',
    variation_type: 'one_of_one',
    edition_badge: 'One-of-One Archive',
    variation_notes:
      'Chris personal workshop prototype used during spring cutthroat testing on the North Umpqua River. Signed and dated 01/01 inside the fold-down fly station.',
    variation_image_paths: [
      {
        path: '/media/minimalist-bank-chest-rig/prototype-variation.jpeg',
        caption: 'Bench shot: Hand-numbered 01/01 prototype label with custom hook shear dock',
      },
      {
        path: '/media/minimalist-bank-chest-rig/workbench-detail.jpeg',
        caption: 'Bench shot: High-density EVA fly foam bench testing with bar-tacked webbing',
      },
    ],
    price_override: 175,
    is_limited_edition: true,
    total_edition_count: 1,
    status: 'active',
  },
  {
    id: 'var-toolroll-tan',
    product_id: 'prod-waxed-tool-roll',
    shopify_variant_id: 'gid://shopify/ProductVariant/210',
    variation_name: 'Field Tan Waxed Canvas',
    sku: 'WTR-ROL-TAN-STD',
    variation_type: 'standard',
    edition_badge: 'Workshop Standard',
    is_limited_edition: true,
    total_edition_count: 50,
    status: 'active',
  },
  {
    id: 'var-toolroll-charcoal',
    product_id: 'prod-waxed-tool-roll',
    shopify_variant_id: 'gid://shopify/ProductVariant/211',
    variation_name: 'Dark Charcoal Waxed Canvas',
    sku: 'WTR-ROL-DRK-STD',
    variation_type: 'standard',
    edition_badge: 'Workshop Standard',
    variation_image_paths: [
      {
        path: '/media/waxed-canvas-cordura-tool-roll/charcoal-variation.jpeg',
        caption: 'Bench shot: Dark Charcoal Martexin waxed canvas opened with hi-vis blaze orange interior slots',
      },
      {
        path: '/media/waxed-canvas-cordura-tool-roll/workbench-detail.jpeg',
        caption: 'Bench shot: Solid antiqued brass snaps pressed into 12oz waxed canvas',
      },
    ],
    is_limited_edition: true,
    total_edition_count: 50,
    status: 'active',
  },
  {
    id: 'var-cap-olive',
    product_id: 'prod-5panel-guide-cap',
    shopify_variant_id: 'gid://shopify/ProductVariant/212',
    variation_name: 'Waxed River Olive',
    sku: 'GDC-CAP-OLV',
    variation_type: 'standard',
    edition_badge: 'Hand-Shaped',
    is_limited_edition: true,
    total_edition_count: 50,
    status: 'active',
  },
  {
    id: 'var-cap-bark',
    product_id: 'prod-5panel-guide-cap',
    shopify_variant_id: 'gid://shopify/ProductVariant/213',
    variation_name: 'Waxed Bark Brown',
    sku: 'GDC-CAP-BRK',
    variation_type: 'standard',
    edition_badge: 'Hand-Shaped',
    variation_image_paths: [
      {
        path: '/media/the-bankbeaters-5-panel-guide-cap/bark-brown-variation.jpeg',
        caption: 'Bench shot: Waxed Bark Brown cotton canvas 5-panel guide cap profile',
      },
      {
        path: '/media/the-bankbeaters-5-panel-guide-cap/workbench-detail.jpeg',
        caption: 'Bench shot: Floatable EVA foam brim shaping and antiqued brass mesh eyelet',
      },
    ],
    is_limited_edition: true,
    total_edition_count: 50,
    status: 'active',
  },
];

function createLexicalDescription(text: string) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              mode: 'normal',
              text: text,
              type: 'text',
              style: '',
              detail: 0,
              format: 0,
              version: 1,
            },
          ],
          direction: 'ltr',
        },
      ],
      direction: 'ltr',
    },
  };
}

async function login(): Promise<string> {
  console.log(`🔐 Authenticating against ${BASE_URL}/api/users/login...`);
  const resp = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Login failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as any;
  if (!data.token) {
    throw new Error(`Login succeeded but token missing: ${JSON.stringify(data)}`);
  }

  console.log(`✔ Authenticated successfully as ${EMAIL}`);
  return data.token;
}

function getUniqueFilename(relPath: string): string {
  return relPath.replace(/^\/media\//, '').replace(/\//g, '-');
}

async function uploadMedia(
  token: string,
  relPath: string,
  alt: string,
  caption?: string
): Promise<number> {
  const localFilePath = path.join(rootDir, 'apps/web/public', relPath.replace(/^\//, ''));
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Media file not found on disk: ${localFilePath}`);
  }

  const uniqueFilename = getUniqueFilename(relPath);
  const fileBuffer = fs.readFileSync(localFilePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('file', blob, uniqueFilename);
  formData.append(
    '_payload',
    JSON.stringify({
      alt,
      caption: caption || undefined,
    })
  );

  const resp = await fetch(`${BASE_URL}/api/media`, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${token}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to upload media ${relPath} (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as any;
  const mediaId = data.doc?.id;
  if (!mediaId) {
    throw new Error(`Upload succeeded but media ID missing for ${relPath}: ${JSON.stringify(data)}`);
  }

  return mediaId;
}

async function getExistingDoc(token: string, collection: string, id: string): Promise<any | null> {
  try {
    const resp = await fetch(`${BASE_URL}/api/${collection}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `JWT ${token}` },
    });
    if (resp.status === 200) {
      return await resp.json();
    }
  } catch {}
  return null;
}

async function createOrUpdateDoc(
  token: string,
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<any> {
  const existing = await getExistingDoc(token, collection, id);

  if (existing) {
    console.log(`  ↻ Document ${collection}/${id} already exists, updating...`);
    const resp = await fetch(`${BASE_URL}/api/${collection}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`PATCH ${collection}/${id} failed (${resp.status}): ${err}`);
    }
    return (await resp.json()).doc;
  } else {
    console.log(`  + Creating ${collection}/${id}...`);
    const resp = await fetch(`${BASE_URL}/api/${collection}`, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...data }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`POST ${collection}/${id} failed (${resp.status}): ${err}`);
    }
    return (await resp.json()).doc;
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 ChrisShop Payload CMS Catalog REST Ingestion Engine`);
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`======================================================\n`);

  const token = await login();

  // 1. Ingest Media Assets
  console.log(`\n📷 [1/4] Ingesting Media Assets...`);
  const mediaMap = new Map<string, number>();

  // Check existing media in CMS
  const existingMediaResp = await fetch(`${BASE_URL}/api/media?limit=100`, {
    headers: { Authorization: `JWT ${token}` },
  });
  if (existingMediaResp.ok) {
    const existingMediaData = (await existingMediaResp.json()) as any;
    for (const doc of existingMediaData.docs || []) {
      if (doc.filename && doc.id) {
        mediaMap.set(doc.filename, doc.id);
      }
    }
  }

  // Collect all unique media paths needed by products and variations
  const mediaToUpload = new Map<string, { alt: string; caption?: string }>();
  for (const p of PRODUCTS) {
    mediaToUpload.set(p.featured_image_path, {
      alt: `${p.title} Hero Shot`,
      caption: `Field action photography of ${p.title}`,
    });
    for (const g of p.gallery_paths) {
      if (!mediaToUpload.has(g)) {
        mediaToUpload.set(g, {
          alt: `${p.title} Gallery Detail`,
          caption: `Bench and field shot of ${p.title}`,
        });
      }
    }
  }
  for (const v of VARIATIONS) {
    for (const vi of v.variation_image_paths || []) {
      if (!mediaToUpload.has(vi.path)) {
        mediaToUpload.set(vi.path, {
          alt: `${v.variation_name} Detail`,
          caption: vi.caption,
        });
      }
    }
  }

  console.log(`Identified ${mediaToUpload.size} distinct media assets to process.`);
  for (const [relPath, meta] of mediaToUpload.entries()) {
    const uniqueFilename = getUniqueFilename(relPath);
    if (mediaMap.has(uniqueFilename)) {
      const existingId = mediaMap.get(uniqueFilename)!;
      console.log(`  ✔ Media ${relPath} already registered (${uniqueFilename}) with ID: ${existingId}`);
      mediaMap.set(relPath, existingId);
      continue;
    }

    try {
      console.log(`  ↑ Uploading media: ${relPath} (${uniqueFilename})...`);
      const mediaId = await uploadMedia(token, relPath, meta.alt, meta.caption);
      mediaMap.set(relPath, mediaId);
      mediaMap.set(uniqueFilename, mediaId);
      console.log(`  ✔ Uploaded ${relPath} ➔ ID: ${mediaId}`);
    } catch (err: any) {
      console.error(`  ❌ Error uploading ${relPath}: ${err.message}`);
    }
  }

  // 2. Ingest Categories
  console.log(`\n🏷️  [2/4] Ingesting Categories (Topological Order)...`);
  for (const cat of CATEGORIES) {
    await createOrUpdateDoc(token, 'categories', cat.id, {
      name: cat.name,
      slug: cat.slug,
      parent: cat.parent || null,
      description: cat.description || null,
    });
  }

  // 3. Ingest Products
  console.log(`\n📦 [3/4] Ingesting Products...`);
  for (const p of PRODUCTS) {
    const featuredImageId = mediaMap.get(p.featured_image_path);
    const galleryItems = p.gallery_paths
      .map((g) => mediaMap.get(g))
      .filter((id): id is number => id !== undefined)
      .map((id) => ({ image: id }));

    await createOrUpdateDoc(token, 'products', p.id, {
      title: p.title,
      slug: p.slug,
      base_price: p.base_price,
      status: p.status,
      category_id: p.category_id,
      shopify_product_id: p.shopify_product_id || null,
      featured_image: featuredImageId || null,
      gallery: galleryItems,
      maker_field_notes: p.maker_field_notes || null,
      artist_statement: p.artist_statement || null,
      materials: p.materials || null,
      weight: p.weight || null,
      fit_profile: p.fit_profile || null,
      origin: p.origin || null,
      description: createLexicalDescription(p.description_text),
    });
  }

  // 4. Ingest Product Variations
  console.log(`\n🎨 [4/4] Ingesting Product Variations...`);
  for (const v of VARIATIONS) {
    const variationImages = (v.variation_image_paths || [])
      .map((vi) => {
        const imgId = mediaMap.get(vi.path);
        return imgId ? { image: imgId, caption: vi.caption || null } : null;
      })
      .filter((x): x is { image: number; caption: string | null } => x !== null);

    await createOrUpdateDoc(token, 'product_variations', v.id, {
      product_id: v.product_id,
      shopify_variant_id: v.shopify_variant_id || null,
      variation_name: v.variation_name,
      sku: v.sku,
      variation_type: v.variation_type,
      edition_badge: v.edition_badge || null,
      variation_notes: v.variation_notes || null,
      variation_images: variationImages,
      price_override: v.price_override || null,
      is_limited_edition: v.is_limited_edition,
      total_edition_count: v.total_edition_count || null,
      status: v.status,
    });
  }

  // 5. Verification
  console.log(`\n🔍 Verifying Payload CMS Ingestion State...`);
  const [catsResp, prodsResp, varsResp, mediaResp] = await Promise.all([
    fetch(`${BASE_URL}/api/categories?limit=100`, { headers: { Authorization: `JWT ${token}` } }),
    fetch(`${BASE_URL}/api/products?limit=100`, { headers: { Authorization: `JWT ${token}` } }),
    fetch(`${BASE_URL}/api/product_variations?limit=100`, { headers: { Authorization: `JWT ${token}` } }),
    fetch(`${BASE_URL}/api/media?limit=100`, { headers: { Authorization: `JWT ${token}` } }),
  ]);

  const catsData = (await catsResp.json()) as any;
  const prodsData = (await prodsResp.json()) as any;
  const varsData = (await varsResp.json()) as any;
  const mediaData = (await mediaResp.json()) as any;

  console.log(`\n🎉 Ingestion Complete!`);
  console.log(`- Categories: ${catsData.totalDocs} / 14`);
  console.log(`- Media: ${mediaData.totalDocs} / ${mediaToUpload.size}`);
  console.log(`- Products: ${prodsData.totalDocs} / 6`);
  console.log(`- Product Variations: ${varsData.totalDocs} / 12`);
}

main().catch((err) => {
  console.error('\n❌ Fatal Ingestion Error:', err);
  process.exit(1);
});
