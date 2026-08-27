import type { Metadata } from "next";

import { ReturnFormGate } from "./return-form-gate";
import { getRewardsProgram } from "../data/marketing";
import { listServiceAreas } from "../data/returns-api";

/**
 * `/returns` — the real, linkable page behind Task 10's dialog.
 *
 * A Server Component: the programme and the district list are both public,
 * cacheable reads (`MARKETING_REVALIDATE`), so both are fetched here rather
 * than inside `ReturnForm`. `Promise.all` because the two reads are
 * independent of each other.
 *
 * ═══ `ReturnForm` NO LONGER FETCHES NOTHING ═══
 * It now reads `listMyReturns()`/`listSavedAddresses()` on mount, to prefill
 * itself — see its own file header. Those stayed OUT of this Server
 * Component on purpose: both are cookie-identified, per-customer reads, the
 * opposite of the public, cacheable pair above, and baking one shopper's own
 * data into a page this Worker can cache is exactly the mistake `orders-api.ts`
 * and every other `/me/` client in this package already avoids by staying
 * client-side. `ReturnForm` stays interactive on first paint regardless —
 * neither fetch gates its render.
 *
 * ═══ NO PROGRAMME OR FORM AT ALL WHEN `getRewardsProgram()` IS NULL ═══
 * The same rule `RewardsBand` follows on the home page: a surface explaining
 * a scheme that is not running is worse than a shorter page. This page is
 * ALWAYS reachable — it is the no-JS target of a CTA that may render on any
 * screen in the shop — so unlike `RewardsBand` it cannot simply render
 * nothing; a shopper who followed a link deserves to know why there is no
 * form here rather than land on something that looks broken. `NotRunning`
 * below is deliberately short: it does not attempt to explain a programme it
 * has no data for.
 *
 * ═══ AN EMPTY `areas` LIST IS NOT THIS FILE'S PROBLEM ═══
 * `listServiceAreas()` answers `null` on any failure, never throws, and
 * `areas ?? []` is the only translation needed here. `ReturnForm` already
 * renders a disabled district Select with a plain sentence when it is handed
 * zero areas — see its own header — rather than a Select with no options,
 * which would read as a broken control.
 *
 * ═══ NO `force-dynamic` ═══
 * Unlike `/account/rewards`, neither read here is cookie-identified: the
 * programme and the district list are the same for every visitor, so the
 * page is free to sit in the static shell and be served from cache like any
 * other marketing page. `ReturnFormGate` and `ReturnForm` are both client
 * components; the session they read is a browser-side check, same as
 * `ReturnModal`'s, and reads nothing on the server.
 *
 * ═══ WHO ACTUALLY LANDS HERE, WHICH IS WHY `ReturnFormGate` EXISTS ═══
 * This is the one URL for the feature that gets emailed by an operator,
 * handed out by support, clicked before a bundle has hydrated, returned to by
 * `next=/returns` after an abandoned sign-in, and indexed by a crawler. It is
 * the entry point MOST likely to receive a guest, and used to be the one that
 * made them pay for it — filling in the whole form before ever being told
 * they needed to sign in. `ReturnFormGate` is that check, asked here the same
 * way `ReturnModal` already asks it before mounting the form — see its own
 * header for the one place the two deliberately differ.
 */
export async function ReturnRequestPage() {
  const [program, areas] = await Promise.all([getRewardsProgram(), listServiceAreas()]);
  if (!program) return <NotRunning />;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      {/* `program.name` — the operator's own word for this, the same choice
          `RewardsHeading` and `RewardsBand`'s `<h2>` both make. No noun here
          is this file's to spell. */}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {program.name}
      </h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">
        {/* Used to be shared verbatim with `ReturnModal`'s `DialogDescription`.
            They diverged on purpose: the dialog's description has to stay
            true across its sign-in and loading states too, where "how many
            are you sending back" is not a question this page is asking yet
            — see `ReturnModal`'s own header. This page only ever shows this
            sentence directly above the real form, so it keeps the more
            specific line. Deliberately free of any unit or points noun; the
            form's own arithmetic line under the quantity field is where
            those are spelled, from `program`. */}
        Tell us how many you&apos;re sending back and where to collect them.
      </p>

      <div className="mt-8">
        <ReturnFormGate program={program} areas={areas ?? []} />
      </div>
    </div>
  );
}

/**
 * `/returns`'s own metadata — a title and description, no more.
 *
 * The only public, crawlable `(shop)` route that had neither: every other one
 * either carries its own (`storeHomeMetadata`, `productMetadata`) or is
 * per-customer and deliberately unindexable. This page's whole reason to
 * exist is that it is linkable from an email a shopper did not write
 * themselves — see the header above — so a link preview or a search result
 * naming it is exactly the audience this was missing. No `alternates` beyond
 * the app's own default: nothing here varies by query string worth a
 * canonical of its own.
 */
export const returnRequestMetadata: Metadata = {
  title: "Request a return pickup",
  /* The same sentence the page itself leads with, above. Deliberately free of
     any unit or points noun, the same rule that sentence already follows: an
     operator-renamed unit would make a hardcoded one here the stalest copy on
     the page. */
  description: "Tell us how many you're sending back and where to collect them.",
};

/** The short page a shopper who followed a link to `/returns` gets when no
 *  programme is configured. See the file header for why this exists at all
 *  rather than rendering nothing the way `RewardsBand` does. */
function NotRunning() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      {/* "Returns" is the API's own vocabulary — the endpoints this package
          calls are `/api/marketing/me/returns` and
          `/api/public/marketing/areas` — the same fallback shape
          `RewardsHeading` uses with "Rewards" when no programme name is
          available. Not a programme noun invented here. */}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Returns
      </h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">
        We are not taking returns right now. Check back later.
      </p>
    </div>
  );
}
