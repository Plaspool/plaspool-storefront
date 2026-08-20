import { notFound } from "next/navigation";
import { getLineImages } from "@plaspool/shop";

import { AccountBench } from "./bench";

/**
 * `/dev/account` — the account area's development bench.
 *
 * `/api/shop/customer/me`, `/me/points` and `/me/points/ledger` are all
 * cookie-identified, and the commerce API's `APP_ORIGINS` does not include
 * localhost, so none of `/account`, `/account/rewards` or a signed-in
 * `/account/orders` can be opened in a dev browser at all. This renders every
 * one of them from fixtures instead, in states a live dev environment cannot
 * reach.
 *
 * 404 IN PRODUCTION, not merely unlinked. `notFound()` runs before anything
 * else on the route, so a production deploy has no `/dev/account` even though
 * the file ships. Same guard, same reason, as `/dev/orders`.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  /* THE REAL INDEX, FROM THE REAL CATALOGUE — the same call the account routes
     make, so what a fixture line resolves to here is what it resolves to in
     production. */
  return <AccountBench lineImages={await getLineImages()} />;
}
