import { Suspense } from "react";
import { CheckoutComplete, getLineImages } from "@plaspool/shop";

/**
 * Where Paystack sends the customer back — see `checkout-complete.tsx` for
 * the whole story. `useSearchParams` inside `CheckoutComplete` requires a
 * `Suspense` boundary at the route, which is also what marks this segment
 * dynamic; there is no static shell to serve someone arriving with a real
 * `reference` in the URL.
 *
 * ⚠️ `PAYMENTS_CALLBACK_URL` in the admin deployment is UNCHANGED as of this
 * change — it still points at the admin app root, not here. This route is
 * built and ready; only the owner can update that production env var (and
 * redeploy the admin app afterward, since it bakes in at build time).
 */
export const dynamic = "force-dynamic";

export default async function CheckoutCompletePage() {
  /* AWAITED OUTSIDE THE BOUNDARY, not inside it — the same split
     `/account/orders/[orderNumber]` makes, for the same reason. `Suspense`
     here exists for `useSearchParams`, which resolves on the client;
     suspending the same boundary on a server fetch as well would hold the
     whole page behind a `null` fallback while the catalogue is read.

     The receipt draws a picture per line, and a line carries only a
     `variantId` — no image field — so the picture is resolved
     `variantId` → catalogue. `getLineImages()` reads the ANONYMOUS product
     list every visitor gets, on the cache window `/store` already shares, so
     nothing keyed to this person is read on the server here. The receipt
     itself never touches the network: it is read from `sessionStorage` in the
     browser (see `checkout/receipt-snapshot.ts`). */
  const lineImages = await getLineImages();
  return (
    <Suspense fallback={null}>
      <CheckoutComplete lineImages={lineImages} />
    </Suspense>
  );
}
