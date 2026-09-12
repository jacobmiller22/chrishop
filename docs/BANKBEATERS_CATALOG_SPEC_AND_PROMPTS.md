# BankBeaters Adventure Gear — Catalog Specification & Visual Prompt Guide

An authoritative technical specification, craft story, and AI visual prompt guide for the **BankBeaters Adventure Gear** catalog. Designed for direct insertion into Payload CMS v3, Cloudflare D1, Shopify Storefront, and diffusion generative pipelines (Midjourney v6.1, Imagen 3, FLUX.1 Schnell/Dev).

---

## 1. Taxonomy & Category Hierarchy Overview

The BankBeaters catalog utilizes a 3-tier taxonomy (Depth 0 → Depth 1 → Depth 2) reflecting technical foul-weather alpine fishing, bank-scrambling carry systems, and handcrafted field gear:

```
[Depth 0] Apparel (cat-apparel)
 ├── [Depth 1] Outerwear (cat-outerwear)
 │    └── [Depth 2] Waterproof Storm Shells (cat-storm-shells)
 │         └── Silhouettes: The Bushwhack Storm Anorak
 ├── [Depth 1] Midlayers & Fleece (cat-midlayers)
 └── [Depth 1] Pants & Shorts (cat-pants)
      └── [Depth 2] Technical Brush Pants (cat-brush-pants)
           └── Silhouettes: Bramble-Buster Technical Guide Pant

[Depth 0] Packs & Carry (cat-packs)
 ├── [Depth 1] Lumbar & Sling Packs (cat-sling-packs)
 │    └── [Depth 2] Technical Modular Carry (cat-sling-packs)
 │         └── Silhouettes: The Cutbank Lumbar & Sling Convertible Pack
 ├── [Depth 1] Chest Rigs & Harnesses (cat-chest-rigs)
 │    └── [Depth 2] Modular Chest Workstations (cat-chest-rigs)
 │         └── Silhouettes: Minimalist Bank Chest Rig
 └── [Depth 1] Submersible Bags (cat-dry-bags)

[Depth 0] Field Accessories (cat-accessories)
 ├── [Depth 1] Tool Rolls & Wallets (cat-tool-rolls)
 │    └── [Depth 2] Field Organizers & Wallets (cat-tool-rolls)
 │         └── Silhouettes: Waxed Canvas & Cordura Tool Roll / Leader Wallet
 ├── [Depth 1] Gloves & Handwear (cat-gloves)
 └── [Depth 1] Caps & Headwear (cat-headwear)
      └── [Depth 2] Floating Brim Technical Headwear (cat-headwear)
           └── Silhouettes: The BankBeaters 5-Panel Guide Cap
```

---

## 2. Photographic Style & Art Direction Guide

### A. Primary Studio Hero Shot (Aspect Ratio 1:1)
* **Lighting:** High-CRI directional studio flash with a 5-foot octabox key light and a subtle hard rim light to articulate garment silhouette edges, fabric micro-textures, and seam architecture.
* **Backdrop:** Neutral textured industrial concrete, matte slate stone, or neutral dark grey seamless backdrop. Garments styled on an antiqued steel or dark walnut hanger, or precision-draped flat lay on textured slate.
* **Camera & Optics:** Medium format Hasselblad H6D-100c or Fujifilm GFX 100 II, 110mm f/2 lens stopped down to f/8 for edge-to-edge optical sharpness.
* **Composition:** Dead-center heroic framing, clean negative space around borders, zero digital noise, natural tactile fabric folds without artificial smoothing.

### B. Field Action / Alpine Test Shot (Aspect Ratio 16:9)
* **Lighting:** Overcast, moody Pacific Northwest morning light; heavy fog bank rolling over cold river water; dramatic directional break in storm clouds casting cold rim lighting on wet fabric.
* **Environment:** Glacial headwaters, alder-choked riverbanks, steep 60-degree scree slopes, wet limestone boulders, crashing cutthroat river rapids, rain mist hanging in evergreen canopy.
* **Camera & Optics:** Leica SL2 or Sony A1, 35mm / 50mm f/1.4 Summilux lens at f/2.8 for cinematic environmental depth-of-field; shutter speed 1/1000s freezing rain mist and river spray droplets.
* **Composition:** Rule-of-thirds documentary lifestyle composition; angler or craftsman in mid-action (scrambling over mossy driftwood, stripping line in torrential rain, or climbing granite riprap).

### C. Workbench / Macro Detail Shot (Aspect Ratio 1:1 or 4:3)
* **Lighting:** Single warm 3200K tungsten craftsman task lamp angled at 45 degrees, creating high relief across stitch ridges, heavy thread loops, zipper coils, and wax creases.
* **Environment:** Weathered maple cutting table, scarred pine workbench, antique green cast-iron Consew 206RB industrial sewing machine bed, brass calipers, titanium shears, chalk lines, and spools of bonded nylon thread.
* **Camera & Optics:** Canon EOS R5 with 100mm f/2.8L Macro IS USM, f/4.0 focus bracketed to isolate needle-point bar-tacks, serialized ink stamp, or waterproof zipper tooth engagement.
* **Composition:** Extreme close-up macro framing capturing thread tension, fabric grain cross-hatching, matte polyurethane tape sheen, and laser-cut edges.

---

## 3. Silhouettes & Variations Specification Guide

```yaml
================================================================================
SILHOUETTE 01: THE BUSHWHACK STORM ANORAK
================================================================================
```

