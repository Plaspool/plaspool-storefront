import type { BulkTier, Colour } from "./types";

/**
 * Storefront policy and palette — the two things that survived `fixtures.ts`.
 *
 * Everything else in that file was invented catalogue data and is gone, replaced
 * by the commerce API. These are not catalogue data: a discount ladder is a
 * commercial policy, and the colour pool below is decoration on a marketing
 * component. Both belong to the storefront, so both stay — but in a file that
 * says so rather than in one named `fixtures`.
 */

/**
 * The bulk discount ladder.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  A STATED ASSUMPTION, NOT A MEASUREMENT. Every product currently gets this
 *     same ladder, because the API has no per-product discount data at all.
 *
 *     The fixtures distinguished a STANDARD ladder from a shallower PREMIUM one
 *     for three materials, and that distinction is GONE rather than guessed:
 *     re-deriving it from a material name would be this file inventing pricing
 *     for products it knows nothing about, which is worse than one honest
 *     ladder applied evenly.
 *
 *     WHY NOT AN EMPTY LADDER INSTEAD. `unitPriceFor` with no tiers returns the
 *     base price, so an empty array is arithmetically safe — but the home page's
 *     bulk band and the buy box's tier table would then advertise nothing while
 *     the store's whole positioning is bulk filament. Removing the feature is a
 *     bigger and more surprising change than keeping the ladder it already
 *     shipped with.
 *
 *     Nothing takes money yet — `Buy Now` opens the cart drawer — so no customer
 *     has been charged against this. It must become a real API field before
 *     checkout lands. Tracked on Plaspool/plaspool-admin#1.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const STANDARD_TIERS: BulkTier[] = [
  { minQty: 4, discountPct: 10 },
  { minQty: 6, discountPct: 15 },
  { minQty: 10, discountPct: 22 },
];

/**
 * The hero carousel's spool palette.
 *
 * DECORATION, NOT STOCK. `hero-carousel.tsx` tints a row of generated spool
 * images to show what the store sells at a glance; these are brand colours for
 * that animation, not an inventory claim, which is why they keep `inStock: true`
 * without consulting anything. Real colours and real availability come from
 * variants, through `coloursFrom` in `api.ts`.
 */
export const HERO_COLOURS: Record<string, Colour> = {
  "obsidian-black": { id: "obsidian-black", name: "Obsidian black", hex: "#101014", inStock: true },
  "signal-red": { id: "signal-red", name: "Signal red", hex: "#C42B2B", inStock: true },
  "lagos-orange": { id: "lagos-orange", name: "Lagos orange", hex: "#E2620F", inStock: true },
  "solar-yellow": { id: "solar-yellow", name: "Solar yellow", hex: "#E8B71A", inStock: true },
  "palm-green": { id: "palm-green", name: "Palm green", hex: "#1F7A4C", inStock: true },
  "deep-teal": { id: "deep-teal", name: "Deep teal", hex: "#12626B", inStock: true },
  "cobalt-blue": { id: "cobalt-blue", name: "Cobalt blue", hex: "#1B4FA8", inStock: true },
  "brand-navy": { id: "brand-navy", name: "Spool navy", hex: "#231C50", inStock: true },
  "clay-brown": { id: "clay-brown", name: "Clay brown", hex: "#7A4B2A", inStock: true },
  "arctic-white": { id: "arctic-white", name: "Arctic white", hex: "#F4F4F6", inStock: true },
};
