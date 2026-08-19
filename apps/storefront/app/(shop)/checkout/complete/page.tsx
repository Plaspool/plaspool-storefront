import { Suspense } from "react";
import { CheckoutComplete } from "@plaspool/shop";

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
export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={null}>
      <CheckoutComplete />
    </Suspense>
  );
}

/* No server fetch of its own — same reasoning as `/cart` and `/checkout`. */