### Product Metadata
```yaml
id: "prod-bushwhack-anorak"
title: "The Bushwhack Storm Anorak"
slug: "bushwhack-storm-anorak"
category_path:
  depth_0: "Apparel (cat-apparel)"
  depth_1: "Outerwear (cat-outerwear)"
  depth_2: "Waterproof Storm Shells (cat-storm-shells)"
  breadcrumb: "Apparel > Outerwear > Waterproof Storm Shells"
base_price: 340.00
currency: "USD"
status: "published"
shopify_product_id: "gid://shopify/Product/101"
technical_specs:
  materials: "3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®"
  weight: "21.4 oz (606g)"
  fit_profile: "Relaxed Athletic (Engineered for layering and overhead casting mobility)"
  origin: "Hand-cut & sewn in small batches in Chris's workshop"
maker_field_notes: >
  Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. 
  The 500D Cordura panels on the forearms take the beating so your membrane does not shred 
  on thorny bank scrambles. Features two-way pit-to-hem venting zips.
craft_story: >
  Born from frustration with fragile mountaineering shells destroyed by devil's club and wild blackberry thorns. 
  Every seam is hand-taped with 22mm 3-layer waterproof tape, with 500-denier textured Cordura armor draped across 
  high-abrasion forearm strike zones. The oversized kangaroo pocket allows rapid access to fly boxes without unclipping 
  your chest harness.
```

### Variations (2 Editions)

#### Variation 1.1: Standard Production Run
```yaml
id: "var-anorak-olive"
variation_name: "Field Olive — Standard Run"
sku: "BWK-ANRK-OLV-STD"
variation_type: "standard"
edition_badge: "Standard Production"
batch_size: 25
stock_quantity: 12
price: 340.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Standard production run in bombproof 3-layer olive ripstop with black 500D Cordura scuff guards."
```

#### Variation 1.2: Deadstock Duck Camo Pocket Edition
```yaml
id: "var-anorak-camo-micro"
variation_name: "Deadstock Duck Camo Pocket Edition"
sku: "BWK-ANRK-CAMO-LTD"
variation_type: "micro_batch"
edition_badge: "Only 3 Crafted"
batch_size: 3
stock_quantity: 3
price: 385.00
price_override: 385.00
is_limited_edition: true
release_date: null
status: "active"
notes: >
  Crafted at the sewing bench using salvaged 1990s deadstock Mil-Spec duck camo Cordura 
  for the oversized kangaroo chest drop pouch. Only 3 jackets crafted in this micro-batch run. 
  Signed and numbered interior label.
```

---

### Image Generation Prompts — Silhouette 01

#### Prompt 1.1: Primary Studio Hero (Field Olive — Standard Run)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Commercial product catalog photography, front studio hero shot of a technical waterproof foul-weather storm anorak jacket. Colorway is deep field olive green 3-layer micro-ripstop fabric with matte black 500D Cordura abrasion armor panels on both forearms. Center chest features a high-density kangaroo zip pocket with a matte black YKK AquaGuard waterproof zipper and textured hypalon zipper pull. High storm collar with integrated low-profile brimmed hood. Clean minimalist studio lighting, soft key light with crisp edge rim lighting highlighting technical seam taping and geometric boxy silhouette. Suspended on a minimalist dark slate steel hanger against a clean neutral textured warm grey concrete wall. Hyper-realistic fabric texture, 8k resolution, shot on Hasselblad H6D-100c, 80mm lens, f/8 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 1.2: Primary Studio Hero (Deadstock Duck Camo Pocket Edition)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Clean studio catalog hero photograph of an artisanal technical storm anorak jacket. Body is deep matte alpine olive 3-layer waterproof ripstop. Center chest features an oversized kangaroo drop pocket crafted from genuine vintage 1990s military deadstock brown-and-tan duck camo Cordura canvas, accented with high-visibility blaze orange bartack reinforcement stitching at stress points. Matte black YKK AquaGuard zipper seals. Garment displayed flat lay on a slab of dark rough-hewn basalt stone with precision softbox overhead lighting. Crisp shadows, tack sharp textile weave, zero artifacting, studio quality, Hasselblad 100mm f/9 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 1.3: Field Action / Alpine Storm Test Shot
* **Aspect Ratio:** `16:9`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Cinematic outdoor documentary photography, wide environmental action shot. A rugged fly angler wearing the olive waterproof Bushwhack storm anorak with hood drawn tight, fighting a fish while wading waist-deep in torrential glacial river current. Pacific Northwest hemlock forest, dense river mist, cold torrential rain droplets bouncing off the waterproof ripstop jacket fabric, visible water beading on the DWR shell. Overcast dramatic storm lighting, mist drifting between mossy evergreen trees, dark rushing whitewater rapids. Authentic outdoor apparel editorial, National Geographic style, shot on Leica SL2, 35mm f/2.8, 1/1000s shutter speed --ar 16:9 --v 6.1 --style raw
```

#### Prompt 1.4: Workbench / Macro Detail Shot (Deadstock Camo & Bartacks)
* **Aspect Ratio:** `4:3` (or `1:1`)
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Extreme macro workshop craft photography, close-up on an industrial Consew sewing machine needle plate. Heavy titanium needle poised directly above the seam junction between field olive ripstop and a textured deadstock duck camo pocket flap. High-density safety orange bonded nylon thread forming tight bartack reinforcement stitches across a matte black polyurethane YKK AquaGuard zipper tape. In the background, softly blurred wooden workshop workbench, brass measuring gauge, and a white hand-stamped fabric tag reading 'BankBeaters Workshop Batch 01/03'. Warm directional tungsten task lamp creating rich tactile relief across canvas fibers. Shot on Canon EOS R5 with 100mm f/2.8L Macro --ar 4:3 --v 6.1 --style raw
```

