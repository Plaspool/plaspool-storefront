import type { BulkTier, Colour, Product, Review, RatingSummary, SizeOption } from "./types";

/**
 * `₦18,500` — sign, comma groups, no decimals.
 *
 * Hand-rolled rather than `Intl.NumberFormat`, deliberately. NGN formatting
 * varies with the ICU build: full-icu Node emits `₦18,500`, a small-icu or
 * Workers runtime can emit `NGN 18,500`. A server and client that disagree on
 * a price string is a hydration error on every product on the page.
 */
export function formatNaira(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}₦${grouped}`;
}

/** The best tier this quantity has reached, or null below the first rung. */
export function tierFor(tiers: BulkTier[], qty: number): BulkTier | null {
  let best: BulkTier | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty && (!best || tier.minQty > best.minQty)) best = tier;
  }
  return best;
}

/** Tiers apply per line, matching the tier table shown in the buy box. Two
 *  lines of four spools do not combine into a single tier of eight. */
export function unitPriceFor(basePrice: number, tiers: BulkTier[], qty: number): number {
  const tier = tierFor(tiers, qty);
  if (!tier) return basePrice;
  return Math.round(basePrice * (1 - tier.discountPct / 100));
}

export function lineTotal(basePrice: number, tiers: BulkTier[], qty: number): number {
  return unitPriceFor(basePrice, tiers, qty) * qty;
}

export function savingsFor(basePrice: number, tiers: BulkTier[], qty: number): number {
  return basePrice * qty - lineTotal(basePrice, tiers, qty);
}

/** The "From ₦X" figure on a card: the cheapest size. */
export function priceFrom(product: Product): number {
  return Math.min(...product.sizes.map((s) => s.priceNaira));
}

/** The size `priceFrom` quotes. A card's add button adds this one, so the
 *  price shown and the price added always agree. */
export function cheapestSize(product: Product): SizeOption {
  return product.sizes.reduce((min, size) =>
    size.priceNaira < min.priceNaira ? size : min,
  );
}

/** The colour a card tints its spool with, and the one its add button adds. */
export function firstInStockColour(product: Product): Colour {
  return product.colours.find((colour) => colour.inStock) ?? product.colours[0];
}

export function ratingSummary(reviews: Review[]): RatingSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const review of reviews) distribution[5 - review.rating] += 1;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    average: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : 0,
    count: reviews.length,
    distribution,
  };
}
