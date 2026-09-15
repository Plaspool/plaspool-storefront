"use client";

import * as React from "react";

import type { Product } from "../data/types";
import { fetchVariantAvailability, isMysteryBox } from "../data/mystery-box";
import type { VariantAvailability } from "../data/mystery-box";

/**
 * The box's live, fillable stock, per size — read in the browser on mount.
 *
 * Shared by the product page's buy box and the listing card's quick-add, so
 * both call a size sold out by the same read. Does nothing for an ordinary
 * product: the product payload's own stock is right for those.
 *
 * UNCACHED UPSTREAM, AND NEVER ON THE SERVER RENDER. Until an answer lands the
 * lookup returns null, which every caller reads as buyable — checkout is the
 * real authority, and "sold out" flashing on every box while loading is worse.
 */
export function useBoxAvailability(
  product: Pick<Product, "boxMode" | "variantIds">,
  colourId: string,
): (sizeId: string) => VariantAvailability | null {
  const isBox = isMysteryBox(product);
  const [bySize, setBySize] = React.useState<Record<string, VariantAvailability>>({});

  React.useEffect(() => {
    if (!isBox) return undefined;
    const controller = new AbortController();
    for (const id of new Set(Object.values(product.variantIds))) {
      void fetchVariantAvailability(id, controller.signal).then((result) => {
        if (result) setBySize((prev) => ({ ...prev, [id]: result }));
      });
    }
    return () => controller.abort();
  }, [isBox, product.variantIds]);

  return (sizeId) => bySize[product.variantIds[`${colourId}:${sizeId}`] ?? ""] ?? null;
}
