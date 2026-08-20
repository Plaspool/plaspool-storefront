import { notFound } from "next/navigation";
import { getLineImages } from "@plaspool/shop";

import { OrdersBench } from "./bench";

/**
 * `/dev/orders` — the order surfaces' development bench.
 *
 * `GET /orders` is cookie-identified and the commerce API's `APP_ORIGINS` does
 * not include localhost, so neither `/account/orders` nor
 * `/account/orders/[orderNumber]` can be opened in a dev browser at all. This
 * renders both from fixtures instead, in every state a live dev environment
 * cannot reach.
 *
 * 404 IN PRODUCTION, not merely unlinked. `notFound()` runs before anything
 * else on the route, so a production deploy has no `/dev/orders` even though
 * the file ships.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  /* THE REAL INDEX, FROM THE REAL CATALOGUE — the same call the two account
     routes make, so what a fixture line resolves to on this page is what it
     resolves to in production. The fixtures' variant ids are live ones for
     exactly this reason; handing the bench a hand-written index instead would
     make the one thing under test the one thing not being tested. */
  return <OrdersBench lineImages={await getLineImages()} />;
}
