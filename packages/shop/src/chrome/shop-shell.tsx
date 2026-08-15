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
      <div className="flex min-h-screen flex-col">
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
