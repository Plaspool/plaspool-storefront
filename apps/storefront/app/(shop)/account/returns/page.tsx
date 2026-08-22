import { Suspense } from "react";
import { ReturnsPage, ReturnsSkeleton, getRewardsProgram } from "@plaspool/shop";

/**
 * `/account/returns` — a shopper's own return requests, and where each has
 * got to.
 *
 * Mirrors `/account/rewards`'s route shape, with one difference: the fallback
 * and the page both need the WHOLE programme, not just its name. `RewardsPage`
 * only ever prints `programName` in a heading; `ReturnsPage` also builds the
 * award line's noun ("50 <the operator's word>"), which a bare name cannot
 * pluralise. `getRewardsProgram()` is the same public, cacheable read
 * (`MARKETING_REVALIDATE`) either way, so this costs nothing extra to fetch.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const program = await getRewardsProgram();
  return (
    <Suspense fallback={<ReturnsSkeleton title={program?.name ?? null} />}>
      <ReturnsPage program={program} />
    </Suspense>
  );
}

/* Per-customer state, same reasoning as `/account/rewards`: the shopper's own
   return history is cookie-identified, so it is never fetched on the server —
   `force-dynamic` keeps this segment out of the static shell rather than
   letting one customer's returns get baked into a page the Worker's cache
   could hand to the next visitor. Unlike `/returns` itself, which reads
   nothing per-customer and deliberately carries no `dynamic` export at all. */
