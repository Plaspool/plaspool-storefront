import { COMMERCE_API_BASE, MARKETING_REVALIDATE } from "./config";
import type { AddOnOffer } from "./cart-api";

/**
 * The PRODUCT PAGE's add-on client — `GET /api/shop/add-ons/for-product/<slug>`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SECOND, SMALLER DOOR ONTO THE SAME FEATURE. `cart-api.ts` reads the add-ons
 * a REAL cart is offered; this reads the add-ons a HYPOTHETICAL one would be,
 * so the buy box can offer "send it without the box" before a basket exists.
 * The two answer with the same `AddOnOffer` shape and mean subtly different
 * things by it, which is the whole reason this file has a header.
 *
 * ═══ IT IS AN ESTIMATE, AND THE CART IS THE AUTHORITY ═══
 * It answers "if somebody bought `qty` of this product, what would be
 * offered?" — knowing nothing about the rest of the basket, the delivery
 * address, a discount code, or whether the shopper is signed in, any of which
 * can change which rule fits. An offer that appears here and is gone from the
 * cart is CORRECT BEHAVIOUR, not a bug to reconcile. Nothing in the storefront
 * may treat this response as a promise about a bill.
 *
 * A `basis: "item"` add-on makes that concrete: `units` counts the quantity of
 * EVERY line in the cart, so two filaments and three nozzles is five boxes.
 * This endpoint can only ever see the one product on screen, so it necessarily
 * disagrees with the cart the moment the cart holds anything else.
 *
 * ═══ IT NEVER CARRIES A CHOICE ═══
 * `choice` is always `null` here, by construction: the response is identical
 * for every viewer so that it can be cached. "Has this shopper already
 * excluded it" lives on the cart and only on the cart. There is a server test
 * that fails if anyone adds a per-viewer field to this route, so do not ask
 * for one.
 *
 * ═══ WHY THE BROWSER GOES THE LONG WAY ROUND ═══
 * `GET /api/shop/cart` answers a cross-origin request with
 * `Access-Control-Allow-Origin`; THIS ROUTE DOES NOT. Verified on 2026-09-07
 * against both `admin.plaspool.com` (with `Origin: https://plaspool.com`) and
 * `admin.dev.plaspool.com` (with `Origin: https://dev.plaspool.com`): the cart
 * carries the header, `for-product` carries nothing. Its `OPTIONS` preflight
 * advertises a full CORS policy, which makes the omission easy to miss — but a
 * simple `GET` is never preflighted, so the browser applies the response's own
 * headers, finds none, and blocks the read. `fetch` then rejects exactly the
 * way it does behind the localhost CORS wall.
 *
 * So the server reads it directly (`getProductAddOns`) and the browser reads
 * it through the storefront's own origin (`fetchProductAddOns` →
 * `/api/add-ons/for-product/<slug>`), which is the same trick
 * `/images/shop/<id>` already plays for product pictures. If the API ever
 * grows the header, `fetchProductAddOns` can point straight at it and this
 * file is the only one that changes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** What the endpoint answers. `offers: []` is the ordinary case and means
 *  "nothing applies here" — render nothing at all, no empty state. */
export interface ProductAddOns {
  productId: string;
  qty: number;
  offers: AddOnOffer[];
}

/**
 * The quantity ceiling the API's schema enforces. Sending more is a `400`, and
 * a `400` here would take out the buy box for a shopper who did nothing wrong,
 * so the clamp happens before the request rather than after it.
 *
 * `1` IS THE FLOOR AND `0` IS A `400` — the route is strict about both ends,
 * and about unknown query parameters, so nothing may add one casually.
 */
const MIN_QTY = 1;
const MAX_QTY = 1000;

export function clampAddOnQty(qty: number): number {
  if (!Number.isFinite(qty)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, Math.trunc(qty)));
}

/** `add-ons/for-product/<slug>?qty=<n>` — built once so the server route, the
 *  browser route and the tests cannot spell it three different ways. */
export function productAddOnsPath(slug: string, qty: number): string {
  return `/api/shop/add-ons/for-product/${encodeURIComponent(slug)}?qty=${clampAddOnQty(qty)}`;
}

/** Anything that is not the documented shape is treated as no offers, for the
 *  reason `addOnsOf()` exists: a shape this client does not recognise must
 *  cost the shopper a control, never the page. */
function parse(body: unknown, qty: number): ProductAddOns | null {
  if (!body || typeof body !== "object") return null;
  const view = body as Partial<ProductAddOns>;
  if (!Array.isArray(view.offers)) return null;
  return {
    productId: typeof view.productId === "string" ? view.productId : "",
    qty: typeof view.qty === "number" ? view.qty : qty,
    offers: view.offers,
  };
}

/**
 * SERVER-SIDE read, for the first paint of a product page.
 *
 * Cached on the marketing window rather than the catalogue's hour: the answer
 * depends on an add-on RULE, which an operator edits in the admin with no
 * deploy and no webhook, the same way the banners and the rewards copy move.
 * An hour of a withdrawn packaging offer is an hour of promising a saving that
 * the cart will refuse.
 *
 * `null` FOR EVERY FAILURE, INCLUDING A `404`. A slug that is not a live
 * product, an API that is down and a body this client cannot read all mean the
 * same thing to the buy box — draw no control — and distinguishing them would
 * only tempt a caller into rendering an error where a shopper wanted a
 * spool.
 */
export async function getProductAddOns(slug: string, qty = 1): Promise<ProductAddOns | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}${productAddOnsPath(slug, qty)}`, {
      next: { revalidate: MARKETING_REVALIDATE },
    });
    if (!res.ok) return null;
    return parse(await res.json(), qty);
  } catch {
    return null;
  }
}

/** Where the browser asks instead. Same path shape as the API's, on the
 *  storefront's own origin — see the header for why it cannot ask directly. */
export function proxiedProductAddOnsPath(slug: string, qty: number): string {
  return `/api/add-ons/for-product/${encodeURIComponent(slug)}?qty=${clampAddOnQty(qty)}`;
}

/**
 * BROWSER-SIDE read, for when the quantity stepper moves.
 *
 * ═══ WHY THIS IS A RE-FETCH AND NOT A MULTIPLICATION ═══
 * `unitAmount` is per unit, so scaling the saving client-side is exact — right
 * up to the moment a rule's ceiling is crossed. The packaging rule applies to
 * carts of one to four items, so at five the offer does not get bigger, it
 * DISAPPEARS. A client that multiplied would show "save ₦2,500" for a saving
 * the cart will never grant, which is the one failure mode this control must
 * not have. Only the server knows where the ceilings are.
 *
 * Takes an `AbortSignal` because a shopper holding down the stepper's plus
 * button issues one of these per press, and the answers can arrive out of
 * order — the last request must win, not the last response.
 */
export async function fetchProductAddOns(
  slug: string,
  qty: number,
  signal?: AbortSignal,
): Promise<ProductAddOns | null> {
  try {
    const res = await fetch(proxiedProductAddOnsPath(slug, qty), { signal });
    if (!res.ok) return null;
    return parse(await res.json(), qty);
  } catch {
    return null;
  }
}