---

```yaml
================================================================================
SILHOUETTE 02: BRAMBLE-BUSTER TECHNICAL GUIDE PANT
================================================================================
```

### Product Metadata
```yaml
id: "prod-bramble-buster-pant"
title: "Bramble-Buster Technical Guide Pant"
slug: "bramble-buster-technical-guide-pant"
category_path:
  depth_0: "Apparel (cat-apparel)"
  depth_1: "Pants & Shorts (cat-pants)"
  depth_2: "Technical Brush Pants (cat-brush-pants)"
  breadcrumb: "Apparel > Pants & Shorts > Technical Brush Pants"
base_price: 215.00
currency: "USD"
status: "published"
shopify_product_id: "gid://shopify/Product/102"
technical_specs:
  materials: "Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels, Mil-Spec Snap Closure"
  weight: "17.8 oz (505g)"
  fit_profile: "Technical Straight (Articulated knees, gusseted seat for steep cut-bank scrambles)"
  origin: "Hand-cut & sewn in small batches in Chris's workshop"
maker_field_notes: >
  Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights 
  or wet-wading socks, taking the direct abuse from blackberry canes and sharp limestone riprap without puncturing.
craft_story: >
  Designed for brutal off-trail bushwhacking along high cut-banks. Built from a 4-way stretch 280gsm 
  technical weave treated with fluorocarbon-free DWR, then armored across the entire front knee and inner ankle 
  instep with 1000-denier coated Cordura. Includes an integrated low-profile webbing belt and zippered thigh vents.
```

### Variations (3 Editions)

#### Variation 2.1: Size 32 / Regular (Standard)
```yaml
id: "var-pant-32"
variation_name: "Size 32 / Regular (Standard)"
sku: "BMB-PNT-32R"
variation_type: "standard"
edition_badge: "Standard Run"
batch_size: 30
stock_quantity: 8
price: 215.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Standard production run in dark peat grey 4-way stretch ripstop with black 1000D Cordura knee overlays."
```

#### Variation 2.2: Size 34 / Regular (Standard)
```yaml
id: "var-pant-34"
variation_name: "Size 34 / Regular (Standard)"
sku: "BMB-PNT-34R"
variation_type: "standard"
edition_badge: "Standard Run"
batch_size: 30
stock_quantity: 10
price: 215.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Standard production run in dark peat grey 4-way stretch ripstop with black 1000D Cordura knee overlays."
```

#### Variation 2.3: Micro-Batch Deadstock Camo Knee Edition
```yaml
id: "var-pant-camo-knees"
variation_name: "Micro-Batch Deadstock Camo Knee Edition"
sku: "BMB-PNT-CAMO-LTD"
variation_type: "micro_batch"
edition_badge: "Only 4 Crafted"
batch_size: 4
stock_quantity: 4
price: 245.00
price_override: 245.00
is_limited_edition: true
release_date: null
status: "active"
notes: >
  Workbench micro-batch built with rare deadstock Mil-Spec camo Cordura knee reinforcements 
  and high-tensile orange bar-tacks.
```

---

### Image Generation Prompts — Silhouette 02

#### Prompt 2.1: Primary Studio Hero (Peat Grey / Black Cordura Standard)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Commercial studio product photography of technical rugged outdoor guide pants. Full silhouette flat lay arranged symmetrically on a smooth dark graphite backdrop. Color is matte dark peat grey heavyweight stretch ripstop fabric with heavy-duty black 1000D Cordura protective knee patches and reinforced inner ankle cuff scuff guards. Ergonomic articulated knee darts, dual low-profile zippered thigh pockets with matte coil zips, diamond gusseted crotch. Crisp studio side-lighting casting subtle dimensional shadows under seams. Ultra-clean, razor-sharp weave detail, high-end technical outdoor apparel lookbook, shot on Hasselblad GFX 100 II, f/8 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 2.2: Primary Studio Hero (Micro-Batch Deadstock Camo Knee Edition)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Studio catalog hero shot of limited edition technical guide pants. Main body in matte peat charcoal stretch canvas, featuring double-layered knee articulation panels crafted from vintage 1990s deadstock woodland camouflage Cordura. Vibrant high-tensile international orange bartack stitching securing pocket corners and belt loops. Suspended naturally on industrial black steel garment clips against an off-white plaster wall. Directional soft diffused studio strobe, showing crisp texture contrast between smooth stretch body and coarse textured camo fabric. Medium format camera, 80mm lens, tack sharp --ar 1:1 --v 6.1 --style raw
```

#### Prompt 2.3: Field Action / Scree Scramble Test Shot
* **Aspect Ratio:** `16:9`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Authentic documentary field testing photograph. Low angle action shot of an angler's legs clad in Bramble-Buster technical brush pants and wading boots scrambling up a steep 60-degree loose scree and mud riverbank. Thick wild blackberry briars and sharp thorn branches brushing directly against the heavy Cordura knee panels. Damp river pebbles, muddy clay embankment, rushing mountain stream in the background with splashing cold water droplets. Overcast morning light, gritty authentic outdoor adventure editorial, shot on Sony A1, 50mm f/2.5, fast shutter speed, filmic color grading --ar 16:9 --v 6.1 --style raw
```

