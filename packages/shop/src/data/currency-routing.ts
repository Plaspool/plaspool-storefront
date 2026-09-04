import { isCurrencyCode, type CurrencyCode } from "./currency-config";

/**
 * Where the currency lives in the URL, and why it lives there at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CURRENCY IS A PATH SEGMENT BECAUSE THE CATALOGUE IS PRERENDERED.
 *
 * `/store` is `revalidate = 300` and every product page is enumerated by
 * `generateStaticParams` at `revalidate = 3600` — they are built once and
 * served from KV, not rendered per request. A currency read from a COOKIE
 * would have to be read with `cookies()`, which opts the route into dynamic
 * rendering: `generateStaticParams` stops meaning anything, `/store` stops
 * being served from KV, and every view becomes a full render against the
 * commerce API. That is precisely the condition behind storefront #9's Error
 * 1102 outage (27ms median against a 10ms budget), and it would multiply the
 * KV write traffic on an account whose deploys have already failed at the
 * 1,000-write day.
 *
 * A path segment keeps every currency STATIC: `/store` and `/usd/store` are
 * two prerendered trees, each with its own cache entry, each served from KV,
 * and prices are correct in the first byte rather than corrected on hydration.
 *
 * ═══ THE COST, STATED PLAINLY ═══
 * It roughly DOUBLES the prerendered surface and therefore the KV writes per
 * deploy and per revalidation. That is the trade that was chosen deliberately
 * over an outage-shaped one, and it is the number to watch if deploys start
 * failing at the upload step again (see `CLAUDE.md`).
 *
 * ═══ THE DEFAULT CURRENCY HAS NO SEGMENT ═══
 * `/store`, not `/ngn/store`. Every existing link, bookmark and search result
 * points at the bare path, and moving them to earn symmetry would be a
 * site-wide redirect for no benefit. It also keeps the parameterless URL — the
 * one people share — quoting the currency the shop is actually registered in.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * The currency whose pages live at the bare path.
 *
 * A CONSTANT, NOT THE CONFIG'S `default`. The URL space cannot depend on a
 * runtime fetch: `generateStaticParams` runs at build time, and a shop whose
 * default flipped between builds would silently move every prerendered page to
 * a new path and 404 every link to the old one. Changing this is a deliberate
 * migration with redirects, not a config edit.
 */
export const DEFAULT_CURRENCY: CurrencyCode = "NGN";

/** The path segment for a currency, or null when it is the default one and
 *  therefore has no segment of its own. */
export function segmentFor(code: CurrencyCode): string | null {
  return code === DEFAULT_CURRENCY ? null : code.toLowerCase();
}

/**
 * The currency a path segment names, or undefined if it names none.
 *
 * CASE-SENSITIVE ON THE WAY IN. Only the lower-case form is generated, so
 * `/USD/store` is not a second spelling of a page that exists — it is a URL
 * this shop does not serve, and answering it would create a duplicate of every
 * catalogue page for search engines to choose between.
 */
export function currencyFromSegment(segment: string | undefined): CurrencyCode | undefined {
  if (!segment) return undefined;
  const upper = segment.toUpperCase();
  if (!isCurrencyCode(upper)) return undefined;
  return segment === upper.toLowerCase() && upper !== DEFAULT_CURRENCY ? upper : undefined;
}

/**
 * Inject a currency segment into a route's params.
 *
 * ═══ WHY THE ROUTE DIRECTORY IS LITERAL (`usd/`) AND NOT `[currency]/` ═══
 * A dynamic segment at the top of the shop tree was the first shape of this,
 * and it was wrong twice over. Tooling reads `[currency]/store` as matching
 * `/contact` — `@next/next/no-html-link-for-pages` started flagging six `<a>`
 * tags in the marketing pages, which is a false positive that is nonetheless
 * telling the truth about a greedy segment sitting where any future
 * single-segment route would have to compete with it.
 *
 * And it bought nothing. Paystack allows a Nigeria-registered business exactly
 * NGN and USD; cedis or rand would each need a separate company registered in
 * that country. The set is closed at two by somebody else's rules, so
 * enumerating it in the filesystem is an accurate encoding of the constraint
 * rather than a shortcut around one.
 *
 * The literal route then has no `currency` param to read, so it supplies one
 * here — and the page components keep reading it through `currencyFromSegment`
 * exactly as they would have from a dynamic segment. One validation point,
 * whichever shape the route takes.
 */
