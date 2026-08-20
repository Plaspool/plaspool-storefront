import { Suspense } from "react";
import { OrderDetailPage, getLineImages } from "@plaspool/shop";

/**
 * One order, signed-in or guest-with-`?token=`. `useSearchParams` inside
 * `OrderDetailPage` requires a `Suspense` boundary at the route, the same
 * shape `/checkout/complete` uses for the same reason.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  /* AWAITED OUTSIDE THE BOUNDARY, not inside it. `Suspense` here exists for
     `useSearchParams`, which resolves on the client; suspending the same
     boundary on a server fetch as well would put the whole page behind a
     `null` fallback while the catalogue is read, so an order that is already
     in the browser's cache would render later than it does today. The read is
     a cache hit in the ordinary case, and the fallback stays what it was. */
  const lineImages = await getLineImages();
  return (
    <Suspense fallback={null}>
      <OrderDetailPage lineImages={lineImages} />
    </Suspense>
  );
}

/* Per-customer state — the order itself is fetched in the browser, over the
   caller's cookie or their `?token=`, same reasoning as `/account/orders`.

   The one server fetch is the PUBLIC catalogue. An order line carries no image
   field, so its picture is resolved `variantId` → catalogue; `getLineImages()`
   reads the anonymous product list every visitor gets, on the cache window
   `/store` already shares. Nothing keyed to a person is read here, so there is
   nothing about this visitor for a shared cache to retain — which is the test
   the `force-dynamic` note on the list route sets out. */
