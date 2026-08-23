import { AnnouncementBar } from "@plaspool/shop";
import { Footer, Nav } from "@plaspool/web";

/**
 * Marketing and blog chrome.
 *
 * The nav and footer live here rather than in the root layout because the shop
 * carries its own — `(shop)/layout.tsx` mounts `ShopShell`, which brings a
 * different nav (categories, search, cart, account) and a different footer.
 * With both sets in the root layout every `/store` page rendered two navs and
 * two footers.
 *
 * The root layout keeps only what is genuinely global: html, body, theme,
 * consent, analytics and the skip link. Each route group owns its own
 * `<main id="content">` so the skip link has a target on both sides.
 *
 * ═══ `AnnouncementBar` ALONE, NOT `ShopShell` ═══
 * The bar is one line of chrome, not a nav or a footer, so mounting it here
 * does not reopen the double-chrome bug above — there is still exactly one
 * nav and one footer on every `(site)` route. It is `@plaspool/shop`'s
 * because the copy, the returns CTA and the rewards arithmetic are the
 * shop's, the same reason `ShopShell` already carries it on every `(shop)`
 * route.
 *
 * ═══ AND THAT IS WHY `(site)/page.tsx` NOW DECLARES ITS OWN `revalidate` ═══
 * This layout renders above every `(site)` route, so the bar's fetch is now
 * one every one of them composes — the exact shape `MARKETING_REVALIDATE`'s
 * own comment describes for `ShopShell`. Before this bar, `/` had no fetch of
 * its own at all and built fully static, with no revalidate window. See
 * `page.tsx` for the explicit window that now gives it one.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AnnouncementBar />
      <Nav />
      {/* tabIndex={-1}: programmatically focusable as the skip link's jump
          target, without joining the normal Tab order. */}
      <main id="content" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