#### Prompt 2.4: Workbench / Macro Detail Shot (Triple Stitch & Orange Bartacks)
* **Aspect Ratio:** `4:3`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Extreme macro detail shot on a craftsman work table. Focus on the articulated knee seam of the technical guide pant: triple heavy-gauge parallel needle stitching connecting the charcoal stretch ripstop to the rugged deadstock camo Cordura overlay. Thick high-visibility safety orange bartack reinforcement stitches anchoring a webbing attachment point. Heavy bonded nylon thread texture, individual weave fibers clearly visible, chalk cutting line faintly visible on the fabric. Natural raking workshop light from an angle, shallow depth of field, Canon 100mm Macro f/3.2 --ar 4:3 --v 6.1 --style raw
```

---

```yaml
================================================================================
SILHOUETTE 03: THE CUTBANK LUMBAR & SLING CONVERTIBLE PACK
================================================================================
```

### Product Metadata
```yaml
id: "prod-cutbank-sling-pack"
title: "The Cutbank Lumbar & Sling Convertible Pack"
slug: "the-cutbank-lumbar-sling-pack"
category_path:
  depth_0: "Packs & Carry (cat-packs)"
  depth_1: "Lumbar & Sling Packs (cat-sling-packs)"
  depth_2: "Technical Modular Carry (cat-sling-packs)"
  breadcrumb: "Packs & Carry > Lumbar & Sling Packs > Technical Modular Carry"
base_price: 195.00
currency: "USD"
status: "published"
shopify_product_id: "gid://shopify/Product/103"
technical_specs:
  materials: "Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, YKK AquaGuard®, Hypalon Plier Dock"
  weight: "14.2 oz (402g)"
  fit_profile: "Ambidextrous Sling / Lumbar Switchable with Breathable 3D Spacer Mesh"
  origin: "Hand-crafted in Chris's workshop"
maker_field_notes: >
  When you are wading chest-deep or scrambling over downed timber, you need your pack out of your stroke 
  until the second you land a fish. The Cutbank swings smoothly from lumbar to chest with one hand, 
  featuring an integrated magnetic net dock.
craft_story: >
  Constructed from Dimension-Polyant VX21 laminate, featuring an iconic diamond structural grid that guarantees 
  100% waterproof protection against torrential downpours. Fitted with laser-cut Hypalon plier holsters, an ergonomic 
  pass-through net sleeve with embedded neodymium magnetic lock, and an ambidextrous strap that rotates 
  seamlessly from lumbar support to front workstation.
```

### Variations (2 Editions)

#### Variation 3.1: Standard Production Edition
```yaml
id: "var-cutbank-slate"
variation_name: "VX21 Slate Grey — Standard Edition"
sku: "CTB-SLG-GRY-STD"
variation_type: "standard"
edition_badge: "Standard Production"
batch_size: 40
stock_quantity: 15
price: 195.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Clean slate grey dimension-polyant VX21 technical sailcloth with black 500D Cordura bottom and stealth hardware."
```

#### Variation 3.2: Micro-Batch Coyote & Blaze Orange
```yaml
id: "var-cutbank-coyote"
variation_name: "Coyote Tan & Blaze Orange Micro-Run"
sku: "CTB-SLG-CYT-LTD"
variation_type: "micro_batch"
edition_badge: "Only 5 Crafted"
batch_size: 5
stock_quantity: 5
price: 225.00
price_override: 225.00
is_limited_edition: true
release_date: null
status: "active"
notes: >
  Micro-batch crafted with Coyote Tan X-Pac VX21 exterior shell and high-visibility blaze orange internal 
  packcloth liner for quick tackle identification.
```

---

### Image Generation Prompts — Silhouette 03

#### Prompt 3.1: Primary Studio Hero (VX21 Slate Grey Standard)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Studio catalog product hero photograph of a premium technical lumbar sling pack. Body constructed from waterproof Dimension-Polyant VX21 sailcloth in matte slate grey with subtle black diamond grid lines visible across the surface. Bottom panel in heavy black 500D Cordura. Laser-cut hypalon tool attachment dock on the side, matte black water-resistant YKK AquaGuard zipper arcs across the top lid. Clean ambidextrous padded shoulder strap with breathable black 3D spacer mesh underside resting beside the pack. Pack standing upright on a rough dark slate platform against a neutral charcoal backdrop. Professional studio lighting, sharp rim highlights on the composite sailcloth geometry, 8k resolution, Hasselblad 907X --ar 1:1 --v 6.1 --style raw
```

#### Prompt 3.2: Primary Studio Hero (Coyote Tan & Blaze Orange Micro-Run)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Commercial product photograph of a handcrafted outdoor convertible sling pack. Shell is rugged Coyote Tan X-Pac VX21 composite fabric with distinctive black reinforcement diamond grid. The main compartment zipper is unzipped 2 inches to reveal a glimpse of vibrant high-visibility blaze orange interior packcloth lining. External hypalon plier sheath with titanium forceps clipped in place. Displayed heroically on a solid block of reclaimed cedar timber against a warm grey background. Soft balanced dual studio strobes highlighting sailcloth texture and clean precision needlework, shot on Sony A7R V, 90mm f/5.6 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 3.3: Field Action / Deep Wading Riverbank Test Shot
* **Aspect Ratio:** `16:9`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Dramatic outdoor documentary photograph of an angler standing in a raging emerald mountain river in British Columbia. Angler wearing the Coyote Tan Cutbank sling pack swung around to their front chest, one hand pulling a handcrafted fly box from the wide-open main compartment, revealing the blaze orange interior contrast. Behind the angler, a carbon fiber landing net is docked securely in the rear magnetic net sleeve. River mist curling around granite boulders, cold rain dripping from spruce branches overhead. Filmic editorial style, natural moody mountain illumination, Leica SL2, 50mm Summilux f/2.0 --ar 16:9 --v 6.1 --style raw
```

#### Prompt 3.4: Workbench / Macro Detail Shot (X-Pac Weave & Hypalon Dock)
* **Aspect Ratio:** `4:3`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Extreme macro photograph on a craftsman leather and fabric workbench. Extreme close-up of the Hypalon tool dock riveted with black oxidized brass grommets into the Coyote Tan X-Pac sailcloth. High-density black nylon binding tape with clean double-needle edge stitching. The diamond grid of the composite laminate catches the raking warm tungsten lamp light. Beside the seam sits a wooden-handled awl and a leather stamp mark reading 'BankBeaters 04/05'. Impeccable focus on fabric fibers and composite layers, Canon 100mm Macro f/2.8 --ar 4:3 --v 6.1 --style raw
```

