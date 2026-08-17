import type { ReactNode } from "react";

import { CartProvider } from "../cart/cart-context";
import { CartDrawer } from "../cart/cart-drawer";
import { AnnouncementBar } from "./announcement-bar";
import { ShopFooter } from "./shop-footer";
import { ShopNav } from "./shop-nav";

/**
 * The shop's chrome, composed once around every `(shop)` route: the
 * announcement bar, the nav, whatever page is mounted as `children`, the
 * footer, and the one cart drawer for the whole store.
 *
 * `CartProvider` wraps all of it because `ShopNav` reads the live cart count
 * for its badge, and `CartDrawer` needs the same context to open from
 * wherever `useCart().open()` is called.
 *
 * A plain server component itself — nothing here holds state of its own, so
 * the client boundary stays pushed down into `ShopNav`, `CartProvider` and
 * `CartDrawer`, the three pieces that actually need it.
 */
export interface ShopShellProps {
  children: ReactNode;
}

export function ShopShell({ children }: ShopShellProps) {
  return (
    <CartProvider>
      {/*
        `has-[[data-cta-bar]]` reserves room for the product page's sticky buy
        bar — and only on the routes that render one.

        The bar is `position: fixed`, so it is outside flow and sits over
        whatever is at the bottom of the scroll. The page it belongs to cannot
        solve that alone: its own padding stops at the end of `<main>`, while
        the footer below is the shell's, so the last band of the footer stayed
        under the bar at full scroll — permanently unreadable, since there is
        no further to scroll.

        Reserving it here instead of on the page is what reaches the footer,
        and `:has()` is what keeps `/store` and the category pages from paying
        for a bar they never render. Height matches the bar: a 3rem button plus
        `py-3` either side plus the 2px stroke, rounded up, plus the iOS
        home-indicator inset the bar also pads itself by.
      */}
      <div className="flex min-h-screen flex-col has-[[data-cta-bar]]:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <AnnouncementBar />
        <ShopNav />
        {/* id/tabIndex: the root layout's skip link jumps here. Each route
            group owns its own <main>, so the shop supplies this one. */}
        <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <ShopFooter />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
