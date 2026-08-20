import { Suspense } from "react";
import { RewardsPage, RewardsSkeleton, getRewardsProgram } from "@plaspool/shop";

/**
 * `/account/rewards` — the balance, and everything that has ever moved it.
 *
 * This is where the "vouchers and discounts history" request landed. There is
 * no per-customer voucher anywhere in this system to list; a `redemption` row
 * in the points ledger IS a discount that was spent, and it is real. See
 * `rewards-page.tsx`'s own header for the full reasoning.
 *
 * `Suspense` is for `useSearchParams` (the `?show=` filter), which resolves on
 * the client — the same shape every other filtered surface in this app uses.
 * The programme's NAME comes from the public marketing read on the server, so
 * the page has a title before the customer's own two calls resolve; every other
 * word on the page arrives with the data.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const program = await getRewardsProgram();
  const programName = program?.name ?? null;
  return (
    <Suspense fallback={<RewardsSkeleton title={programName} />}>
      <RewardsPage programName={programName} />
    </Suspense>
  );
}

/* Per-customer state, same reasoning as `/account/orders`: the balance and the
   ledger are both cookie-identified, so neither is fetched on the server and
   `force-dynamic` keeps this segment out of the static shell rather than
   letting one customer's history get baked into a page the Worker's cache
   could hand to the next visitor. */