---

```yaml
================================================================================
SILHOUETTE 04: MINIMALIST BANK CHEST RIG
================================================================================
```

### Product Metadata
```yaml
id: "prod-minimalist-chest-rig"
title: "Minimalist Bank Chest Rig"
slug: "minimalist-bank-chest-rig"
category_path:
  depth_0: "Packs & Carry (cat-packs)"
  depth_1: "Chest Rigs & Harnesses (cat-chest-rigs)"
  depth_2: "Modular Chest Workstations (cat-chest-rigs)"
  breadcrumb: "Packs & Carry > Chest Rigs & Harnesses > Modular Chest Workstations"
base_price: 135.00
currency: "USD"
status: "published"
shopify_product_id: "gid://shopify/Product/104"
technical_specs:
  materials: "500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch, Duraflex® Mojave Buckles"
  weight: "9.6 oz (272g)"
  fit_profile: "Low-Profile 4-Point Harness (Rides high above deep wading lines)"
  origin: "Hand-crafted in Chris's workshop"
maker_field_notes: >
  Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking 
  your terminal fly boxes. Fold-down front panel creates an instant workbench for knot-tying in heavy river current.
craft_story: >
  Engineered specifically for deep wading where conventional lumbar packs submerge. Features a fold-down 
  rigid drop shelf that holds terminal tackle horizontally like a suspended workbench. Equipped with interchangeable 
  hook pads, laser-cut drainage grommets, and a low-profile 4-point harness that fits comfortably under backpack straps.
```

### Variations (2 Editions)

#### Variation 4.1: Ranger Olive Standard Station
```yaml
id: "var-chestrig-ranger"
variation_name: "Ranger Olive — Standard Station"
sku: "MCR-RIG-OLV-STD"
variation_type: "standard"
edition_badge: "Standard Run"
batch_size: 35
stock_quantity: 12
price: 135.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Standard production run in Ranger Olive 500D Cordura with coyote webbing and laser-cut drainage ports."
```

#### Variation 4.2: Archive Workshop Prototype 01
```yaml
id: "var-chestrig-proto"
variation_name: "Archive Workshop Prototype 01"
sku: "MCR-RIG-PROTO-01"
variation_type: "one_of_one"
edition_badge: "One-of-One Archive"
batch_size: 1
stock_quantity: 1
price: 175.00
price_override: 175.00
is_limited_edition: true
release_date: null
status: "active"
notes: >
  Chris personal workshop prototype used during spring cutthroat testing on the North Umpqua River. 
  Signed and dated 01/01 inside the fold-down fly station.
```

---

### Image Generation Prompts — Silhouette 04

#### Prompt 4.1: Primary Studio Hero (Ranger Olive Standard Station)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Studio catalog product hero shot of an ultralight minimalist technical chest rig. Built from 500D Mil-Spec Cordura in matte Ranger Olive with Coyote Tan nylon webbing straps and Duraflex Mojave quick-release buckles. The front fold-down panel is partially unzipped to show the high-density ripple EVA foam fly patch with several hand-tied streamers attached. Clean 4-point webbing harness neatly arranged behind the main station. Neutral cool grey studio background, overhead diffused softbox light with subtle fill, highlighting clean edge binding, matte plastic hardware, and Cordura weave texture. Commercial catalog aesthetic, Hasselblad GFX 100S, 110mm f/8 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 4.2: Primary Studio Hero (Archive Workshop Prototype 01)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Fine craft studio photograph of a one-of-a-kind field prototype chest rig. Olive Cordura fabric shows subtle authentic field-testing patina, minor water staining, and hand-stitched leather reinforcement patches on the harness anchors. Folded open on a weathered dark oak workbench to reveal a handwritten ink archival signature on the interior pocket: 'BankBeaters Proto #01 - North Umpqua 2026'. Surrounding the rig are hand-tied steelhead flies, brass forceps, and a spool of fluorocarbon tippet. Warm side lighting creating rich tactile shadows, Hasselblad 80mm lens, f/5.6, museum artifact presentation --ar 1:1 --v 6.1 --style raw
```

#### Prompt 4.3: Field Action / Deep River Wading Test Shot
* **Aspect Ratio:** `16:9`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Cinematic lifestyle action photography in wild backcountry. Angler wading deep into chest-high foaming river rapids under a dense Pacific Northwest pine forest canopy. The Ranger Olive chest rig rides high on the upper chest, completely clear of the churning whitewater. The front shelf is folded flat horizontally, forming an impromptu tying station as the angler threads a tippet through a hook eye in the rain. Water spray freezing in air, overcast moody mountain ambiance, cold blue and forest green tones, Leica SL2, 50mm f/2, shutter 1/800s --ar 16:9 --v 6.1 --style raw
```

