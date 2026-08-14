/**
 * The dummy catalog. This file is the whole of the fake data — when the admin's
 * commerce API is wired in, this file is replaced and nothing else moves,
 * because every read goes through `catalog.ts`.
 *
 * THE REVIEWS BELOW ARE INVENTED. They exist so the reviews UI can be built and
 * looked at. They must never be presented on a live store as customer reviews;
 * `SHOW_FIXTURE_REVIEWS` in `config.ts` is the switch that keeps them off it.
 */

import type {
  BulkTier,
  Category,
  Colour,
  Material,
  PrintingParameters,
  Product,
} from "./types";

/** Keyed by id, so every product references one shared definition of each
 *  colour rather than re-declaring hexes — the same red is the same red
 *  everywhere it appears. */
export const COLOURS: Record<string, Colour> = {
  "obsidian-black": { id: "obsidian-black", name: "Obsidian black", hex: "#101014", inStock: true },
  "arctic-white": { id: "arctic-white", name: "Arctic white", hex: "#F4F4F6", inStock: true },
  "signal-red": { id: "signal-red", name: "Signal red", hex: "#C42B2B", inStock: true },
  "lagos-orange": { id: "lagos-orange", name: "Lagos orange", hex: "#E2620F", inStock: true },
  "solar-yellow": { id: "solar-yellow", name: "Solar yellow", hex: "#E8B71A", inStock: false },
  "palm-green": { id: "palm-green", name: "Palm green", hex: "#1F7A4C", inStock: true },
  "deep-teal": { id: "deep-teal", name: "Deep teal", hex: "#12626B", inStock: true },
  "cobalt-blue": { id: "cobalt-blue", name: "Cobalt blue", hex: "#1B4FA8", inStock: true },
  "brand-navy": { id: "brand-navy", name: "Spool navy", hex: "#231C50", inStock: true },
  "ash-grey": { id: "ash-grey", name: "Ash grey", hex: "#8A8A94", inStock: true },
  "clay-brown": { id: "clay-brown", name: "Clay brown", hex: "#7A4B2A", inStock: true },
  magenta: { id: "magenta", name: "Magenta", hex: "#A8246B", inStock: false },
  natural: { id: "natural", name: "Natural", hex: "#E8E4D8", inStock: true },
  "glow-green": { id: "glow-green", name: "Glow green", hex: "#9CE07A", inStock: true },
  "silk-copper": { id: "silk-copper", name: "Silk copper", hex: "#B4703A", inStock: true },
  "silk-silver": { id: "silk-silver", name: "Silk silver", hex: "#C7CBD1", inStock: true },
  "carbon-black": { id: "carbon-black", name: "Carbon black", hex: "#26262B", inStock: true },
};

/** Resolves shared colours by id, so a product lists which colours it carries
 *  without re-declaring their hex values. Not exported — `COLOURS` itself is
 *  the shared vocabulary; this is just how products read from it. */
function pick(...ids: string[]): Colour[] {
  return ids.map((id) => COLOURS[id]);
}

/** Six categories. `support` is deliberately empty — no product carries that
 *  `categorySlug` — so the "no products in this category" state is reachable
 *  from the nav rather than only imagined. */
export const CATEGORIES: Category[] = [
  {
    slug: "pla",
    name: "PLA",
    blurb: "The everyday filament. Easy to print, dimensionally stable, no enclosure needed.",
    accentHex: "#1B4FA8",
  },
  {
    slug: "pla-plus",
    name: "PLA+",
    blurb: "Tougher PLA. Higher impact strength for parts that get handled.",
    accentHex: "#1F7A4C",
  },
  {
    slug: "petg",
    name: "PETG",
    blurb: "Water-resistant and impact-tough. For enclosures, brackets and outdoor parts.",
    accentHex: "#12626B",
  },
  {
    slug: "abs",
    name: "ABS & ASA",
    blurb: "Heat-resistant engineering plastics. Both want an enclosure.",
    accentHex: "#C42B2B",
  },
  {
    slug: "tpu",
    name: "TPU",
    blurb: "Flexible filament for gaskets, grips and phone cases.",
    accentHex: "#E2620F",
  },
  {
    slug: "support",
    name: "Support material",
    blurb: "Break-away and dissolvable supports.",
    accentHex: "#8A8A94",
  },
];

/** The standard bulk ladder. Used by every product except the three premium
 *  materials below, which discount less steeply. */
export const STANDARD_TIERS: BulkTier[] = [
  { minQty: 4, discountPct: 10 },
  { minQty: 6, discountPct: 15 },
  { minQty: 10, discountPct: 22 },
];

export const PREMIUM_TIERS: BulkTier[] = [
  { minQty: 4, discountPct: 8 },
  { minQty: 10, discountPct: 15 },
];

/** Per-material printing parameters and their default handling note. Spread
 *  into each product below; a product may override `handlingNote` with a
 *  warning specific to its own formulation (matte PLA's softer strand,
 *  carbon-fibre PETG's nozzle wear, and so on). Not exported — a product's
 *  own `parameters` field, already merged, is the public shape. */
const PARAMS: Record<Material, PrintingParameters> = {
  PLA: {
    extruderTempC: [190, 220],
    bedTempC: [45, 60],
    printSpeedMmS: [40, 180],
    fanPercent: 100,
    densityGCm3: 1.24,
    diameterToleranceMm: 0.02,
    dryingTempC: 45,
    dryingHours: 6,
    enclosureRequired: false,
    handlingNote:
      "Keep spools sealed with desiccant between prints. PLA absorbs moisture slowly, but a damp spool prints with visible stringing.",
  },
  "PLA+": {
    extruderTempC: [205, 230],
    bedTempC: [50, 65],
    printSpeedMmS: [40, 200],
    fanPercent: 100,
    densityGCm3: 1.25,
    diameterToleranceMm: 0.02,
    dryingTempC: 45,
    dryingHours: 6,
    enclosureRequired: false,
    handlingNote:
      "Keep spools sealed with desiccant between prints. PLA absorbs moisture slowly, but a damp spool prints with visible stringing.",
  },
  PETG: {
    extruderTempC: [230, 250],
    bedTempC: [70, 85],
    printSpeedMmS: [30, 120],
    fanPercent: 50,
    densityGCm3: 1.27,
    diameterToleranceMm: 0.03,
    dryingTempC: 65,
    dryingHours: 6,
    enclosureRequired: false,
    handlingNote:
      "PETG sticks hard to smooth PEI. Use glue stick as a release layer or you will pull chunks out of the sheet.",
  },
  ABS: {
    extruderTempC: [235, 265],
    bedTempC: [90, 110],
    printSpeedMmS: [30, 100],
    fanPercent: 0,
    densityGCm3: 1.04,
    diameterToleranceMm: 0.03,
    dryingTempC: 70,
    dryingHours: 4,
    enclosureRequired: true,
    handlingNote:
      "Print in an enclosure. ABS shrinks as it cools and an open printer in a draught will lift the corners off the bed.",
  },
  ASA: {
    extruderTempC: [240, 270],
    bedTempC: [90, 110],
    printSpeedMmS: [30, 100],
    fanPercent: 0,
    densityGCm3: 1.07,
    diameterToleranceMm: 0.03,
    dryingTempC: 70,
    dryingHours: 4,
    enclosureRequired: true,
    handlingNote:
      "Print in an enclosure. ABS shrinks as it cools and an open printer in a draught will lift the corners off the bed.",
  },
  TPU: {
    extruderTempC: [210, 235],
    bedTempC: [30, 50],
    printSpeedMmS: [15, 40],
    fanPercent: 60,
    densityGCm3: 1.21,
    diameterToleranceMm: 0.05,
    dryingTempC: 50,
    dryingHours: 8,
    enclosureRequired: false,
    handlingNote:
      "Print slowly and use a direct-drive extruder. A Bowden tube lets soft filament buckle instead of feeding.",
  },
};

