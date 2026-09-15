"use client";

import * as React from "react";

import type { Product } from "../data/types";
import { fetchVariantAvailability, isMysteryBox } from "../data/mystery-box";
import type { VariantAvailability } from "../data/mystery-box";

/** How often the box's cues are re-read while the tab is visible. */
const REFRESH_MS = 60_000;

/**
 * The box's live availability, per size, read in the browser.
 *
 * Shared by the product page's buy box and the listing card's quick-add, so
 * both call the box sold out by the same read. Does nothing for an ordinary
 * product.
 *
 * ═══ FRESHNESS ═══
 * The cues ("Only 22 left", "Just dropped 2 hours ago") are only as fresh as
 * the last read, so it is re-read on mount, when the tab becomes visible again,
 * every minute while it is visible, and whenever `refresh` is called (after an
 * add to cart). Never cached, never on the server render. Until the first
 * answer lands the lookup returns null: no cues, and buyable.
 */
export function useBoxAvailability(
  product: Pick<Product, "boxMode" | "variantIds">,
  colourId: string,
): { availabilityOf: (sizeId: string) => VariantAvailability | null; refresh: () => void } {
  const isBox = isMysteryBox(product);
  const [bySize, setBySize] = React.useState<Record<string, VariantAvailability>>({});
  const [tick, setTick] = React.useState(0);
  const refresh = React.useCallback(() => setTick((n) => n + 1), []);

  React.useEffect(() => {
    if (!isBox) return undefined;
    const controller = new AbortController();
    for (const id of new Set(Object.values(product.variantIds))) {
      void fetchVariantAvailability(id, controller.signal).then((result) => {
        if (result) setBySize((prev) => ({ ...prev, [id]: result }));
      });
    }
    return () => controller.abort();
  }, [isBox, product.variantIds, tick]);

  React.useEffect(() => {
    if (!isBox) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isBox, refresh]);

  return {
    availabilityOf: (sizeId) => bySize[product.variantIds[`${colourId}:${sizeId}`] ?? ""] ?? null,
    refresh,
  };
}