#### Prompt 4.4: Workbench / Macro Detail Shot (EVA Foam & Prototype Label)
* **Aspect Ratio:** `4:3`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Extreme macro workshop craft photography. Close-up inside the opened fold-down workstation of the prototype chest rig. Textured high-density grey EVA foam micro-slits holding barbed fishing hooks, beside a crisp black Mil-Spec Cordura seam with double bartacks. Visible hand-stamped serialized white twill label: 'ARCHIVE 01/01 - PROTOTYPE - BB CO.'. Industrial sewing machine presser foot visible in soft background focus. Warm directional workbench task light highlighting needle holes and thread tension, Canon 100mm f/2.8L Macro --ar 4:3 --v 6.1 --style raw
```

---

```yaml
================================================================================
SILHOUETTE 05: WAXED CANVAS & CORDURA TOOL ROLL / LEADER WALLET
================================================================================
```

### Product Metadata
```yaml
id: "prod-waxed-tool-roll"
title: "Waxed Canvas & Cordura Tool Roll / Leader Wallet"
slug: "waxed-canvas-cordura-tool-roll"
category_path:
  depth_0: "Field Accessories (cat-accessories)"
  depth_1: "Tool Rolls & Wallets (cat-tool-rolls)"
  depth_2: "Field Organizers & Wallets (cat-tool-rolls)"
  breadcrumb: "Field Accessories > Tool Rolls & Wallets > Field Organizers & Wallets"
base_price: 75.00
currency: "USD"
status: "published"
shopify_product_id: "gid://shopify/Product/105"
technical_specs:
  materials: "12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth, Solid Antiqued Brass Snaps"
  weight: "6.5 oz (184g)"
  fit_profile: "Tri-Fold Compact (Fits into any thigh pocket or pack exterior sleeve)"
  origin: "Hand-cut, waxed, and stitched with bonded nylon thread"
maker_field_notes: >
  Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina. 
  Lined with blaze orange packcloth so terminal split-shot and micro-swivels never get lost in low dusk light.
craft_story: >
  A tri-fold pocket workstation tailored for leader spools, tying tools, and split-shot. 
  Crafted from genuine American-made 12oz Martexin waxed canvas that patinas uniquely with every river trip. 
  Interior slots are lined with water-resistant 420D safety orange packcloth, bound with heavy herringbone tape 
  and locked with custom antiqued heavy brass snaps.
```

### Variations (2 Editions)

#### Variation 5.1: Field Tan Waxed Canvas
```yaml
id: "var-toolroll-tan"
variation_name: "Field Tan Waxed Canvas"
sku: "WTR-ROL-TAN-STD"
variation_type: "standard"
edition_badge: "Workshop Standard"
batch_size: 50
stock_quantity: 20
price: 75.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Traditional Field Tan Martexin waxed canvas with contrast heavy natural stitching and blaze orange interior."
```

#### Variation 5.2: Dark Charcoal Waxed Canvas
```yaml
id: "var-toolroll-charcoal"
variation_name: "Dark Charcoal Waxed Canvas"
sku: "WTR-ROL-DRK-STD"
variation_type: "standard"
edition_badge: "Workshop Standard"
batch_size: 50
stock_quantity: 18
price: 75.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Dark Charcoal weather-treated waxed canvas with black oxide brass snaps and blaze orange interior."
```

---

### Image Generation Prompts — Silhouette 05

#### Prompt 5.1: Primary Studio Hero (Field Tan Waxed Canvas Tri-Fold)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Studio product catalog hero photography of an artisanal tri-fold tool roll and leader wallet. Exterior is heavyweight 12oz Martexin waxed cotton canvas in golden Field Tan with natural wax crease patina lines. Closed tri-fold configuration fastened by dual antiqued solid brass heavy-duty snap buttons embossed with a subtle geometric compass chop mark. Resting on a dark honed granite tabletop against a warm neutral studio background. Soft directional key light grazing across the waxy canvas surface to accentuate rich patina and heavy off-white bonded nylon contrast stitching. Clean commercial look, Hasselblad H6D-100c, 100mm f/8 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 5.2: Primary Studio Hero (Dark Charcoal Waxed Canvas Opened)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Studio product photograph of a tri-fold field organizer wallet laid completely flat open. Exterior flaps are weather-treated Dark Charcoal waxed canvas; interior displays six tailored organizing slots lined in high-visibility blaze orange 420D packcloth. Slots contain three fluorocarbon tippet spools, stainless steel hemostats, and a small brass hook sharpener stone. Matte black oxidized brass snap studs visible on edge tabs. Flat-lay arrangement on a clean industrial light concrete surface with soft overhead daylight strobe. Tack-sharp edges, vibrant orange contrast against charcoal wax, Fujifilm GFX 100 II, 90mm f/8 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 5.3: Field Action / Riverbank Boulder Setup Shot
* **Aspect Ratio:** `16:9`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Atmospheric lifestyle documentary photograph taken on a misty riverbank boulder in Montana. The Field Tan waxed canvas tool roll is unrolled open on a flat mossy river rock beside an active rushing freestone trout stream. Angler's wet hands pulling a spool of tippet from the bright blaze orange interior slot. Fly rod resting on river stones in background with blurred water ripples and autumn foliage. Natural overcast morning lighting, water droplets on the waxed canvas surface showing natural water-shedding beading. Rich environmental story, Leica M11, 35mm Summilux f/2.4 --ar 16:9 --v 6.1 --style raw
```

