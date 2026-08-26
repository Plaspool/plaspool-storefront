import type { ApiCartLine } from "../data/cart-api";
import type { CartCatalogEntry } from "./cart-context";
import type { Colour, SizeOption } from "../data/types";

/**
 * Which of the server's cart lines the shopper can actually buy.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A PLAIN MODULE, FOR THE REASON `line-key.ts` IS ONE.
 *
 * No React and no `"use client"`, so the rule the badge depends on can be
 * tested directly instead of through a provider that only runs in a browser.
 * The suite here is `environment: "node"` — see `vitest.config.mts` — so a
 * decision worth asserting has to live outside the component that uses it.
 *
 * ═══ THE CART USED TO HOLD TWO PROJECTIONS OF ONE SERVER STATE ═══
 * `itemCount` reduced over the raw `lines` array. The drawer, the cart page and
 * the checkout all read `resolved`, which drops any line the catalogue can no
 * longer explain. And `available` — the API's own word for "this cannot be
 * bought any more" — was read by nothing at all.
 *
 * So one line whose variant had left the catalogue produced a badge reading 1
 * beside a drawer reading "Your cart is empty", with no Remove button anywhere,
 * because every control that renders one iterates `resolved`. The basket stayed
 * stuck on that number until it expired, and `/checkout` refused it with
 * `unresolved_lines` — "go back to the cart and remove it" — naming a row the
 * cart had no way to draw.
 *
 * This is the one place that decision is now made, and it answers BOTH halves:
 * what may be counted, and what must stay reachable so it can be taken out.
 * Dropping an unbuyable line from the count *and* from the lists is not a fix,
 * it is the same silent basket with a quieter badge.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The (product, colour, size) triple the UI names a variant id by. Built once
 *  per catalogue in `cart-context.tsx`. */
export interface VariantMatch {
  entry: CartCatalogEntry;
  colourId: string;
  sizeId: string;
}

/**
 * A line the shopper cannot buy: the catalogue no longer explains it, or the
 * API says it is unavailable.
 *
 * IDENTIFIED BY `lineId`, not by the triple every other cart row is keyed on —
 * a variant the catalogue has lost has no colour and no size to key on, which
 * is precisely why the old `remove(key)` path could never reach it.
 */
export interface UnsellableLine {
  lineId: string;
  variantId: string;
  qty: number;
  /** The catalogue's name for it while it still has one, else null. Lets a row
   *  say which spool is being refused rather than "an item". */
  name: string | null;
}

/**
 * A line that can be drawn, priced and bought, with the catalogue rows it
 * resolves through ALREADY LOOKED UP.
 *
 * The colour and the size are resolved here rather than downstream because
 * `resolved` used to do it in the provider and drop the row when either was
 * missing — a second filter, in a second place, which is how the badge came to
 * count a line the drawer could not draw. Carrying them means the provider
 * MAPS over this list instead of filtering it again.
 */
export interface SellableLine {
  line: ApiCartLine;
  entry: CartCatalogEntry;
  colour: Colour;
  size: SizeOption;
}

export interface LineSplit {
  sellable: SellableLine[];
  unsellable: UnsellableLine[];
  /** UNITS the shopper can actually buy — what the badge promises. */
  itemCount: number;
}

export function partitionLines(
  lines: ApiCartLine[],
  byVariant: Map<string, VariantMatch>,
): LineSplit {
  const sellable: LineSplit["sellable"] = [];
  const unsellable: UnsellableLine[] = [];
  let itemCount = 0;

  for (const line of lines) {
    const match = byVariant.get(line.variantId);
    /* `!== false` RATHER THAN TRUTHY. The field is the API's assertion that
       something cannot be bought; an absent one is not that assertion, and
       reading a missing field as a refusal would empty a whole basket over a
       response shape rather than over stock. */
    const colour = match?.entry.colours.find((c) => c.id === match.colourId);
    const size = match?.entry.sizes.find((s) => s.id === match.sizeId);
    if (match && colour && size && line.available !== false) {
      sellable.push({ line, entry: match.entry, colour, size });
      itemCount += line.qty;
      continue;
    }
    unsellable.push({
      lineId: line.id,
      variantId: line.variantId,
      qty: line.qty,
      name: match?.entry.name ?? null,
    });
  }

  return { sellable, unsellable, itemCount };
}
