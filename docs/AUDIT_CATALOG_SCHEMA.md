# Catalog Schema Capability Reconciliation & Editorial Ergonomics Audit

**Story**: 3.19 (#268)  
**Date**: September 2026  
**Audience**: Chris (Maker), Engineering & Storefront Team  
**Scope**: `Products`, `ProductLines`, `ProductVariations`, `Categories`

---

## 1. Executive Summary

This audit reconciles the catalog data schema following the adoption of **Candidate 1 (Hybrid Product-First Architecture)** in Story 3.17 / 3.18.

### Primary Architectural Invariants
1. **Hybrid Product-First Entity Hierarchy**: Physical gear items (`Products`) are the primary first-class entities in Payload CMS and Cloudflare D1. They can exist completely standalone (e.g. 1-of-1 workbench prototypes) without requiring a dummy parent container, or optionally link to a `product_line` for shared storytelling and lookbooks.
2. **Strict Inventory Domain Isolation**: Shopify remains the sole authoritative source of truth for real-time stock levels. No live mutable inventory quantities are written or synced from Payload to Shopify.
3. **Zero Redundant Typing for the Maker**: Controlled preset vocabularies eliminate freeform typing errors for technical textiles, fit profiles, batch edition badges, and categories.

---

## 2. Field-by-Field Audit Matrix

### Collection: `Products` (`apps/web/src/collections/Products.ts`)

| Field Name | Type | Storefront Functionality | Audit Assessment | Ergonomic Impact for Chris |
|---|---|---|---|---|
| `id` | `text` (PK) | Unique entity ID (e.g. `prod-bushwhack-anorak`) | **Retain** | Core identifier |
| `title` | `text` | Product name displayed on catalog & PDP | **Retain** | Fast entry |
| `slug` | `text` (unique) | URL routing (`/products/[slug]`) | **Retain** | Auto-derived from title |
| `shopify_product_id` | `text` (unique) | Linked Shopify GID for checkout & stock querying | **Retain** | Auto-populated by Shopify Admin sync hook |
| `base_price` | `number` | Default price in USD (fallback for line defaults) | **Retain** | Numeric validation |
| `price` | `number` | Optional price override for line-assigned products | **Retain** | Optional override |
| `sku` | `text` | Base product SKU | **Retain** | Standard inventory tracking |
| `product_line_id` | `relationship` (`product_lines`) | Optional capsule / series narrative parent | **Retain** | Optional single-select relation |
| `category` | `select` | Primary category (`apparel`, `packs`, `accessories`) | **Retain (Standardized)** | 1-click select on main form |
| `category_id` | `relationship` (`categories`) | Hierarchical category taxonomy drill-down | **Retain (Optional)** | Optional deep relation |
| `material_preset` | `select` | Controlled technical textile combinations | **NEW (Controlled Preset)** | 1-click selection from standard fabric library |
| `materials` | `text` | Formatted specs displayed in PDP Quick Spec panel | **Automate / Derive** | Auto-filled from `material_preset` or custom |
| `weight` | `text` | Formatted gear weight (e.g. `21.4 oz (606g)`) | **Retain (Format Hint)** | Quick spec panel |
| `fit_profile` | `select` | Ergonomic fit specs (Technical Straight, Athletic) | **Convert to Preset** | Controlled select; no retyping |
| `origin` | `text` | Workshop provenance note | **Retain (Defaulted)** | Defaults to `"Handcrafted in Leadville, CO workshop"` |
| `status` | `select` | Lifecycle (`draft`, `scheduled`, `active`, `archived`) | **Retain** | Drop control |
| `featured_image` | `upload` (`media`) | Primary catalog grid & hero photo | **Retain** | 1-click R2 asset picker |
| `gallery` | `array` | Supporting workbench & field photos | **Retain** | Drag-and-drop multi-upload |
| `maker_field_notes` | `textarea` | Authentic field notes quote on PDP | **Retain** | Core storytelling element |
| `artist_statement` | `textarea` | Duplicate of `maker_field_notes` from legacy spec | **PRUNED / DEPRECATED** | Eliminates confusing dual narrative boxes |
| `options` | `array` | Simple colorway / sizing options | **Retain** | Lightweight variant specs |
| `description` | `richText` | Deep editorial narrative | **Retain** | Rich text storytelling |

---

### Collection: `ProductVariations` (`apps/web/src/collections/ProductVariations.ts`)

| Field Name | Type | Storefront Functionality | Audit Assessment | Ergonomic Impact for Chris |
|---|---|---|---|---|
| `id` | `text` (PK) | Unique variation identifier | **Retain** | Core identifier |
| `product_id` | `relationship` (`products`) | Parent physical product | **Retain** | Required relationship |
| `shopify_variant_id` | `text` (unique) | Linked Shopify Variant GID | **Retain** | Real-time stock querying |
| `variation_name` | `text` | Edition name (e.g. `Coyote Tan Micro-Run`) | **Retain** | Fast entry |
| `sku` | `text` (unique) | Specific variation SKU | **Retain** | Barcode / line item match |
| `variation_type` | `select` | `standard`, `micro_batch`, `one_of_one`, `prototype` | **Retain (Controlled)** | Dropdown selection |
| `edition_badge` | `text` | Pill badge (`Only 3 Crafted`, `1-of-1 Prototype`) | **Automate / Derive** | Auto-derived from `variation_type` & count |
| `total_edition_count`| `number` | Total pieces crafted in limited run | **Retain** | Drives scarcity badge |
| `price_override` | `number` | Optional price adjustment for micro-batch | **Retain** | Clear pricing override |
| `variation_notes` | `textarea` | Deadstock provenance / bench notes | **Retain** | Authentic variation story |
| `variation_images` | `array` | Specific workbench detail photos | **Retain** | Prepended to PDP gallery |
| `status` | `select` | Lifecycle status | **Retain** | Drop control |

---

### Collection: `ProductLines` (`apps/web/src/collections/ProductLines.ts`)

| Field Name | Type | Storefront Functionality | Audit Assessment | Ergonomic Impact for Chris |
|---|---|---|---|---|
| `id` | `text` (PK) | Unique line ID (`line-alpine-chest-rig`) | **Retain** | Container ID |
| `title` | `text` | Capsule title (`Alpine Chest Rig System`) | **Retain** | Lookbook header |
| `slug` | `text` (unique) | Lookbook URL route | **Retain** | Auto-derived from title |
| `story` | `textarea` | Capsule narrative & design philosophy | **Retain** | Series storytelling |
| `default_price` | `number` | Default price inherited by child products | **Retain** | Batch pricing economy |
| `hero_image` | `upload` (`media`) | Capsule hero banner | **Retain** | Visual anchor |
| `lookbook_gallery` | `array` | Field photography for the series | **Retain** | Brand imagery |

---

### Collection: `Categories` (`apps/web/src/collections/Categories.ts`)

| Field Name | Type | Storefront Functionality | Audit Assessment | Ergonomic Impact for Chris |
|---|---|---|---|---|
| `id` | `text` (PK) | Subcategory ID (`cat-storm-shells`) | **Retain** | Granular category ID |
| `name` | `text` | Subcategory name (`Waterproof Storm Shells`) | **Retain** | Filter label |
| `slug` | `text` (unique) | Navigation filter slug | **Retain** | URL param filter |
| `parent` | `relationship` (`categories`) | Depth-2 category hierarchy parent | **Retain** | Self-parenting check |
| `description` | `textarea` | Category narrative | **Retain** | Category landing header |
| `image` | `upload` (`media`) | Hero cover image for category | **Retain** | Visual banner |

---

## 3. Controlled Vocabularies Specification

### A. Technical Textiles (`material_preset`)
```typescript
export const MATERIAL_PRESET_MAP: Record<string, string> = {
  toray_cordura: '3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®',
  stretch_cordura: 'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels',
  xpac_vx21: 'Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, Hypalon Plier Dock',
  cordura_eva: '500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch',
  martexin_blaze: '12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth',
  waxed_eva: 'Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim',
  dyneema_composite: 'Dyneema® Composite Fabric (CT5K.18), YKK AquaGuard®',
};
```

### B. Fit Profiles (`fit_profile`)
- `Technical Straight (Articulated knees, gusseted seat for cut-bank scrambles)`
- `Relaxed Athletic (Engineered for layering and overhead casting mobility)`
- `Low-Profile 4-Point Harness (Rides high above deep wading lines)`
- `Ambidextrous Sling / Lumbar Switchable (Breathable 3D Spacer Mesh)`
- `Tri-Fold Compact (Fits into thigh pocket or pack sleeve)`
- `Low Crown 5-Panel with Nylon Webbing Adjuster`
- `Standard True-to-Size Workshop Spec`

### C. Smart Edition Badges (`deriveEditionBadge`)
- `one_of_one`: `"1-of-1 Prototype"`
- `micro_batch`: `"Only ${count} Crafted"` (e.g. `"Only 3 Crafted"`)
- `prototype`: `"Archive Sample"`
- `standard`: `"Standard Production"`

---

## 4. Downstream Story Impact & Unblocking Matrix

| Downstream Story | Previous Status | Impact of Story 3.19 Reconciliation | New Status |
|---|---|---|---|
| **Story 3.1b (#59)**: Product Listing & Category Nav | Paused on category schema conflict | Flat `category` select (`packs`, `apparel`, `accessories`) standardized with relational subcategory support | **UNBLOCKED** |
| **Story 3.1c (#60)**: PDP & Variation Selector | Paused on `materials` / `artist_statement` | Clean Quick Spec panel contracts (`materials`, `weight`, `fit_profile`, `maker_field_notes`) established | **UNBLOCKED** |
| **Story 3.15 (#258)**: Modular Storefront Customization | Paused on catalog schema | Aligned with `product_lines` lookbooks and hero templates | **UNBLOCKED** |
| **Story 3.16 (#259)**: Storefront Rich Media Support | Paused on catalog schema | Preserved `gallery` and `variation_images` array schemas | **UNBLOCKED** |