export function withCurrency<T extends object>(
  params: Promise<T>,
  code: CurrencyCode,
): Promise<T & { currency?: string }> {
  const segment = segmentFor(code);
  return params.then((resolved) => (segment ? { ...resolved, currency: segment } : resolved));
}

/*
 * ═══ THERE IS NO LIST OF CURRENCY SEGMENTS IN THIS FILE ═══
 * There was one, feeding `generateStaticParams` for a `[currency]` segment.
 * With the routes literal (`app/(shop)/usd/store/…`, see `withCurrency`) the
 * FILESYSTEM is that list, and a constant restating it could only ever drift
 * from it — a currency in the array with no directory would generate nothing,
 * and a directory with no array entry would work anyway. One source of truth,
 * and it is the one the router actually reads.
 *
 * BUILDING THE USD TREE COSTS NOTHING WHILE DOLLARS ARE OFF. The pages exist
 * and are reachable by URL, but nothing links to them: the switcher renders
 * only when the SERVER lists a second currency. Somebody who types
 * `/usd/store` today gets a page whose prices came back from an API that
 * ignored the `?currency=` — and because a price renders from the currency it
 * ARRIVES with rather than from the URL, that page shows naira, correctly
 * labelled, rather than naira amounts wearing a dollar sign. That is the
 * fail-closed direction, and it is why the tree can ship dark.
 */

/**
 * The catalogue paths a currency segment may prefix.
 *
 * ═══ ONLY THE CATALOGUE. THE CART AND CHECKOUT MUST NEVER BE PREFIXED ═══
 * A cart's currency is written server-side at creation and is authoritative —
 * `/cart` and `/checkout` read it off the cart itself, not off the URL. There
 * is deliberately no currency control at checkout for the same reason. A
 * `/usd/cart` would be a route that does not exist, and if it did it would be
 * a second, contradictory answer to a question the server has already settled.
 * The account pages are the same: an order was placed in whatever it was
 * placed in.
 */
function isCatalogPath(href: string): boolean {
  return href === "/store" || href.startsWith("/store/") || href.startsWith("/store?");
}

/**
 * An href, moved into `currency`'s tree when it belongs to one.
 *
 * Leaves alone: the default currency (no segment exists), non-catalogue paths
 * (see `isCatalogPath`), and anything that is not a site-relative path —
 * external URLs, `mailto:`, `#anchor` and an href already carrying a segment
 * are all returned untouched rather than having a prefix stapled to them.
 */
export function currencyHref(href: string, currency: CurrencyCode | undefined): string {
  const segment = currency ? segmentFor(currency) : null;
  if (!segment) return href;
  if (!href.startsWith("/")) return href;
  if (!isCatalogPath(href)) return href;
  return `/${segment}${href}`;
}

/**
 * The currency the CURRENT page is being served in, read from its own path.
 *
 * ═══ WHY THE PATHNAME AND NOT A CONTEXT OR A PROP ═══
 * `Link` is rendered from Server Components all over this package, so it
 * cannot read a React context — and threading a `currency` prop through every
 * card, nav item and breadcrumb that links to `/store` would touch most of the
 * package to restate something the URL already says. The page a shopper is on
 * IS the statement of which currency they are browsing in; a link out of it
 * should stay in the same tree, and that is exactly what this reads.
 */
export function currencyFromPathname(pathname: string | null | undefined): CurrencyCode | undefined {
  if (!pathname) return undefined;
  return currencyFromSegment(pathname.split("/")[1]);
}

/**
 * The canonical URL for a catalogue page.
 *
 * ═══ EVERY CURRENCY VARIANT CANONICALISES TO THE DEFAULT ONE ═══
 * `/store/products/pla` and `/usd/store/products/pla` are the same product
 * described twice, differing only in the symbol in front of a number. Left to
 * compete they are duplicate content: search engines pick one arbitrarily,
 * split the ranking signals between them, and may show a shopper in Lagos the
 * dollar page.
 *
 * The naira page is the canonical one because the shop is registered in
 * Nigeria and that is the URL every existing link and search result already
 * points at. The consequence, accepted knowingly: the USD pages are not
 * competing for international search traffic on their own. They are a
 * convenience for somebody already here who has chosen dollars, not a second
 * storefront — and making them a second storefront is an SEO decision with
 * hreflang and content implications, not a side effect of a currency switcher.
 */
export function canonicalPath(pathname: string): string {
  const segment = pathname.split("/")[1];
  return currencyFromSegment(segment) ? pathname.slice(segment.length + 1) : pathname;
}
