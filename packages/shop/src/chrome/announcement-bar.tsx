import { Link } from "../components/link";

import { DELIVERY } from "../data/config";
import { getRewardsProgram, listBanners, pointsLabel, unitLabel } from "../data/marketing";
import { listServiceAreas } from "../data/returns-api";
import { ReturnsCta } from "../returns/returns-cta";

/**
 * One line above the nav.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A LIVE BANNER WHERE THERE IS ONE, THE STANDING DELIVERY PROMISE OTHERWISE.
 *
 * This used to be the delivery line and nothing else. It now reads `top_bar`
 * banners from the marketing API, which is what an operator actually uses to say
 * something time-bound — a sale, a public holiday, a delivery pause.
 *
 * THE FALLBACK IS NOT A PLACEHOLDER. The Spool Returns half is built from
 * `getRewardsProgram()` — the same live rewards programme `RewardsBand` reads
 * on the home page — so the figures can only ever say one thing across the
 * store. "No banner is live" is therefore a defined state that renders
 * something true, not an empty bar — which matters because no banner is live
 * today and that is the ordinary case, not an outage.
 *
 * NOT ONE NOUN IN THIS FILE IS SPELLED BY THIS FILE. The programme's name,
 * what a point is called, and what a unit is called all come from the API, on
 * the same rule `RewardsBand` follows — see its own note on why. When the
 * programme is absent or paused, the bar falls back to the delivery-speed
 * line alone rather than promise a scheme that is not running.
 *
 * ONE BANNER, HIGHEST PRIORITY. The bar is one line; `listBanners` sorts by
 * priority so the choice is the operator's rather than the database's insertion
 * order. Where a placement can only show one thing, showing the second-most
 * important one is worse than showing the standing line.
 *
 * ═══ A CTA CAN NOW OPEN A DIALOG, AND THE CONVENTION IS THE URL ═══
 * An operator sets a banner's `ctaUrl` like any other link. `isReturnsCta`
 * below is the one place that decides whether THIS particular URL means "open
 * the return-request dialog instead of navigating" — `RETURNS_PATH` exactly,
 * nothing else. A near miss — a trailing slash, a tracking query, any other
 * path — deliberately falls through to the plain `Link` it always was: it is a
 * real, working navigation, not a guess at what the operator meant. Reusing
 * `ReturnsCta` (Task 10) here rather than reimplementing its interception is
 * what keeps the history/back-button contract in one file.
 *
 * `listServiceAreas()` rides in the SAME `Promise.all` on `MARKETING_REVALIDATE`
 * — the same window `listBanners`/`getRewardsProgram` already use — so it adds
 * no new, shorter window for `ShopShell` to compose into every `(shop)` route.
 * See that constant's own comment for the outage this guards against, and this
 * task's report for the build figures that confirm it held.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Still not dismissible — a dismissible bar needs storage and a state machine
 * for one sentence, and a banner an operator scheduled is one they want seen.
 */

/** The one banner CTA this file treats specially. Named and centralised
 *  rather than a string compared at the point of use. */
export const RETURNS_PATH = "/returns";

/** Whether this banner's CTA is the returns one. The convention, in one place
 *  and named, rather than a string compared at the point of use. */
export function isReturnsCta(ctaUrl: string | null): boolean {
  return ctaUrl === RETURNS_PATH;
}

/**
 * The CTA's own look, shared by both branches below so they cannot drift.
 *
 * A SMALL WHITE BUTTON, STILL UNDERLINED. The admin's own banner preview
 * (`Stage` in `MarketingBanners.tsx`) draws a top-bar CTA as a filled pill —
 * `.btn.btn--sm.btn--outline` on its dark `--accent` bar resolves to
 * `--paper-raised` (white) with `--ink-2` (near-black) text. This mirrors
 * that in the storefront's own tokens — `bg-background`/`text-foreground`
 * are white-on-near-black in the pinned-light theme the same way — rather
 * than reproduce it pixel-for-pixel in a second design system's units. The
 * underline stays because a shape alone reads as decoration; the underline
 * is what still reads as "this goes somewhere" the instant a shopper's eye
 * lands on it, same as the plain-text version this replaces.
 *
 * NOT `NEO_SURFACE`. That treatment is one real call to action per screen,
 * and the page underneath this bar already has its own. This is chrome, so
 * it is styled directly rather than borrowing the one raised look the shop
 * spends on the thing it actually wants clicked.
 */
const CTA_BUTTON_CLASSES =
  "inline-flex items-center whitespace-nowrap rounded-md bg-background px-3 py-1 font-medium text-foreground underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground";

export async function AnnouncementBar() {
  const [banners, program, areas] = await Promise.all([
    listBanners("top_bar"),
    getRewardsProgram(),
    listServiceAreas(),
  ]);
  const [banner] = banners;

  const perReturn = program ? program.minUnitsPerReturn * program.pointsPerUnit : 0;

  return (
    <p data-print-hide className="m-0 bg-brand px-4 py-2 text-center text-xs text-brand-ink">
      {banner ? (
        <>
          {/* Title and body are one sentence in this space, not a heading and a
              paragraph — the bar is a line, and the admin's own preview shows
              them run together for the top-bar placement. */}
          <span className="font-medium">{banner.title}</span>
          {banner.body ? <>{" · "}{banner.body}</> : null}
          {banner.ctaText && banner.ctaUrl ? (
            <>
              {" "}
              {isReturnsCta(banner.ctaUrl) && program ? (
                /* The dialog needs a live programme to show the form's
                   arithmetic — the same guard `RewardsBand` uses before it
                   renders anything at all. Absent one, this falls through to
                   the plain `Link` below, which still goes to a real `/returns`
                   page that explains why there is no form there. */
                <ReturnsCta
                  program={program}
                  areas={areas ?? []}
                  label={banner.ctaText}
                  className={CTA_BUTTON_CLASSES}
                />
              ) : (
                <Link href={banner.ctaUrl} className={CTA_BUTTON_CLASSES}>
                  {banner.ctaText}
                </Link>
              )}
            </>
          ) : null}
        </>
      ) : program ? (
        <>
          {/* "Return 5 spools · earn 50 Spool Points" — the shortest true
              sentence the arithmetic supports. It leads with the action, not
              the programme name, because an operator can rename "Spool
              Returns" but the verb "return" still has to make sense next to
              whatever unit noun they pick. */}
          {"Return "}
          <span className="font-mono tabular-nums">{program.minUnitsPerReturn}</span>
          {` ${unitLabel(program.minUnitsPerReturn, program)} · earn `}
          <span className="font-mono tabular-nums">{perReturn}</span>
          {` ${pointsLabel(perReturn, program)}`}
        </>
      ) : (
        DELIVERY.abuja
      )}
    </p>
  );
}