#### Prompt 5.4: Workbench / Macro Detail Shot (Wax Patina & Antiqued Snaps)
* **Aspect Ratio:** `4:3`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Extreme macro craft photography of hand-sewn leather and canvas gear. Macro shot focusing on an antiqued solid brass snap button installed into 12oz Field Tan Martexin waxed canvas. Intricate wax pull-up creases radiate out from the brass rivet. Heavy bonded nylon thread stitch line running parallel with 8 stitches per inch, showing deep thread tension into the waxy fabric. In the shallow background, vintage metal ruler, wax bar, and hand shears on an oily maple workbench. Warm artisan workshop mood, Canon 100mm Macro f/2.8 --ar 4:3 --v 6.1 --style raw
```

---

```yaml
================================================================================
SILHOUETTE 06: THE BANKBEATERS 5-PANEL GUIDE CAP
================================================================================
```

### Product Metadata
```yaml
id: "prod-5panel-guide-cap"
title: "The BankBeaters 5-Panel Guide Cap"
slug: "the-bankbeaters-5-panel-guide-cap"
category_path:
  depth_0: "Field Accessories (cat-accessories)"
  depth_1: "Caps & Headwear (cat-headwear)"
  depth_2: "Floating Brim Technical Headwear (cat-headwear)"
  breadcrumb: "Field Accessories > Caps & Headwear > Floating Brim Technical Headwear"
base_price: 44.00
currency: "USD"
status: "published"
shopify_product_id: "gid://shopify/Product/106"
technical_specs:
  materials: "Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim, Antiqued Brass Mesh Eyelets"
  weight: "2.9 oz (82g)"
  fit_profile: "Low Crown 5-Panel with Nylon Webbing Quick-Release Adjuster"
  origin: "Sewn and shaped in workshop"
maker_field_notes: >
  If your hat blows off in a river rapid, normal caps sink immediately. We built this with an EVA foam core brim 
  that stays buoyant and recovers its shape after being stuffed into a pack for three days.
craft_story: >
  An expedition 5-panel guide cap engineered to survive being dunked, crumpled, and sweated through. 
  Built around an unsinkable closed-cell EVA foam brim that floats indefinitely in heavy current. 
  Underbill is lined with anti-glare dark charcoal twill to maximize subsurface river visibility. 
  Finished with antiqued brass mesh ventilation grommets and a rear nylon webbing cinch with quick-release acetal buckle.
```

### Variations (2 Editions)

#### Variation 6.1: Waxed River Olive
```yaml
id: "var-cap-olive"
variation_name: "Waxed River Olive"
sku: "GDC-CAP-OLV"
variation_type: "standard"
edition_badge: "Hand-Shaped"
batch_size: 50
stock_quantity: 25
price: 44.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Waxed river olive crown with dark charcoal glare-reducing underbill and custom stamped leather brand patch."
```

#### Variation 6.2: Waxed Bark Brown
```yaml
id: "var-cap-bark"
variation_name: "Waxed Bark Brown"
sku: "GDC-CAP-BRK"
variation_type: "standard"
edition_badge: "Hand-Shaped"
batch_size: 50
stock_quantity: 25
price: 44.00
price_override: null
is_limited_edition: true
release_date: null
status: "active"
notes: "Waxed bark brown canvas crown with dark olive underbill and brass mesh side ventilation ports."
```

---

### Image Generation Prompts — Silhouette 06

#### Prompt 6.1: Primary Studio Hero (Waxed River Olive Hand-Shaped)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Commercial studio catalog product hero photography of a premium 5-panel outdoor guide cap. Low-profile crown constructed from water-repellent dry-finish waxed cotton canvas in rich River Olive green. Front center panel features a subtle debossed dark brown vegetable-tanned leather patch with the BankBeaters outdoor emblem. Antiqued brass mesh circular eyelets on side panels. Curved flexible visor showing dense multi-row tonal brim stitching. Cap resting at a 3/4 hero angle on a pedestal of weathered Pacific driftwood against a clean warm grey background. Soft balanced studio lighting emphasizing the matte wax fabric sheen and sculpted panel geometry, Hasselblad H6D-100c, 100mm f/9 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 6.2: Primary Studio Hero (Waxed Bark Brown Hand-Shaped)
* **Aspect Ratio:** `1:1`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Product catalog hero photograph of a rugged 5-panel field cap in Waxed Bark Brown canvas. Front 3/4 perspective angled slightly upward to show the dark charcoal anti-glare canvas underbill. Rear displays an adjustable black nylon webbing strap with a low-profile matte black quick-release buckle. Sits on a minimalist square pedestal of rough natural slate stone against a dark neutral studio background. Dual studio flash with soft overhead diffuser, capturing the organic weave and heavy thread reinforcement around the eyelets and brim, Sony A7R V, 90mm f/8 --ar 1:1 --v 6.1 --style raw
```

