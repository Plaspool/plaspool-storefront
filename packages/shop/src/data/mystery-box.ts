import type { Product, SizeOption, VariantStock } from "./types";

/**
 * Mystery boxes: the one seam every box surface reads through.
 *
 * ═══ OPTIONAL MEANS OPTIONAL ═══
 * `boxMode`, `boxItemCount` and `canFill` are all absent on some real response
 * — an older API build, a fixture, an old order. They are defaulted HERE and
 * nowhere else, so no component writes its own `?? null` and no two surfaces
 * disagree about whether a product is a box.
 */

/** A product is a box when the owner switched it into one. Every non-null
 *  mode is treated the same way — see `BoxMode`. */
export function isMysteryBox(product: Pick<Product, "boxMode">): boolean {
  return (product.boxMode ?? null) !== null;
}

/** Items in one box of this size, or null when the pool is not set up. */
export function boxItemCountOf(size: Pick<SizeOption, "boxItemCount">): number | null {
  const count = size.boxItemCount ?? null;
  return typeof count === "number" && count > 0 ? count : null;
}

/** "3 surprise items, packed for your order." — null when there is no count. */
export function boxCountLine(size: Pick<SizeOption, "boxItemCount">): string | null {
  const count = boxItemCountOf(size);
  if (count === null) return null;
  return `${count} surprise ${count === 1 ? "item" : "items"}, packed for your order.`;
}

/**
 * `GET /variants/:id/availability`, as this storefront reads it.
 *
 * FOR A BOX, `available` IS ALREADY THE SMALLER of the box's own stock and what
 * its pool can fill. The product payload's `available` is the box's own sales
 * cap only, so a box can read "24 left" there while the pool has nothing —
 * which is why a box page asks this route and an ordinary page does not.
 */
export interface VariantAvailability {
  variantId: string;
  available: number | null;
  backorderable: boolean;
  /** Boxes the pool can still fill; null on an ordinary variant. */
  canFill: number | null;
}

/** Parses one availability body, or null when it is not one. */
export function parseAvailability(body: unknown): VariantAvailability | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.variantId !== "string") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    variantId: raw.variantId,
    available: num(raw.available),
    backorderable: raw.backorderable === true,
    canFill: num(raw.canFill),
  };
}

/** Same-origin proxy — the upstream route sends no CORS header. See the route. */
export function proxiedAvailabilityPath(variantId: string): string {
  return `/api/variants/${encodeURIComponent(variantId)}/availability`;
}

/** Browser-side read. Null on ANY failure: checkout is the real authority, and
 *  a box must not flash "sold out" because a read went missing. */
export async function fetchVariantAvailability(
  variantId: string,
  signal?: AbortSignal,
): Promise<VariantAvailability | null> {
  try {
    const res = await fetch(proxiedAvailabilityPath(variantId), { signal, cache: "no-store" });
    if (!res.ok) return null;
    return parseAvailability(await res.json());
  } catch {
    return null;
  }
}

/**
 * Whether a box size can be put in a basket right now.
 *
 * - No count: the pool is not set up, so it cannot be sold.
 * - No availability read yet (or it failed): BUYABLE. Checkout decides.
 * - Otherwise sold out at `available <= 0` or `canFill <= 0`, unless the
 *   variant is backorderable — the rule `maxQtyFor` already applies to stock.
 */
export function boxSizeSellable(
  size: Pick<SizeOption, "boxItemCount">,
  availability: VariantAvailability | null | undefined,
): boolean {
  if (boxItemCountOf(size) === null) return false;
  if (!availability) return true;
  if (availability.backorderable) return true;
  if (availability.canFill !== null && availability.canFill <= 0) return false;
  if (availability.available !== null && availability.available <= 0) return false;
  return true;
}

/**
 * The shelf a box's stepper and "N left" copy read: the live, pool-aware count
 * in place of the catalogue's own sales cap. Unchanged until the read lands.
 */
export function boxStock(
  catalogue: VariantStock | null | undefined,
  availability: VariantAvailability | null | undefined,
): VariantStock | null | undefined {
  if (!availability) return catalogue;
  return { available: availability.available, backorderable: availability.backorderable };
}