export const PRODUCTS: Product[] = [
  {
    slug: "pla-basic",
    name: "PLA Basic",
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 1.75,
    colours: pick(
      "obsidian-black",
      "arctic-white",
      "signal-red",
      "lagos-orange",
      "solar-yellow",
      "palm-green",
      "cobalt-blue",
      "ash-grey",
    ),
    sizes: [
      { id: "500g", label: "500 g spool", weightGrams: 500, priceNaira: 9_500, compareAtNaira: null },
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 16_500, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "The all-round PLA for prototypes, brackets and everyday prints — the spool to reach for when you are not sure which one you need.",
    features: [
      "Prints clean on almost any FDM printer straight out of the box",
      "No enclosure, no drying cabinet, no special hardware required",
      "±0.02 mm diameter tolerance, measured on every batch",
      "Widest colour range in the catalogue — eight colours in stock",
    ],
    overviewClaims: [
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "ruler", title: "±0.02 mm", body: "Every batch is laser-measured before it ships." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "The spool to start with" },
      {
        kind: "paragraph",
        text: "PLA Basic is where most people start and where most prints stay. It sticks to a bare glass or PEI bed without glue, cools without warping, and does not need a heated enclosure or a filament dryer to behave. If you print miniatures, brackets, jigs or one-off mechanical parts and are not sure which material to reach for, this is it.",
      },
      {
        kind: "paragraph",
        text: "It is not the material for parts that flex, live outdoors, or sit near heat. Standard PLA softens around 55–60 °C, so a dashboard mount or an engine-bay bracket will droop in the Lagos sun. For those, look at PETG or ASA instead.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Prototypes, brackets, jigs, display models", "Parts that sit in direct sun or near heat"],
          ["Beginners and first-time printers", "Living hinges or anything that must flex"],
          ["Fast, low-drama prints with no enclosure", "Outdoor use for more than a few weeks"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "No enclosure or heated chamber needed",
          "Prints well from a stock, unmodified printer",
          "Cools and shrinks less than ABS, so warping is rare",
          "Store with desiccant once opened to keep it printing clean",
        ],
      },
      { kind: "figure", colourHex: COLOURS["obsidian-black"].hex, caption: "PLA Basic in obsidian black." },
    ],
    parameters: { ...PARAMS.PLA },
    reviews: [
      {
        id: "pla-basic-r1",
        author: "Chidinma Okafor",
        rating: 5,
        title: "My go-to for everything",
        body: "I run a small print farm in Ikeja and this is what's loaded in six of my eight printers. Consistent extrusion, first layer sticks every time on a textured PEI sheet, and it doesn't yellow after a few months on the shelf like some imports do.",
        publishedAt: "2026-02-11",
        verifiedPurchase: true,
      },
      {
        id: "pla-basic-r2",
        author: "Emeka Nwachukwu",
        rating: 5,
        title: "Solid for functional prototypes",
        body: "Printed a set of jig fixtures at 0.2 mm, no warping on a 240 mm bed. Diameter is tight enough that I haven't had a single clog in three months.",
        publishedAt: "2026-01-22",
        verifiedPurchase: true,
      },
      {
        id: "pla-basic-r3",
        author: "Blessing Etim",
        rating: 4,
        title: "Good filament, slightly noisy feed",
        body: "Prints clean and the colours are accurate to the swatch. My extruder clicks a little more than with the brand I used before, but nothing that shows up in the part.",
        publishedAt: "2026-03-05",
        verifiedPurchase: true,
      },
      {
        id: "pla-basic-r4",
        author: "Tunde Balogun",
        rating: 4,
        title: "Reliable, reorder without thinking",
        body: "Ordered arctic white and obsidian black for a batch of enclosure brackets. Both spools printed the same temperature profile without retuning, which is the whole point of buying from one supplier.",
        publishedAt: "2026-04-18",
        verifiedPurchase: false,
      },
      {
        id: "pla-basic-r5",
        author: "Ngozi Adeyemi",
        rating: 3,
        title: "One spool strung badly",
        body: "First roll was perfect. Second roll of the same colour strung badly until I dried it for four hours — read like it sat somewhere humid before it shipped. Worth a moisture check before you print anything detailed.",
        publishedAt: "2026-05-09",
        verifiedPurchase: true,
      },
      {
        id: "pla-basic-r6",
        author: "Ibrahim Suleiman",
        rating: 2,
        title: "Colour was off from the last batch",
        body: "Reordered signal red for a client job and the new spool is a shade darker than the one from four months ago. Printed fine, but I had to explain the mismatch to the client. Batch consistency needs work.",
        publishedAt: "2026-06-14",
        verifiedPurchase: true,
      },
    ],
    featured: true,
  },
  {
    slug: "pla-matte",
    name: "PLA Matte",
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "signal-red", "palm-green", "ash-grey", "clay-brown"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 18_500, compareAtNaira: 21_000 },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary: "A flat, non-reflective finish that hides layer lines on display prints.",
    features: [
      "Matte surface hides layer lines without sanding",
      "Prints at standard PLA temperatures — no profile changes",
      "±0.02 mm diameter tolerance, measured on every batch",
      "Wound on a cardboard spool, recyclable with paper",
    ],
    overviewClaims: [
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "ruler", title: "±0.02 mm", body: "Every batch is laser-measured before it ships." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "A finish, not just a colour" },
      {
        kind: "paragraph",
        text: "Matte PLA trades gloss for a flat, almost chalky surface that scatters light instead of reflecting it. On a standard glossy filament, layer lines catch the light at an angle and read as ridges even after sanding; on this one they mostly disappear under normal room light, which is why it is the finish most cosplay and display printers reach for first.",
      },
      {
        kind: "paragraph",
        text: "It runs at the same temperatures as PLA Basic — no new slicer profile — but the strand itself is softer, which is the one thing to know before you print with it. It is not a structural upgrade over basic PLA; treat it the same for load-bearing parts and choose PLA+ if the part gets handled.",
      },
      {
        kind: "table",
        caption: "PLA Matte vs PLA Basic",
        head: ["", "PLA Matte", "PLA Basic"],
        rows: [
          ["Surface", "Flat, non-reflective", "Semi-gloss"],
          ["Layer lines", "Hidden under normal light", "Visible at an angle"],
          ["Strand stiffness", "Softer — ease off the idler", "Standard"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "No slicer profile changes from standard PLA",
          "Loosen the extruder idler tension a quarter turn from your usual setting",
          "Best for display models, cosplay props and anything meant to look painted",
          "Sold in 1 kg spools only, in six colours",
        ],
      },
      { kind: "figure", colourHex: COLOURS["clay-brown"].hex, caption: "PLA Matte in clay brown." },
    ],
    parameters: {
      ...PARAMS.PLA,
      handlingNote:
        "Matte PLA is softer than standard PLA. Do not over-tighten the extruder idler — it flattens the strand and causes under-extrusion a few hours into a print.",
    },
    reviews: [
      {
        id: "pla-matte-r1",
        author: "Folake Adebayo",
        rating: 5,
        title: "Layer lines gone without sanding",
        body: "Printed a display bust at 0.16 mm and the matte finish hid the layer lines completely under the display lights. Exactly what I needed for a client presentation piece.",
        publishedAt: "2026-02-02",
        verifiedPurchase: true,
      },
      {
        id: "pla-matte-r2",
        author: "Chukwuemeka Obi",
        rating: 4,
        title: "Great finish, watch the idler",
        body: "Finish is genuinely matte, not just satin like some other brands call matte. Learned the hard way that this filament is softer — tightened my idler too far on the first spool and started under-extruding a few hours in. Backed it off and it's been fine since.",
        publishedAt: "2026-03-19",
        verifiedPurchase: true,
      },
      {
        id: "pla-matte-r3",
        author: "Amaka Ude",
        rating: 5,
        title: "Cosplay props look production-made",
        body: "Used this for a set of armour panels and the non-reflective surface reads as painted even before I primed it. Saved me a full round of sanding I'd normally do on glossy PLA.",
        publishedAt: "2026-05-27",
        verifiedPurchase: true,
      },
      {
        id: "pla-matte-r4",
        author: "Segun Owolabi",
        rating: 5,
        title: "Consistent spool to spool",
        body: "Bought four spools of obsidian black for a batch of enclosures. All four printed at the same settings with no retuning between rolls, which is rare at this price point.",
        publishedAt: "2026-07-01",
        verifiedPurchase: false,
      },
    ],
    featured: true,
  },
  {
    slug: "pla-silk",
    name: "PLA Silk",
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 1.75,
    colours: pick("silk-copper", "silk-silver", "magenta", "cobalt-blue", "arctic-white"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 19_500, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "A pearlescent, high-shine finish for decorative prints — vases, ornaments and anything meant to catch the light.",
    features: [
      "High-shine, pearlescent finish straight off the bed",
      "Same PLA temperatures — no special hotend or profile",
      "Best on smooth, low-detail surfaces such as vases and spirals",
      "Five colours, including two metallic-effect finishes",
    ],
    overviewClaims: [
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "layers", title: "Vase-mode ready", body: "Shine reads best on single-wall, low-layer-height prints." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "Shine is a print setting, not just a filament" },
      {
        kind: "paragraph",
        text: "Silk PLA gets its shimmer from a different pigment structure, not a coating, so the shine is baked into the strand and does not wear off. It shows up best on smooth, curved surfaces — vases, ornaments, spirals — where light can run continuously along the wall. Cut it up with sharp corners or heavy infill and the shine breaks up the same way brushed metal does under a scratch.",
      },
      {
        kind: "paragraph",
        text: "It is not the material for functional parts. The additives that create the pearlescent effect make it slightly more brittle than standard PLA, and the shine itself is more visible on a single-wall vase-mode print than on a normal multi-perimeter part. Use PLA Basic or PLA+ where strength matters more than looks.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Vases, ornaments, gifts, display pieces", "Load-bearing or high-impact parts"],
          ["Single-colour or colour-change spirals", "Small, highly detailed miniatures"],
          ["Anything meant to sit somewhere and be looked at", "Parts you plan to sand or paint over"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Print outer walls slower — 35–40 mm/s keeps the shine even",
          "Works best in vase mode or with two to three perimeters, not heavy infill",
          "Slightly more brittle than standard PLA — not for snap-fit parts",
          "Wipe down before packing; the finish shows fingerprints more than a plain surface does",
        ],
      },
      { kind: "figure", colourHex: COLOURS["silk-copper"].hex, caption: "PLA Silk in silk copper." },
    ],
    parameters: { ...PARAMS.PLA },
    reviews: [
      {
        id: "pla-silk-r1",
        author: "Yewande Coker",
        rating: 5,
        title: "The shine is real",
        body: "Printed a set of vases for a shop display and the pearlescent shine shows up even at 0.28 mm layers. Slowed down to 35 mm/s on outer walls per PlaSpool's note and the finish came out even across every colour change.",
        publishedAt: "2026-04-08",
        verifiedPurchase: true,
      },
      {
        id: "pla-silk-r2",
        author: "Obinna Eze",
        rating: 4,
        title: "Beautiful, but plan for slower prints",
        body: "Silk copper looks like an actual metal finish once it's printed. Only knock is that anything above 60 mm/s starts losing the sheen on flat surfaces, so budget extra time.",
        publishedAt: "2026-06-22",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "pla-wood",
    name: "PLA Wood",
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 1.75,
    colours: pick("natural", "clay-brown", "carbon-black"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 22_000, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "A wood-fibre composite that sands, stains and smells like timber — for décor pieces, not structural parts.",
    features: [
      "20% wood fibre blended into a PLA base",
      "Sands, stains and finishes like real timber",
      "Varying extrusion tone gives every print a natural grain look",
      "Prints at standard PLA temperatures, slightly slower",
    ],
    overviewClaims: [
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "layers", title: "Sandable finish", body: "Takes wood stain and sandpaper like real timber." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "PLA with real wood fibre in the strand" },
      {
        kind: "paragraph",
        text: "Wood PLA is a composite — roughly a fifth wood fibre bound into a PLA base — so it sands, drills and takes wood stain the way timber does, and the extrusion tone varies slightly layer to layer the way grain does in a real board. It suits picture frames, pen bodies, coasters and any piece meant to look and feel like wood rather than plastic.",
      },
      {
        kind: "paragraph",
        text: "It is not a structural material. The wood fibre makes the strand more brittle than standard PLA and more prone to clogging a small nozzle if you push speed or temperature too high. It is also more abrasive than plain PLA — a brass nozzle will wear faster than usual over a few spools.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Décor: frames, coasters, pen bodies, ornaments", "Load-bearing or thin-walled functional parts"],
          ["Pieces you plan to sand, drill or stain", "Fast prints — it wants a gentler speed"],
          ["A natural, non-plastic look and feel", "Fine detail below about 0.6 mm"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "0.4 mm nozzle or larger — wood fibre can jam anything smaller",
          "Print 10–15 °C hotter than PLA Basic if you see under-extrusion",
          "Sand with 220 then 400 grit for a smooth, stainable surface",
          "A hardened nozzle lasts longer than brass on this filament",
        ],
      },
      { kind: "figure", colourHex: COLOURS["clay-brown"].hex, caption: "PLA Wood in clay brown." },
    ],
    parameters: {
      ...PARAMS.PLA,
      handlingNote:
        "Wood-fibre PLA is abrasive and can jam a nozzle under 0.4 mm. Print 10–15 °C hotter than standard PLA if extrusion looks stringy or brittle.",
    },
    reviews: [],
    featured: false,
  },
  {
    slug: "pla-glow",
    name: "PLA Glow",
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 1.75,
    colours: pick("glow-green", "natural"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 24_000, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale", "New"],
    summary:
      "Glow-in-the-dark PLA that charges under light and holds a visible glow for keychains, signage and night lights.",
    features: [
      "Phosphorescent additive charges under any light source",
      "Holds a visible glow for roughly 20–30 minutes after charging",
      "Same PLA print settings — no profile changes needed",
      "Pale, chalky tone in daylight; full colour shows in the dark",
    ],
    overviewClaims: [
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "thermometer", title: "No enclosure needed", body: "Prints at standard PLA temperatures." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "Charges under light, glows in the dark" },
      {
        kind: "paragraph",
        text: "The phosphorescent powder in this filament absorbs light and re-emits it slowly, so a print left under a lamp or in daylight for a few minutes will hold a visible glow for around twenty to thirty minutes in a dark room. It is aimed at keychains, light switch covers, house numbers and small novelty pieces — parts that get looked at in the dark, not parts that need to work in it.",
      },
      {
        kind: "paragraph",
        text: "It is not a strong glow source on its own — this is a filament additive, not an LED, and the glow fades steadily rather than staying at full brightness. It is also not the colour it appears in daylight: it looks pale and slightly chalky in normal light and only shows its true colour once the lights go off.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Keychains, signage, switch plates, novelty prints", "A primary light source — it is not an LED"],
          ["Pieces displayed somewhere that goes properly dark", "Rooms with constant ambient light — it won't charge"],
          ["Short functional glow after a lamp or daylight charge", "Long unattended glow — it fades over 20–30 minutes"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Charge under a bright lamp or daylight for a few minutes before use",
          "The phosphorescent powder is abrasive — a hardened nozzle lasts longer than brass",
          "Thicker walls hold more glow powder and glow longer",
          "Judge the colour by the dark-room result, not the spool",
        ],
      },
      { kind: "figure", colourHex: COLOURS["glow-green"].hex, caption: "PLA Glow in glow green." },
    ],
    parameters: {
      ...PARAMS.PLA,
      handlingNote:
        "The phosphorescent powder is abrasive — a hardened steel nozzle holds up far longer than the stock brass one most printers ship with. If extrusion turns rough partway through a spool, that is nozzle wear, not a bad batch.",
    },
    reviews: [
      {
        id: "pla-glow-r1",
        author: "Chiamaka Nnaji",
        rating: 4,
        title: "Glows well after a good charge",
        body: "Printed keychains for a school event and they held a visible glow for about twenty minutes after charging under a desk lamp. Ate through a brass nozzle faster than any filament I've used before — switched to a hardened one and it's been fine since.",
        publishedAt: "2026-05-14",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "pla-basic-285",
    name: "PLA Basic 2.85 mm",
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 2.85,
    colours: pick("obsidian-black", "arctic-white", "signal-red", "cobalt-blue"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 18_000, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "The everyday PLA formula on a 2.85 mm strand, for direct-drive printers built around the larger diameter.",
    features: [
      "Same PLA Basic formula, wound at 2.85 mm instead of 1.75 mm",
      "For direct-drive printers built around the larger diameter",
      "±0.02 mm diameter tolerance, measured on every batch",
      "No enclosure or drying cabinet required",
    ],
    overviewClaims: [
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "ruler", title: "2.85 mm, ±0.02 mm", body: "Measured on every batch, not just at the factory." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "The same PLA, a different diameter" },
      {
        kind: "paragraph",
        text: "This is the identical PLA Basic formula wound onto a 2.85 mm strand rather than 1.75 mm. Chemistry, colour range logic and print temperatures do not change — only the diameter does, for the smaller number of printers built around the thicker filament rather than the now-common 1.75 mm standard.",
      },
      {
        kind: "paragraph",
        text: "It is not a different material, and it will not fit a 1.75 mm hotend or extruder gear — check your printer's specification before ordering, since the two diameters are not interchangeable and a wrong order cannot be fed at all.",
      },
      {
        kind: "table",
        caption: "1.75 mm vs 2.85 mm",
        head: ["", "1.75 mm (most printers)", "2.85 mm (this product)"],
        rows: [
          ["Compatible printers", "Most consumer FDM printers", "Larger-format and some direct-drive machines"],
          ["Formula", "PLA Basic", "Identical PLA Basic formula"],
          ["Colour range", "Eight colours", "Four core colours"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Confirm your printer takes 2.85 mm before ordering — it will not feed a 1.75 mm hotend",
          "Same print temperatures as PLA Basic in 1.75 mm",
          "±0.02 mm tolerance, measured on every batch",
          "Four core colours, restocked more slowly than the 1.75 mm range",
        ],
      },
      { kind: "figure", colourHex: COLOURS["obsidian-black"].hex, caption: "PLA Basic 2.85 mm in obsidian black." },
    ],
    parameters: { ...PARAMS.PLA },
    reviews: [
      {
        id: "pla-basic-285-r1",
        author: "David Etim",
        rating: 5,
        title: "Feeds perfectly on my 2.85 mm printer",
        body: "Most Nigerian filament sellers only stock 1.75 mm, so this was the first local 2.85 mm PLA I could get without importing. Diameter held tight enough that my direct-drive extruder never skipped a step across the whole spool.",
        publishedAt: "2026-03-30",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "pla-plus-basic",
    name: "PLA+ Basic",
    categorySlug: "pla-plus",
    material: "PLA+",
    diameterMm: 1.75,
    colours: pick(
      "obsidian-black",
      "arctic-white",
      "signal-red",
      "lagos-orange",
      "palm-green",
      "cobalt-blue",
      "brand-navy",
    ),
    sizes: [
      { id: "500g", label: "500 g spool", weightGrams: 500, priceNaira: 11_000, compareAtNaira: 12_500 },
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 19_500, compareAtNaira: 22_000 },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "PLA with higher impact strength, for brackets, enclosures and parts that get picked up, dropped and handled.",
    features: [
      "Noticeably higher impact strength than standard PLA",
      "Same bed adhesion and no enclosure required",
      "Prints 15–20 °C hotter than PLA Basic — the only profile change",
      "Seven colours, in 500 g and 1 kg spools",
    ],
    overviewClaims: [
      { icon: "shield", title: "Impact-tested", body: "Survives drops that crack standard PLA parts." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "PLA that survives being picked up" },
      {
        kind: "paragraph",
        text: "PLA+ keeps everything easy about standard PLA — bed adhesion, no enclosure, no drying cabinet — and adds meaningfully higher impact strength through a modified polymer blend. It is the one to reach for on brackets, enclosures, tool holders and anything that gets carried around a workshop rather than displayed on a shelf.",
      },
      {
        kind: "paragraph",
        text: "It is not a heat-resistant material — it softens at similar temperatures to standard PLA, so it is still the wrong choice for a dashboard mount or anything near an engine bay. For heat, move to PETG or ASA; PLA+ solves toughness, not temperature.",
      },
      {
        kind: "table",
        caption: "PLA+ vs PLA Basic",
        head: ["", "PLA+", "PLA Basic"],
        rows: [
          ["Impact strength", "Noticeably higher", "Standard"],
          ["Print temperature", "205–230 °C", "190–220 °C"],
          ["Best for", "Brackets, enclosures, handled parts", "Prototypes, display models"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Print 15–20 °C hotter than standard PLA Basic",
          "No enclosure or filament dryer required",
          "Holds up to repeated drops better than basic PLA on the same geometry",
          "Available in 500 g and 1 kg, seven colours",
        ],
      },
      { kind: "figure", colourHex: COLOURS["brand-navy"].hex, caption: "PLA+ Basic in Spool navy." },
    ],
    parameters: { ...PARAMS["PLA+"] },
    reviews: [
      {
        id: "pla-plus-basic-r1",
        author: "Adaeze Nnamdi",
        rating: 5,
        title: "Survives drop tests we couldn't pass with basic PLA",
        body: "We switched our enclosure brackets from standard PLA to this after two field returns from cracked corners. Six months on, zero cracks reported, and it prints at the same bed temperature so the changeover was a non-event.",
        publishedAt: "2026-01-15",
        verifiedPurchase: true,
      },
      {
        id: "pla-plus-basic-r2",
        author: "Femi Akintola",
        rating: 5,
        title: "Tougher, no drama",
        body: "Printed a batch of cable clips that get stepped on daily on a workshop floor. Regular PLA would have shattered by week two; these are still holding after two months.",
        publishedAt: "2026-02-27",
        verifiedPurchase: true,
      },
      {
        id: "pla-plus-basic-r3",
        author: "Grace Inyang",
        rating: 4,
        title: "Good toughness, slightly stringier",
        body: "Impact resistance is noticeably better than basic PLA on the same part geometry. Strings a touch more between islands, so I added a bit more retraction distance and it cleaned right up.",
        publishedAt: "2026-04-11",
        verifiedPurchase: true,
      },
      {
        id: "pla-plus-basic-r4",
        author: "Kelechi Madu",
        rating: 5,
        title: "Our default for anything that gets handled",
        body: "Switched our whole print farm's bracket line to PLA+ after one order. Parts that used to snap during shipping now arrive intact.",
        publishedAt: "2026-06-03",
        verifiedPurchase: true,
      },
      {
        id: "pla-plus-basic-r5",
        author: "Hauwa Abdullahi",
        rating: 3,
        title: "Good material, one bad spool",
        body: "Nine spools printed perfectly. The tenth had a section that varied in diameter enough to cause a jam mid-print. PlaSpool replaced it without a fuss, but wanted to flag it for anyone stocking up.",
        publishedAt: "2026-07-19",
        verifiedPurchase: true,
      },
    ],
    featured: true,
  },
  {
    slug: "pla-plus-hs",
    name: "PLA+ High Speed",
    categorySlug: "pla-plus",
    material: "PLA+",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "cobalt-blue", "brand-navy"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 21_500, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary: "A high-flow PLA+ blend tuned for high-speed printers and hardened, high-flow hotends.",
    features: [
      "Tuned to stay dimensionally accurate above 300 mm/s",
      "Same impact strength as PLA+ Basic",
      "Needs a hardened, high-flow hotend to reach its top speed",
      "Four colours, focused on workshop and print-farm use",
    ],
    overviewClaims: [
      { icon: "ruler", title: "Speed-tuned", body: "Stable extrusion up to 300 mm/s on the right hardware." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "Built for printers that outran their filament" },
      {
        kind: "paragraph",
        text: "High Speed PLA+ is formulated to melt and flow faster than standard PLA+, so a printer capable of 300 mm/s outer walls does not end up starved for melted plastic at the nozzle. It carries the same impact strength as PLA+ Basic — the difference is entirely in how fast it can be pushed through a hotend without losing dimensional accuracy.",
      },
      {
        kind: "paragraph",
        text: "It is not worth buying for a printer limited to 60–80 mm/s — at those speeds it behaves like PLA+ Basic and the flow advantage never shows up. It also wants a hardened, high-flow hotend; a stock hotend on a budget printer will bottleneck before the filament does.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Printers with hardened, high-flow hotends", "Stock hotends on entry-level printers"],
          ["Print farms optimising for throughput", "Prints where speed is not the bottleneck"],
          ["Brackets and functional parts at speed", "Fine surface finish at maximum speed"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Only pays off above roughly 150 mm/s outer wall speed",
          "Bump part cooling earlier in the print than usual at high speed",
          "Same impact strength as PLA+ Basic",
          "Needs a hardened, high-flow nozzle to reach top speed",
        ],
      },
      { kind: "figure", colourHex: COLOURS["cobalt-blue"].hex, caption: "PLA+ High Speed in cobalt blue." },
    ],
    parameters: { ...PARAMS["PLA+"] },
    reviews: [
      {
        id: "pla-plus-hs-r1",
        author: "Yusuf Garba",
        rating: 5,
        title: "Actually holds up at high flow",
        body: "Running a hardened hotend at 300 mm/s outer walls and this kept up without the ghosting I got from standard PLA+ at the same speed. Cut a two-hour print down to forty minutes.",
        publishedAt: "2026-03-08",
        verifiedPurchase: true,
      },
      {
        id: "pla-plus-hs-r2",
        author: "Precious Effiong",
        rating: 4,
        title: "Fast, but tune your cooling",
        body: "Needed to bump my part cooling fan curve earlier in the print than usual or overhangs got rough at high speed. Once dialled in, results are excellent.",
        publishedAt: "2026-05-02",
        verifiedPurchase: true,
      },
      {
        id: "pla-plus-hs-r3",
        author: "Ikechukwu Nwosu",
        rating: 5,
        title: "Print farm throughput jumped",
        body: "Moved our batch print jobs to this and cut average job time by a third without touching layer quality settings. Exactly what a print farm running on tight margins needs.",
        publishedAt: "2026-06-28",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "petg-basic",
    name: "PETG Basic",
    categorySlug: "petg",
    material: "PETG",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "signal-red", "palm-green", "deep-teal", "ash-grey"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 21_000, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary: "Water-resistant, impact-tough PETG for outdoor brackets, enclosures and parts that PLA cannot survive.",
    features: [
      "Water- and humidity-resistant — safe for outdoor and bathroom parts",
      "Noticeably tougher than PLA on impact and flex",
      "No enclosure required, unlike ABS and ASA",
      "Sticks hard to PEI — use a release layer or expect chunks",
    ],
    overviewClaims: [
      { icon: "shield", title: "Water-resistant", body: "Holds up through a Lagos rainy season outdoors." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "The step up from PLA for anything that gets wet" },
      {
        kind: "paragraph",
        text: "PETG resists water and humidity in a way PLA simply does not, which makes it the default choice for outdoor brackets, garden fittings, phone mounts and any part that lives somewhere with rain or damp air. It is also noticeably tougher than PLA under impact and mild flex, and unlike ABS or ASA it does not need an enclosure to print well.",
      },
      {
        kind: "paragraph",
        text: "It is not the easiest material to get a clean first layer on. PETG bonds aggressively to smooth PEI sheets — enough to lift chunks out of the bed surface if you print directly onto it — and it strings more than PLA if the nozzle temperature runs high. Both are solved with a release layer and a bit of temperature tuning, covered under Printing parameters.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Outdoor brackets, enclosures, phone mounts", "Fine, highly detailed miniatures"],
          ["Parts exposed to rain, humidity or washing", "Prints where minimal stringing matters most"],
          ["Impact- and flex-tough functional parts", "Anywhere PLA's rigidity is actually the goal"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Use a thin glue-stick layer on smooth PEI to stop it welding to the bed",
          "Dry before printing if stringing shows up — PETG absorbs moisture readily",
          "No enclosure needed, unlike ABS or ASA",
          "Slightly flexible under load — expect some give, not a snap",
        ],
      },
      { kind: "figure", colourHex: COLOURS["deep-teal"].hex, caption: "PETG Basic in deep teal." },
    ],
    parameters: { ...PARAMS.PETG },
    reviews: [
      {
        id: "petg-basic-r1",
        author: "Ifeoma Anyanwu",
        rating: 5,
        title: "Finally, a bracket that survives rain",
        body: "Printed outdoor cable brackets for a client's rooftop installation. Six months through Lagos rainy season and no swelling or cracking, unlike the PLA version we tried first.",
        publishedAt: "2026-02-14",
        verifiedPurchase: true,
      },
      {
        id: "petg-basic-r2",
        author: "Aminu Bello",
        rating: 4,
        title: "Strong, but dry it first",
        body: "Left a spool out on the bench for two weeks during Lagos rainy season and it printed with faint stringing until I ran it in a filament dryer for two hours. Once dry, adhesion and strength were excellent.",
        publishedAt: "2026-03-22",
        verifiedPurchase: true,
      },
      {
        id: "petg-basic-r3",
        author: "Tolu Adegoke",
        rating: 5,
        title: "Pulled chunks out of my PEI sheet — read the notes",
        body: "First print welded itself to my smooth PEI plate and took a chip out when I pried it off. Second time I used a thin glue stick layer like PlaSpool suggests and it released clean every time after that.",
        publishedAt: "2026-05-30",
        verifiedPurchase: true,
      },
      {
        id: "petg-basic-r4",
        author: "Zainab Lawal",
        rating: 4,
        title: "Good for phone mounts",
        body: "Printed a batch of car phone mounts that live on a dashboard in direct sun. No warping or discolouration after three months, which is more than I can say for the ABS version I tried before this.",
        publishedAt: "2026-07-09",
        verifiedPurchase: true,
      },
    ],
    featured: true,
  },
  {
    slug: "petg-cf",
    name: "PETG Carbon Fibre",
    categorySlug: "petg",
    material: "PETG",
    diameterMm: 1.75,
    colours: pick("carbon-black"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 34_000, compareAtNaira: null },
    ],
    bulkTiers: PREMIUM_TIERS,
    badges: ["Low stock"],
    summary: "Carbon-fibre-reinforced PETG for stiff, low-flex parts that would otherwise need a metal bracket.",
    features: [
      "Carbon fibre reinforcement for higher stiffness than plain PETG",
      "Satin-black finish with visible fibre texture",
      "Requires a hardened steel nozzle — the fibre wears brass fast",
      "Sold in one colour only, in limited batches",
    ],
    overviewClaims: [
      { icon: "shield", title: "Reinforced", body: "Stiffer than plain PETG under load." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "thermometer", title: "Hardened nozzle required", body: "Carbon fibre wears brass nozzles quickly." },
    ],
    description: [
      { kind: "heading", text: "Stiffness, at the cost of a nozzle" },
      {
        kind: "paragraph",
        text: "Chopped carbon fibre in the PETG base raises stiffness enough to replace small sheet-metal brackets in some builds — drone arms, camera mounts, tool jigs — where plain PETG would flex under load. The fibre also flattens the surface finish to a satin black with a visible woven texture, which most people printing functional parts consider a bonus rather than a drawback.",
      },
      {
        kind: "paragraph",
        text: "It is not for a printer you are not prepared to fit a hardened nozzle to. Chopped carbon fibre is abrasive enough to wear through a stock brass nozzle within a single spool, after which extrusion turns rough and under-fed. It is also not a cosmetic filament — the fibre texture reads as functional, not decorative, and it only ships in carbon black.",
      },
      {
        kind: "table",
        caption: "PETG-CF vs PETG Basic",
        head: ["", "PETG-CF", "PETG Basic"],
        rows: [
          ["Stiffness", "Higher — resists flex under load", "Standard PETG flex"],
          ["Nozzle", "Hardened steel required", "Stock brass is fine"],
          ["Colours", "Carbon black only", "Six colours"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Fit a hardened steel nozzle before the first print — this is not optional",
          "Print speed and temperature match PETG Basic",
          "Stocked in smaller batches than the rest of the PETG range",
          "Surface finish is functional-looking, not glossy",
        ],
      },
      { kind: "figure", colourHex: COLOURS["carbon-black"].hex, caption: "PETG Carbon Fibre in carbon black." },
    ],
    parameters: {
      ...PARAMS.PETG,
      handlingNote:
        "PETG-CF is abrasive — fit a hardened steel nozzle before the first print. A stock brass nozzle wears out within a single spool and starts under-extruding without any other warning.",
    },
    reviews: [
      {
        id: "petg-cf-r1",
        author: "Obinna Uzoma",
        rating: 5,
        title: "Stiff enough to skip the aluminium bracket",
        body: "Replaced a sheet-metal mounting bracket with a carbon-PETG print and it doesn't flex under load the way plain PETG did. Surface has a nice satin-black fibre texture, no post-processing needed.",
        publishedAt: "2026-04-25",
        verifiedPurchase: true,
      },
      {
        id: "petg-cf-r2",
        author: "Chinyere Okafor",
        rating: 4,
        title: "Great stiffness, swap your nozzle first",
        body: "Chewed through a brass nozzle in under a spool before I switched to a hardened steel one — the fibre is abrasive. Once I had the right nozzle, print quality and stiffness were excellent for drone arms.",
        publishedAt: "2026-07-30",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "petg-translucent",
    name: "PETG Translucent",
    categorySlug: "petg",
    material: "PETG",
    diameterMm: 1.75,
    colours: pick("natural", "deep-teal", "cobalt-blue", "signal-red"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 22_500, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary: "Semi-clear PETG for lampshades, light diffusers and parts that want light to pass through them.",
    features: [
      "Semi-transparent — lets light through and softens it",
      "Same water resistance and toughness as PETG Basic",
      "Thinner walls read as more translucent than thicker ones",
      "Four tinted-clear colours, including natural",
    ],
    overviewClaims: [
      { icon: "layers", title: "Light-diffusing", body: "Thin walls pass and soften light." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "PETG that lets light through" },
      {
        kind: "paragraph",
        text: "This is the standard PETG formula in a set of tinted-clear colours rather than solid ones, so light passes through and diffuses rather than stopping at the surface. It is built for lampshades, light diffusers, edge-lit signage and covers where the point of the part is to glow rather than to hide what is behind it.",
      },
      {
        kind: "paragraph",
        text: "It is not fully transparent — no FDM filament prints optically clear, because layer lines scatter light no matter how good the printer is. Translucency comes from wall thickness: a single 0.4 mm wall glows strongly, three or four perimeters start to look solid. It is also not the pick for a part that needs to hide its contents; for that, use an opaque colour from PETG Basic instead.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Lampshades, diffusers, edge-lit signage", "Fully transparent or optically clear parts"],
          ["Parts meant to glow from an internal light", "Hiding what's behind the wall completely"],
          ["Thin-walled decorative covers", "Thick, structural, opaque enclosures"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Single-wall or vase mode gives the strongest light transfer",
          "Test wall thickness against your light source before committing to a design",
          "Same PETG temperatures and PEI adhesion behaviour as PETG Basic",
          "Natural is the clearest option; tinted colours diffuse with more colour cast",
        ],
      },
      { kind: "figure", colourHex: COLOURS.natural.hex, caption: "PETG Translucent in natural." },
    ],
    parameters: { ...PARAMS.PETG },
    reviews: [],
    featured: false,
  },
  {
    slug: "abs-basic",
    name: "ABS Basic",
    categorySlug: "abs",
    material: "ABS",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "signal-red", "lagos-orange", "cobalt-blue"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 19_000, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "Classic engineering ABS for heat-resistant, acetone-smoothable parts that need an enclosure to print well.",
    features: [
      "Handles heat far better than PLA or PETG — up to engine-bay temperatures",
      "Acetone vapour smoothing gives an injection-moulded finish",
      "Requires an enclosure — warps badly without one",
      "Five colours, sold in 1 kg spools",
    ],
    overviewClaims: [
      { icon: "thermometer", title: "Heat-resistant", body: "Holds its shape well above where PLA softens." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "shield", title: "Acetone-smoothable", body: "Vapour smoothing gives a moulded finish." },
    ],
    description: [
      { kind: "heading", text: "The classic engineering plastic, with a catch" },
      {
        kind: "paragraph",
        text: "ABS holds its shape at temperatures that would soften or droop PLA and PETG, which is why it is still the default choice for automotive parts, tool housings and anything that sits near real heat. It also responds to acetone vapour smoothing, which melts the surface just enough to erase layer lines and leave an injection-moulded look — something no PLA can do.",
      },
      {
        kind: "paragraph",
        text: "It is not a material for an open printer. ABS shrinks noticeably as it cools, and without an enclosure holding the chamber warm, corners lift off the bed on anything larger than a small part. It also prints with a stronger smell than PETG or PLA, so ventilation matters as much as the enclosure does.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Heat-exposed parts: engine bays, tool housings", "Open printers without an enclosure"],
          ["Parts you plan to acetone-smooth", "Rooms without ventilation — the smell is real"],
          ["Engineering parts needing rigidity at heat", "Beginners without enclosure experience"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Build or buy an enclosure — this is not optional above small parts",
          "Run a brim on tall prints to fight corner lift",
          "Acetone vapour smoothing works on this filament, not on PLA",
          "Ventilate the room — ABS fumes are stronger than PETG or PLA",
        ],
      },
      { kind: "figure", colourHex: COLOURS["obsidian-black"].hex, caption: "ABS Basic in obsidian black." },
    ],
    parameters: { ...PARAMS.ABS },
    reviews: [
      {
        id: "abs-basic-r1",
        author: "Umar Danjuma",
        rating: 4,
        title: "Needs the enclosure, as advertised",
        body: "Tried printing without an enclosure first and got the classic lifted-corner warp on a tall part. Boxed the printer in with an old cabinet and got a set of automotive vent covers out with excellent results the second time.",
        publishedAt: "2026-02-19",
        verifiedPurchase: true,
      },
      {
        id: "abs-basic-r2",
        author: "Chinedu Okonkwo",
        rating: 5,
        title: "Handles engine bay heat fine",
        body: "Printed a sensor housing that sits near the engine bay and it hasn't softened or warped after a full dry season of heat. Would not have trusted PLA anywhere near that spot.",
        publishedAt: "2026-04-02",
        verifiedPurchase: true,
      },
      {
        id: "abs-basic-r3",
        author: "Fatima Sani",
        rating: 3,
        title: "Smell is real, ventilate your space",
        body: "Prints strong and the acetone-smoothed finish came out great on a tool handle, but the smell while printing is noticeably stronger than PETG. Would not run this in a room without good airflow.",
        publishedAt: "2026-06-11",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "abs-plus",
    name: "ABS+",
    categorySlug: "abs",
    material: "ABS",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "ash-grey"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 23_000, compareAtNaira: null },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary:
      "A modified ABS blend that warps less than standard ABS, for builders who want ABS's heat resistance with fewer headaches.",
    features: [
      "Warps noticeably less than standard ABS on large flat parts",
      "Same heat resistance as ABS Basic",
      "Still wants an enclosure — just more forgiving without one",
      "Three colours, sold in 1 kg spools",
    ],
    overviewClaims: [
      { icon: "thermometer", title: "Heat-resistant", body: "Same temperature range as ABS Basic." },
      { icon: "shield", title: "Lower warp", body: "Modified blend lifts corners less than standard ABS." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
    ],
    description: [
      { kind: "heading", text: "ABS's heat resistance, less of its temper" },
      {
        kind: "paragraph",
        text: "ABS+ is a modified blend aimed at the single biggest complaint about standard ABS: corner lift on large flat parts. It keeps the same heat resistance and acetone-smoothing response as ABS Basic, but shrinks less as it cools, so a tray or panel that would curl at the edges in standard ABS tends to lie flat in this one.",
      },
      {
        kind: "paragraph",
        text: "It does not remove the need for an enclosure — it just makes the material more forgiving of a slightly imperfect one. A fully open printer in a draughty room will still see some lift on a large part. Treat the lower warping as margin for error, not a reason to skip the enclosure entirely.",
      },
      {
        kind: "table",
        caption: "ABS+ vs ABS Basic",
        head: ["", "ABS+", "ABS Basic"],
        rows: [
          ["Corner lift on large parts", "Reduced", "Common without an enclosure"],
          ["Heat resistance", "Same range", "Same range"],
          ["Enclosure needed", "Yes, but more forgiving", "Yes, strictly"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Still needs an enclosure — this reduces warp, it doesn't remove it",
          "Good choice for trays, panels and other large flat parts",
          "Responds to acetone vapour smoothing like ABS Basic",
          "Same print temperatures as ABS Basic",
        ],
      },
      { kind: "figure", colourHex: COLOURS["ash-grey"].hex, caption: "ABS+ in ash grey." },
    ],
    parameters: { ...PARAMS.ABS },
    reviews: [
      {
        id: "abs-plus-r1",
        author: "Damilola Ajayi",
        rating: 5,
        title: "Warps less than standard ABS",
        body: "Still want an enclosure, but corner lift on a large flat panel was much less than the standard ABS I used previously. Printed a set of tool-holder trays with no brim needed.",
        publishedAt: "2026-05-17",
        verifiedPurchase: true,
      },
    ],
    featured: false,
  },
  {
    slug: "asa-outdoor",
    name: "ASA Outdoor",
    categorySlug: "abs",
    material: "ASA",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "lagos-orange"),
    sizes: [
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 27_500, compareAtNaira: null },
    ],
    bulkTiers: PREMIUM_TIERS,
    badges: ["New"],
    summary:
      "UV-stable ASA for parts that live outdoors — signage, brackets and fittings that ABS would yellow and crack under.",
    features: [
      "UV-stable — resists yellowing and embrittlement in direct sun",
      "Same heat resistance as ABS, built for outdoor exposure",
      "Requires an enclosure, like ABS",
      "Three colours suited to outdoor signage and fittings",
    ],
    overviewClaims: [
      { icon: "shield", title: "UV-stable", body: "Resists yellowing and cracking in direct sun." },
      { icon: "thermometer", title: "Heat-resistant", body: "Holds its shape in direct sun and hot enclosures." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
    ],
    description: [
      { kind: "heading", text: "The ABS alternative for parts that live outside" },
      {
        kind: "paragraph",
        text: "ASA shares ABS's heat resistance and enclosure requirements but adds real UV stability — the additive that makes the difference between a bracket that stays put for a year in direct Nigerian sun and one that yellows and turns brittle within a season. It is built for outdoor signage, gutter fittings, solar mounting hardware and anything else that does not come back inside.",
      },
      {
        kind: "paragraph",
        text: "It is not a material to print without an enclosure, and it is not cheaper insurance against sun exposure than it needs to be — for parts that stay indoors, plain ABS does the same job for less. Save ASA for the parts that genuinely see weather.",
      },
      {
        kind: "table",
        caption: "ASA vs ABS",
        head: ["", "ASA", "ABS"],
        rows: [
          ["UV / outdoor stability", "Stays stable in direct sun", "Yellows and embrittles over time"],
          ["Heat resistance", "90–110 °C bed, same as ABS", "90–110 °C bed"],
          ["Best for", "Outdoor parts, signage, fittings", "Indoor engineering parts"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Enclosure required, the same as ABS",
          "Choose this over ABS for anything that stays outside",
          "Acetone vapour smoothing works the same way it does on ABS",
          "UV stability is the reason to pay more than plain ABS — don't reserve it for indoor parts",
        ],
      },
      { kind: "figure", colourHex: COLOURS["lagos-orange"].hex, caption: "ASA Outdoor in Lagos orange." },
    ],
    parameters: { ...PARAMS.ASA },
    reviews: [],
    featured: false,
  },
  {
    slug: "tpu-95a",
    name: "TPU 95A",
    categorySlug: "tpu",
    material: "TPU",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "arctic-white", "signal-red", "cobalt-blue", "natural"),
    sizes: [
      { id: "500g", label: "500 g spool", weightGrams: 500, priceNaira: 16_000, compareAtNaira: 18_000 },
      { id: "1kg", label: "1 kg spool", weightGrams: 1000, priceNaira: 28_000, compareAtNaira: 31_500 },
    ],
    bulkTiers: STANDARD_TIERS,
    badges: ["Bulk sale"],
    summary: "A semi-flexible TPU for phone cases, gaskets and grips that need to bend without tearing.",
    features: [
      "Flexible but holds its shape — the middle ground of the TPU range",
      "Absorbs impact well, ideal for phone cases and protective sleeves",
      "Needs a direct-drive extruder — a Bowden tube will buckle it",
      "Five colours, in 500 g and 1 kg spools",
    ],
    overviewClaims: [
      { icon: "layers", title: "Flexible", body: "Bends and returns to shape without tearing." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "truck", title: "Nationwide delivery", body: "Next day in Lagos, 2–4 days elsewhere." },
    ],
    description: [
      { kind: "heading", text: "Flexible enough to bend, firm enough to hold a shape" },
      {
        kind: "paragraph",
        text: "95A is the firmer of PlaSpool's two TPUs — flexible enough to absorb a drop or flex around a corner, but stiff enough to keep its form as a phone case, cable sleeve or protective corner guard rather than going limp. It is the TPU most people should start with unless they specifically need something softer.",
      },
      {
        kind: "paragraph",
        text: "It is not a fast print. TPU's flexibility is exactly what makes it fight a Bowden tube — the tube gives the strand somewhere to buckle before it reaches the nozzle — so this wants a direct-drive extruder and a slower print speed than any PLA or PETG on this site. Rushing it is the single most common cause of a jammed or under-extruded TPU print.",
      },
      {
        kind: "table",
        caption: "Good for / not for",
        head: ["Good for", "Not for"],
        rows: [
          ["Phone cases, cable sleeves, protective grips", "Bowden-tube printers without modification"],
          ["Gaskets and seals that need to flex repeatedly", "Fast prints — this material wants to go slow"],
          ["Parts that need to survive being dropped", "Rigid structural parts — use PLA+ instead"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Direct-drive extruder strongly recommended over Bowden",
          "Print at 15–40 mm/s — pushing speed causes buckling and jams",
          "Dry before printing if you see bubbling or stringing",
          "Retract minimally; TPU handles aggressive retraction badly",
        ],
      },
      { kind: "figure", colourHex: COLOURS["obsidian-black"].hex, caption: "TPU 95A in obsidian black." },
    ],
    parameters: { ...PARAMS.TPU },
    reviews: [
      {
        id: "tpu-95a-r1",
        author: "Bisi Fashola",
        rating: 5,
        title: "Phone cases that actually survive drops",
        body: "Printed a batch of phone cases for a market stall and this is soft enough to absorb a drop onto tile without cracking, but firm enough to keep its shape in a bag. Customers keep coming back for more colours.",
        publishedAt: "2026-03-14",
        verifiedPurchase: true,
      },
      {
        id: "tpu-95a-r2",
        author: "Victor Adeleke",
        rating: 4,
        title: "Great once I slowed down",
        body: "Fed through a Bowden setup at first and got constant buckling in the tube. Dropped speed to 20 mm/s and it printed clean gaskets, but a direct-drive extruder would save the hassle.",
        publishedAt: "2026-05-06",
        verifiedPurchase: true,
      },
      {
        id: "tpu-95a-r3",
        author: "Ronke Odusanya",
        rating: 5,
        title: "Reliable for grip overmoulds",
        body: "Use this for tool grip sleeves that get handled all day on a workshop floor. Holds its flex after months of use and hasn't torn at any of the thin sections.",
        publishedAt: "2026-07-23",
        verifiedPurchase: true,
      },
    ],
    featured: true,
  },
  {
    slug: "tpu-85a",
    name: "TPU 85A Soft",
    categorySlug: "tpu",
    material: "TPU",
    diameterMm: 1.75,
    colours: pick("obsidian-black", "natural"),
    sizes: [
      { id: "500g", label: "500 g spool", weightGrams: 500, priceNaira: 18_000, compareAtNaira: null },
    ],
    bulkTiers: PREMIUM_TIERS,
    badges: [],
    summary:
      "The softest filament in the range — for gaskets, seals and grips that need to compress and flex more than 95A allows.",
    features: [
      "Softer and more flexible than TPU 95A",
      "Compresses well — suited to gaskets and vibration-dampening feet",
      "Direct-drive extruder required — Bowden setups cannot feed it reliably",
      "Sold in 500 g spools, two colours",
    ],
    overviewClaims: [
      { icon: "layers", title: "Extra soft", body: "Compresses and flexes more than TPU 95A." },
      { icon: "factory", title: "Made in Nigeria", body: "Extruded in Lagos, not repackaged." },
      { icon: "thermometer", title: "Direct-drive only", body: "Too soft to feed reliably through a Bowden tube." },
    ],
    description: [
      { kind: "heading", text: "As soft as PlaSpool filament gets" },
      {
        kind: "paragraph",
        text: "85A is noticeably softer than 95A — closer to a rubber band than a phone case — and suits gaskets, seals, vibration-dampening feet and grips that need to compress under light pressure rather than just bend around a corner. Where 95A holds a shape, 85A is meant to give.",
      },
      {
        kind: "paragraph",
        text: "It is not a filament for a Bowden-tube printer, full stop — the softness that makes it useful is exactly what makes it buckle in any length of unsupported tube before it reaches the hotend. It is also not the pick for anything that needs to hold a precise shape under its own weight; for that, 95A is the better choice.",
      },
      {
        kind: "table",
        caption: "TPU 85A vs TPU 95A",
        head: ["", "TPU 85A", "TPU 95A"],
        rows: [
          ["Hardness", "Softer, more compressible", "Firmer, holds shape better"],
          ["Printer requirement", "Direct-drive only", "Direct-drive strongly recommended"],
          ["Best for", "Gaskets, seals, dampening feet", "Cases, sleeves, grips"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "Direct-drive extruder only — this will not feed through a Bowden tube",
          "Print at the low end of the TPU speed range, 15–25 mm/s",
          "Best for parts that need to compress, not just bend",
          "Sold in 500 g spools only, in obsidian black and natural",
        ],
      },
      { kind: "figure", colourHex: COLOURS.natural.hex, caption: "TPU 85A Soft in natural." },
    ],
    parameters: {
      ...PARAMS.TPU,
      handlingNote:
        "This is the softer of our two TPUs and will not feed through a Bowden tube at all — a direct-drive extruder is not optional here. Keep retraction minimal and stay under 25 mm/s or the feed will buckle mid-print.",
    },
    reviews: [],
    featured: false,
  },
];
