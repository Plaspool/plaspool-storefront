import type { MysteryBoxContent, MysteryBoxSize, Product, SizeOption, VariantStock } from "./types";

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

/** Items in one box of this size, or null when the size is not set up. */
export function boxItemCountOf(size: { boxItemCount?: number | null; itemCount?: number | null }): number | null {
  const count = size.itemCount ?? size.boxItemCount ?? null;
  return typeof count === "number" && count > 0 ? count : null;
}

/** "3 surprise items in every box." — null when there is no count. */
export function boxCountLine(size: { boxItemCount?: number | null; itemCount?: number | null }): string | null {
  const count = boxItemCountOf(size);
  if (count === null) return null;
  return `${count} surprise ${count === 1 ? "item" : "items"} in every box.`;
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
  /** Boxes that can still be filled; null on an ordinary variant. */
  canFill: number | null;
  /** The box's live cues; null on an ordinary variant and on an older API. */
  box: BoxAvailability | null;
}

/**
 * A cue the admin has already resolved: thresholds, time windows, on/off and
 * wording are all the owner's, applied server-side. `text` is printed as sent.
 * `kind` is for STYLING ONLY, and is a plain string because a newer API may
 * send a kind this build has never heard of, which still renders.
 */
export interface BoxCue {
  kind: string;
  text: string;
}

export interface BoxAvailability {
  /** Epoch ms the box last went on sale; null while it is off. */
  onSaleSince: number | null;
  /** In the order to render. Empty means no cue applies right now. */
  cues: BoxCue[];
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
    box: parseBoxAvailability(raw.box),
  };
}

/** The `box` object, or null. A cue with no usable text is dropped, since
 *  there is nothing to print; one with an unknown kind is kept. */
function parseBoxAvailability(value: unknown): BoxAvailability | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const cues = Array.isArray(raw.cues) ? raw.cues : [];
  return {
    onSaleSince: typeof raw.onSaleSince === "number" && Number.isFinite(raw.onSaleSince) ? raw.onSaleSince : null,
    cues: cues.flatMap((cue): BoxCue[] => {
      if (!cue || typeof cue !== "object") return [];
      const { kind, text } = cue as Record<string, unknown>;
      if (typeof text !== "string" || !text.trim()) return [];
      return [{ kind: typeof kind === "string" ? kind : "", text }];
    }),
  };
}

/**
 * `product.mysteryBox` off the wire, or null.
 *
 * ═══ THE ONE SEAM WHERE THE SIZES ARE DECIDED ═══
 * Defaulted HERE so no component writes its own `?? null`: a missing title
 * reads "How it works", missing steps read as none, a blank size reads as the
 * unnamed one.
 *
 * `sizes` ARRIVED AFTER `size`/`itemCount`, which are deprecated mirrors of its
 * first entry. An API build that sends only the old pair is folded into a
 * one-entry list against the first variant, so every surface above reads one
 * shape and the page still works while a deploy is in flight.
 */
export function normaliseMysteryBox(value: unknown, variantIds: readonly string[] = []): MysteryBoxContent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const how = (raw.howItWorks && typeof raw.howItWorks === "object" ? raw.howItWorks : {}) as Record<string, unknown>;
  const title = typeof how.title === "string" && how.title.trim() ? how.title.trim() : "How it works";
  const steps = Array.isArray(how.steps)
    ? how.steps.filter((step): step is string => typeof step === "string" && step.trim() !== "").map((step) => step.trim())
    : [];

  const listed = Array.isArray(raw.sizes) ? raw.sizes.flatMap((entry) => boxSizeFrom(entry)) : null;
  const fallback = boxSizeFrom({ variantId: variantIds[0], size: raw.size, itemCount: raw.itemCount });
  return { sizes: listed ?? fallback, howItWorks: { title, steps } };
}

/** One `sizes` entry, or none when it names no variant to sell. */
function boxSizeFrom(entry: unknown): MysteryBoxSize[] {
  if (!entry || typeof entry !== "object") return [];
  const raw = entry as Record<string, unknown>;
  if (typeof raw.variantId !== "string" || !raw.variantId) return [];
  return [
    {
      variantId: raw.variantId,
      size: typeof raw.size === "string" && raw.size.trim() ? raw.size.trim() : null,
      itemCount: typeof raw.itemCount === "number" && raw.itemCount > 0 ? raw.itemCount : null,
    },
  ];
}

