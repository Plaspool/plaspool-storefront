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
 * EMPTY ON PURPOSE. The shop does not currently offer bulk discounts — that is
 * an owner decision, not a gap. The API has no per-product discount data to
 * drive one either: `shop_prices` carries amount, currency and an effective
 * window, nothing else.
 *
 *     `unitPriceFor` with no tiers returns the base price, so an empty array is
 *     arithmetically safe. The surfaces that used to render this ladder — the
 *     home page's bulk band and the buy box's tier table — self-hide rather
 *     than advertise a scheme that does not exist.
 *
 *     Nothing takes money yet — `Buy Now` opens the cart drawer — so no
 *     customer has been charged against this. If the owner sets real numbers
 *     later, populating this array is a one-line change that brings the whole
 *     feature back. Tracked on Plaspool/plaspool-admin#1.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const STANDARD_TIERS: BulkTier[] = [];

/**
 * The hero carousel's spool palette.
 *
 * DECORATION, NOT STOCK. `hero-carousel.tsx` tints a row of generated spool
 * images to show what the store sells at a glance; these are brand colours for
 * that animation, not an inventory claim, which is why they keep `inStock: true`
 * without consulting anything. Real colours and real availability come from
 * variants, through `coloursFrom` in `api.ts`.
 *
 * `imageUrl: null` on every one of them for the same reason: these name no
 * product, so there is no photograph of them to have. The carousel draws the
 * generated spool, which is what it has always drawn and what it should draw.
 */
export const HERO_COLOURS: Record<string, Colour> = {
  "obsidian-black": { id: "obsidian-black", name: "Obsidian black", hex: "#101014", inStock: true, imageUrl: null },
  "signal-red": { id: "signal-red", name: "Signal red", hex: "#C42B2B", inStock: true, imageUrl: null },
  "lagos-orange": { id: "lagos-orange", name: "Lagos orange", hex: "#E2620F", inStock: true, imageUrl: null },
  "solar-yellow": { id: "solar-yellow", name: "Solar yellow", hex: "#E8B71A", inStock: true, imageUrl: null },
  "palm-green": { id: "palm-green", name: "Palm green", hex: "#1F7A4C", inStock: true, imageUrl: null },
  "deep-teal": { id: "deep-teal", name: "Deep teal", hex: "#12626B", inStock: true, imageUrl: null },
  "cobalt-blue": { id: "cobalt-blue", name: "Cobalt blue", hex: "#1B4FA8", inStock: true, imageUrl: null },
  "brand-navy": { id: "brand-navy", name: "Spool navy", hex: "#231C50", inStock: true, imageUrl: null },
  "clay-brown": { id: "clay-brown", name: "Clay brown", hex: "#7A4B2A", inStock: true, imageUrl: null },
  "arctic-white": { id: "arctic-white", name: "Arctic white", hex: "#F4F4F6", inStock: true, imageUrl: null },
};