#### Prompt 6.3: Field Action / Floating Brim River Rapid Test Shot
* **Aspect Ratio:** `16:9`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
High-speed documentary adventure photography in an alpine river. The Waxed River Olive 5-panel cap floating high and buoyant atop crystal-clear swirling mountain whitewater rapids, demonstrating the unsinkable EVA foam brim. Splashing cold water droplets, sunlight breaking through forest mist catching water droplets on the water-resistant waxed crown. In the softly blurred background, riverbank gravel bar, towering douglas firs, and an angler wading. Action sports editorial, crisp 1/2000s shutter speed, Nikon Z9, 70-200mm f/2.8 at 135mm --ar 16:9 --v 6.1 --style raw
```

#### Prompt 6.4: Workbench / Macro Detail Shot (Leather Patch & Brass Mesh Eyelet)
* **Aspect Ratio:** `4:3`
* **Target Platforms:** Midjourney v6.1 / Imagen 3 / FLUX.1
```text
Extreme macro craft photography of hat construction details. Close-up on the side panel of the Waxed Bark Brown cap: a circular antiqued brass mesh ventilation eyelet seated cleanly in the thick waxed cotton weave. Next to it, the perimeter of a thick vegetable-tanned leather patch showing deep heat-debossed typography and edge burnishing, held by tight lockstitch thread. Workshop background with wooden tailor's pressing ham, chalk, and brass setting die. Warm task lamp illumination highlighting texture and metallic patina, Canon 100mm Macro f/3.5 --ar 4:3 --v 6.1 --style raw
```

---

## 4. Master Variation Matrix & CMS Lookup Table

| Product Title | Variation Name | SKU | Variation Type | Edition Badge | Batch / Cap | Base Price | Effective Price | Primary Focus Feature |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bushwhack Storm Anorak** | Field Olive — Standard Run | `BWK-ANRK-OLV-STD` | `standard` | `Standard Production` | 25 | \$340.00 | \$340.00 | 500D Cordura Forearm Armor |
| **Bushwhack Storm Anorak** | Deadstock Duck Camo Pocket Edition | `BWK-ANRK-CAMO-LTD` | `micro_batch` | `Only 3 Crafted` | 3 | \$340.00 | \$385.00 | 1990s Deadstock Duck Camo Pouch |
| **Bramble-Buster Guide Pant** | Size 32 / Regular (Standard) | `BMB-PNT-32R` | `standard` | `Standard Run` | 30 | \$215.00 | \$215.00 | 1000D Cordura Knee & Cuff Armor |
| **Bramble-Buster Guide Pant** | Size 34 / Regular (Standard) | `BMB-PNT-34R` | `standard` | `Standard Run` | 30 | \$215.00 | \$215.00 | 1000D Cordura Knee & Cuff Armor |
| **Bramble-Buster Guide Pant** | Deadstock Camo Knee Edition | `BMB-PNT-CAMO-LTD` | `micro_batch` | `Only 4 Crafted` | 4 | \$215.00 | \$245.00 | Deadstock Camo Knees + Orange Bartacks |
| **The Cutbank Lumbar/Sling** | VX21 Slate Grey — Standard | `CTB-SLG-GRY-STD` | `standard` | `Standard Production` | 40 | \$195.00 | \$195.00 | Slate Grey VX21 Diamond Sailcloth |
| **The Cutbank Lumbar/Sling** | Coyote Tan & Blaze Orange | `CTB-SLG-CYT-LTD` | `micro_batch` | `Only 5 Crafted` | 5 | \$195.00 | \$225.00 | Coyote VX21 + Hi-Vis Blaze Orange Liner |
| **Minimalist Bank Chest Rig** | Ranger Olive — Standard Station | `MCR-RIG-OLV-STD` | `standard` | `Standard Run` | 35 | \$135.00 | \$135.00 | Fold-Down Workbench Shelf & EVA Patch |
| **Minimalist Bank Chest Rig** | Archive Workshop Prototype 01 | `MCR-RIG-PROTO-01` | `one_of_one` | `One-of-One Archive` | 1 | \$135.00 | \$175.00 | Signed/Dated 01/01 North Umpqua Prototype |
| **Waxed Canvas Tool Roll** | Field Tan Waxed Canvas | `WTR-ROL-TAN-STD` | `standard` | `Workshop Standard` | 50 | \$75.00 | \$75.00 | 12oz Martexin Tan Canvas + Brass Snaps |
| **Waxed Canvas Tool Roll** | Dark Charcoal Waxed Canvas | `WTR-ROL-DRK-STD` | `standard` | `Workshop Standard` | 50 | \$75.00 | \$75.00 | Dark Charcoal Wax + Black Oxide Snaps |
| **5-Panel Guide Cap** | Waxed River Olive | `GDC-CAP-OLV` | `standard` | `Hand-Shaped` | 50 | \$44.00 | \$44.00 | Floatable EVA Foam Brim + Leather Emblem |
| **5-Panel Guide Cap** | Waxed Bark Brown | `GDC-CAP-BRK` | `standard` | `Hand-Shaped` | 50 | \$44.00 | \$44.00 | Floatable EVA Brim + Brass Mesh Eyelets |

---

## 5. Implementation & R2 Asset Key Mapping

When uploading rendered assets to Cloudflare R2 and linking through Payload CMS v3, map file names to the canonical schema established in `apps/web/src/lib/r2-image.ts` and `scripts/seed-db.ts`:

* **Studio Hero Images (1:1):**
  * `bushwhack-anorak-olive.webp`
  * `bramble-pant-featured.webp`
  * `cutbank-sling-featured.webp`
  * `chest-rig-featured.webp`
  * `tool-roll-featured.webp`
  * `guide-cap-featured.webp`

* **Variation Workbench Detail Images (4:3 / 1:1):**
  * `camo-pocket-bench-1.webp` (Bushwhack Camo Pouch machine bench)
  * `camo-pocket-bench-2.webp` (AquaGuard zipper bartack & edition tag)
  * `bramble-camo-knee-bench.webp` (Guide Pant camo knee overlay)
  * `cutbank-coyote-bench.webp` (Coyote sailcloth & blaze orange bind)
  * `chest-rig-proto-bench.webp` (Hand-numbered 01/01 prototype label)

* **Field Action & Angle Images (16:9):**
  * `bushwhack-anorak-front.webp`, `bushwhack-anorak-pocket.webp`, `bushwhack-anorak-cuff.webp`
  * `bramble-pant-knees.webp`, `bramble-pant-cuff.webp`
  * `cutbank-sling-net.webp`, `cutbank-sling-internal.webp`
  * `chest-rig-open.webp`, `chest-rig-harness.webp`
  * `tool-roll-open.webp`, `tool-roll-snaps.webp`
  * `guide-cap-side.webp`, `guide-cap-brim.webp`
