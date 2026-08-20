import { Suspense } from "react";
import { AccountHomePage, AccountHomeSkeleton, getRewardsProgram } from "@plaspool/shop";

/**
 * `/account` — the account area's front door.
 *
 * THE ONE SERVER READ IS THE PUBLIC PROGRAMME, and it is the same argument
 * `/account/orders` makes for reading the catalogue: `GET
 * /api/public/marketing/rewards` is anonymous, identical for every visitor and
 * already cached on `MARKETING_REVALIDATE`. Nothing keyed to a person is read
 * here — the customer and their balance are both fetched in the browser, over
 * their own cookie.
 *
 * It is read on the server rather than in the component because the page needs
 * it BEFORE the customer resolves: it decides whether the rewards row exists at
 * all, and therefore how many rows the skeleton draws. Fetching it in the
 * browser would make the placeholder guess at its own length.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const program = await getRewardsProgram();
  const programName = program?.name ?? null;
  return (
    <Suspense fallback={<AccountHomeSkeleton programName={programName} />}>
      <AccountHomePage programName={programName} />
    </Suspense>
  );
}
