import { getRewardsProgram } from "@plaspool/shop";
import { PlaspoolLanding } from "@plaspool/web";

/**
 * ASYNC NOW, AND THE REWARDS CARD IS WHY.
 *
 * `PlaspoolLanding` is `"use client"` from its first line, so it cannot fetch
 * anything itself. The programme is read here — on the server, inside the
 * revalidate window declared below — and handed down as a plain object, which
 * is the same arrangement `/store` uses for `RewardsBand`.
 *
 * `getRewardsProgram` answers null rather than throwing when the marketing API
 * is unreachable, so a marketing outage costs one card on this page and
 * nothing else.
 */
export default async function Home() {
  const program = await getRewardsProgram();
  return <PlaspoolLanding program={program} />;
}

// Must match MARKETING_REVALIDATE in packages/shop/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
//
// Without this, `/` built fully static with no revalidate window at all —
// `AnnouncementBar` (mounted in `(site)/layout.tsx`, above `<Nav/>`) is the
// first fetch this route composes. `/store/page.tsx` sets the same literal
// for the same reason: the shell carrying the bar there is `ShopShell`, a
// layout rather than that page either, so the window has to be declared
// explicitly rather than left for Next to infer.
//
// `getRewardsProgram()` above tags its own fetch with the same window, so the
// card and the announcement bar go stale together rather than one at a time.
export const revalidate = 300;
