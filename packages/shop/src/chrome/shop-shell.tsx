import type { ReactNode } from "react";

import { listCategories, listProducts } from "../data/catalog";
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
 * A server component itself — nothing here holds state of its own, so the client
 * boundary stays pushed down into `ShopNav`, `CartProvider` and `CartDrawer`,
 * the three pieces that actually need it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND IT IS NOW THE ONE PLACE THAT FETCHES FOR ALL THREE.
 *
 * `ShopNav` needs categories and `CartProvider` needs the catalogue, and both
 * are client components that cannot `await` either. Before the commerce API
 * landed they simply called the seam, because it was a synchronous read of a
 * local array; now the shell reads once on the server and passes the results
 * down.
 *
 * The alternative — each fetching for itself in the browser — would put the nav
 * behind a round trip the server had already made, and would need CORS on
 * catalogue endpoints that have no reason to allow it.
 *
 * `Promise.all`, because the two are independent. Both are cached
 * (`CATALOG_LIST_REVALIDATE`) and neither throws, so a catalogue API having a
 * bad day gives an empty nav and an unresolvable cart rather than a 500 on every
 * route in the shop.
 *
 * WHAT CROSSES INTO THE CLIENT IS A PROJECTION. Only the five fields the cart's
 * arithmetic and drawer read — see `CartCatalogEntry`. The full `Product`
 * carries a description document each, and serialising the whole catalogue into
 * every shop page's payload to price a cart nobody has opened is a cost paid on
 * each navigation.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface ShopShellProps {
  children: ReactNode;
}

export async function ShopShell({ children }: ShopShellProps) {
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  const catalog = products.map((product) => ({
    slug: product.slug,
    name: product.name,
    colours: product.colours,
    sizes: product.sizes,
    bulkTiers: product.bulkTiers,
    /* So a basket row can show the photograph the shop uploaded rather than a
       drawing of it. Per-colour pictures ride on `colours`; this backs up a
       colour nobody has photographed. */
    coverImageUrl: product.coverImageUrl,
    /* The bridge between the two models: a UI row is (product, colour, size),
       an API line is one variant id. Without this the drawer could render a
       basket it had no way to modify. */
    variantIds: product.variantIds,
  }));

  return (
    <CartProvider catalog={catalog}>
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
        <ShopNav categories={categories} />
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
