import { Suspense } from "react";
import { OrderDetailPage } from "@plaspool/shop";

/**
 * One order, signed-in or guest-with-`?token=`. `useSearchParams` inside
 * `OrderDetailPage` requires a `Suspense` boundary at the route, the same
 * shape `/checkout/complete` uses for the same reason.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrderDetailPage />
    </Suspense>
  );
}

/* Per-customer state — no server fetch of its own, same reasoning as
   `/account/orders`. */