/**
 * The sizes to offer, each paired with the catalogue size that prices and
 * pictures it — in the OWNER'S order, and only the ones still for sale.
 *
 * The join is by `variantId` through `variantIds`, never by position or label:
 * a box's variants may outlive the sizes the owner sells, and a size the admin
 * no longer lists must not reach a picker. An entry whose variant has no
 * catalogue size (unpriced, inactive) is dropped for the same reason.
 */
export function boxSizeOptions(
  product: Pick<Product, "boxMode" | "mysteryBox" | "sizes" | "colours" | "variantIds">,
): Array<{ box: MysteryBoxSize; option: SizeOption }> {
  const content = mysteryBoxOf(product);
  if (!content) return [];
  const colourId = product.colours[0]?.id ?? "default";
  const byVariant = new Map<string, SizeOption>();
  for (const option of product.sizes) {
    const variantId = product.variantIds[`${colourId}:${option.id}`];
    if (variantId && !byVariant.has(variantId)) byVariant.set(variantId, option);
  }
  return content.sizes.flatMap((box) => {
    const option = byVariant.get(box.variantId);
    return option ? [{ box, option }] : [];
  });
}

/**
 * Whether the picker is drawn at all. A single UNNAMED size is a box with one
 * price and nothing to choose — a heading over one blank pill is the empty
 * control the owner saw. A single NAMED size still draws, as one pressed
 * button, because "5kg" is worth saying.
 */
export function showBoxSizePicker(sizes: readonly MysteryBoxSize[]): boolean {
  return sizes.some((size) => size.size !== null);
}

/** The box's content from a product, defaulted: null for anything but the box. */
export function mysteryBoxOf(product: Pick<Product, "boxMode" | "mysteryBox">): MysteryBoxContent | null {
  return isMysteryBox(product) ? (product.mysteryBox ?? null) : null;
}

/** The cues to render, or none — before the first read, and for an ordinary variant. */
export function boxCuesOf(availability: VariantAvailability | null | undefined): BoxCue[] {
  return availability?.box?.cues ?? [];
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
 * Whether the box can be put in a basket right now.
 *
 * ═══ `canFill` DECIDES, NEVER THE BOX'S OWN STOCK ═══
 * The box keeps no stock: it sits at zero or below with backorders on, so its
 * `available` and `backorderable` say nothing. Before admin PR #156 the route's
 * `available` was also clamped to that empty stock and read 0; `canFill` is
 * right both before and after, so it is the only field read.
 *
 * - No item count: not set up, so it cannot be sold.
 * - No read yet, the read failed, or an older API with no `canFill`: BUYABLE.
 *   Checkout is the real authority.
 * - Otherwise sold out at `canFill <= 0`.
 */
export function boxSizeSellable(
  size: { boxItemCount?: number | null; itemCount?: number | null },
  availability: VariantAvailability | null | undefined,
): boolean {
  if (boxItemCountOf(size) === null) return false;
  const canFill = availability?.canFill ?? null;
  return canFill === null || canFill > 0;
}

/**
 * The shelf the box's stepper and "Only N left" read: `canFill` boxes, never
 * backorderable. Until a read lands, UNTRACKED (null), which is what
 * `toProduct` already gives the box, since its own stock is meaningless.
 */
export function boxStock(availability: VariantAvailability | null | undefined): VariantStock {
  return { available: availability?.canFill ?? null, backorderable: false };
}

/**
 * The size a listing card's quick-add puts in the basket for the box: the
 * CHEAPEST size that can be sold right now, or null when none can.
 *
 * Cheapest because that is the "from" price the card prints, so whenever that
 * size is sellable the price shown and the price added still agree. When it is
 * sold out, adding it anyway just moves the refusal to checkout — so the next
 * cheapest sellable size is added instead, and the button's accessible name
 * says which. `availabilityOf` answers null until a read lands, which counts
 * as buyable, the same rule the product page follows.
 */
export function boxQuickAddSize<S extends Pick<SizeOption, "id" | "priceMinor" | "boxItemCount">>(
  sizes: readonly S[],
  availabilityOf: (sizeId: string) => VariantAvailability | null | undefined,
): S | null {
  return (
    [...sizes]
      .sort((a, b) => a.priceMinor - b.priceMinor)
      .find((size) => boxSizeSellable(size, availabilityOf(size.id))) ?? null
  );
}
