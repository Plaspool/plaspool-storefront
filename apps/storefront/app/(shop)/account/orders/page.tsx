import { Suspense } from "react";
import { OrdersListPage, OrdersListSkeleton, getLineImages } from "@plaspool/shop";

export const dynamic = "force-dynamic";

export default async function Page() {
  /* AWAITED OUTSIDE THE BOUNDARY, not inside it — the same shape
     `/account/orders/[orderNumber]` uses. `Suspense` exists here for
     `useSearchParams` (the `?show=` tab), which resolves on the client;
     suspending the same boundary on the catalogue read as well would put the
     whole page behind the fallback while it happens. */
  const lineImages = await getLineImages();
  return (
    /* THE FALLBACK IS THE LIST'S OWN SKELETON, not `null`. This boundary is
       entered on a cold load before the client knows which tab is asked for,
       and `null` there is a blank page where the shopper expects their orders —
       the exact "prose or nothing" failure `CLAUDE.md` rules out, one step
       further up. `OrdersListSkeleton` is what the page shows a moment later
       anyway, so the two waits are one continuous shape. */
    <Suspense fallback={<OrdersListSkeleton />}>
      <OrdersListPage lineImages={lineImages} />
    </Suspense>
  );
}

/* Per-customer state, same reasoning as `/cart` and `/checkout`: `GET
   /orders` is cookie-identified, so nothing customer-shaped is fetched on
   the server — `force-dynamic` keeps this segment out of the static shell
   rather than letting one customer's order list get baked into a page the
   Worker's cache could hand to the next visitor. Carries no revalidate
   window of its own and cannot drag `/store`'s down.

   THE ONE SERVER FETCH IS THE PUBLIC CATALOGUE, AND IT HAS TO BE.
   `getLineImages()` reads `GET /api/shop/products` — anonymous, identical for
   every visitor, and already cached on `CATALOG_LIST_REVALIDATE` alongside
   `/store`'s copy of the same fetch. It exists here because an order LINE
   carries no image field: a picture is resolved `variantId` → catalogue, and
   resolving that in the browser would be a request per line on a page that can
   hold twenty orders. One cached read on the server, one plain object down the
   tree, no network per row.

   The rule this does NOT break is the one above it. Nothing keyed to a person
   is read here, so there is nothing about this visitor for a shared cache to
   retain — which is exactly the test, rather than "no fetching on the server"
   as a blanket. If a later change wants the orders themselves earlier, that is
   the line it must not cross. */
