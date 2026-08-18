import Link from "next/link";

import { DELIVERY } from "../data/config";
import { formatNaira } from "../data/money";
import { listBanners } from "../data/marketing";

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
 * THE FALLBACK IS NOT A PLACEHOLDER. `DELIVERY.freeOver` is real policy, read
 * from the same constant the cart and the product page read, so the figure can
 * only ever say one thing across the store. "No banner is live" is therefore a
 * defined state that renders something true, not an empty bar — which matters
 * because no banner is live today and that is the ordinary case, not an outage.
 *
 * ONE BANNER, HIGHEST PRIORITY. The bar is one line; `listBanners` sorts by
 * priority so the choice is the operator's rather than the database's insertion
 * order. Where a placement can only show one thing, showing the second-most
 * important one is worse than showing the standing line.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Still not dismissible — a dismissible bar needs storage and a state machine
 * for one sentence, and a banner an operator scheduled is one they want seen.
 */
export async function AnnouncementBar() {
  const [banner] = await listBanners("top_bar");

  return (
    <p className="m-0 bg-brand px-4 py-2 text-center text-xs text-brand-ink">
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
              <Link
                href={banner.ctaUrl}
                className="underline decoration-brand-ink/40 underline-offset-2 hover:decoration-brand-ink"
              >
                {banner.ctaText}
              </Link>
            </>
          ) : null}
        </>
      ) : (
        <>
          {"Free delivery on orders over "}
          <span className="font-mono tabular-nums">{formatNaira(DELIVERY.freeOver)}</span>
          {" · Next day in Lagos"}
        </>
      )}
    </p>
  );
}
