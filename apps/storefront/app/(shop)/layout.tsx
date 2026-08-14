import type { ReactNode } from "react";
import { ShopShell } from "@plaspool/shop";

/**
 * Every `(shop)` route renders inside the shop's own chrome — announcement
 * bar, sticky nav, footer and the single cart drawer.
 *
 * Known merge item, not a bug in this layout: `app/layout.tsx` still renders
 * the marketing `<Nav />` and `<Footer />` globally, so `/store` currently
 * shows both sets of chrome. Phase 1 owns moving the marketing chrome into a
 * `(site)` group.
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}
