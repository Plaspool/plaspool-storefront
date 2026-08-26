import { COMMERCE_API_BASE } from "./config";

/**
 * The cart client — the storefront's half of the commerce API's cart.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EVERY CALL RUNS IN THE BROWSER, AND EVERY CALL SENDS COOKIES.
 *
 * The cart's identity IS a cookie (`__Host-shop_cart`), so `credentials:
 * "include"` is not optional — without it the browser withholds the cookie and
 * the API mints a fresh empty basket on every request, which looks like a cart
 * that silently empties itself rather than like an error.
 *
 * IT CANNOT RUN ON THE SERVER, and that is a property rather than a limitation.
 * The Worker rendering a page has no customer cookie to send; a cart fetched
 * there would be somebody else's, or nobody's, and would then be cached as part
 * of a shared page. The cart is per-visitor state and belongs entirely on the
 * client.
 *
 * This is cross-SITE — the storefront and the API are on different registrable
 * domains — which is why the API sets `SameSite=None` on those cookies and
 * answers a credentialed preflight. See `Plaspool/plaspool-admin#15`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE THROWS. A rejected promise inside a click handler is an
 * unhandled rejection and a dead button, so every call answers a `CartResult`
 * instead and the provider decides what it means.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT USED TO ANSWER `null` FOR EVERYTHING, AND THAT COST A PRODUCTION BUG.
 *
 * "The request timed out" and "the server refused this" were the same value, so
 * the provider — which correctly keeps the basket on screen when the network
 * drops, because clearing it would look exactly like a customer's cart being
 * thrown away — also kept it on screen when the server said the cart no longer
 * existed. After checkout the API answered `409 precondition_failed` on a
 * converted cart and the drawer showed a dead basket with a Remove button that
 * did nothing, silently, forever. The API side of that is fixed
 * (`Plaspool/plaspool-admin#38`); this is the half that made it INVISIBLE.
 *
 * The distinction the provider actually needs is three-way:
 *
 *   `offline`  — nothing was reached. Keep what is on screen; it is still true.
 *   `gone`     — the cart is not there (404). Stop drawing it.
 *   `refused`  — reached, understood, declined (409/400/…). What is on screen
 *                is stale: resync from the server and say so.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Minor units plus a code. `{amount: 2300000, currency: "NGN"}` is ₦23,000. */
export interface ApiMoney {
  amount: number;
  currency: string;
}

/**
 * One line, as the API describes it.
 *
 * `unit` IS THE PRICE THE SERVER WILL CHARGE, re-quoted on every read from the
 * live catalogue rather than stored on the line. That is the same rule the
 * storefront's own cart followed when it was local — never persist a price —
 * and it is why this client does no arithmetic of its own.
 */
export interface ApiCartLine {
  id: string;
  variantId: string;
  qty: number;
  /** False when the variant has gone away or out of stock since it was added. */
  available: boolean;
  /**
   * ═══ EVERYTHING BELOW IS NULLABLE, AND A LIVE RESPONSE PROVED IT ═══
   * `sku` and `optionValues` were declared non-null here while the API sends
   * null for both on a line whose variant it can no longer resolve — the same
   * response that carries `available: false`. A type that cannot describe the
   * broken case is a type that reads as a guarantee at every call site, which
   * is how an unbuyable line came to be counted like an ordinary one.
   */
  sku: string | null;
  title: string | null;
  optionValues: Record<string, string> | null;
  unit: ApiMoney | null;
  /** What the API believes is on the shelf. Null when nothing tracks it. */
  inStock: number | null;
}

export interface ApiCartPreview {
  currency: string;
  subtotal: ApiMoney;
  grandTotal: ApiMoney;
  shipping: ApiMoney | null;
}

/**
 * The whole cart in one response — every endpoint returns this shape.
 *
 * WHICH IS WHY THIS CLIENT NEVER RE-READS AFTER A WRITE. A mutation answers the
 * new state, so a `POST` followed by a `GET` would be a second round trip and a
 * window in which the two disagree.
 */
export interface ApiCartView {
  cart: { id: string; currency: string; status: string; revision: number } | null;
  lines: ApiCartLine[];
  /** Null only when the cart is unreadable; an empty cart still previews zero. */
  preview: ApiCartPreview | null;
  /**
   * What the SERVER changed without being asked — a line dropped because its
   * variant vanished, a quantity clamped to what is left. The drawer has to
   * surface these: a basket that silently edits itself is the failure this
   * field exists to prevent.
   */
  changes: { lineId?: string; reason?: string }[];
}

/**
 * What a cart call answers. Never a thrown error, never a bare `null`.
 *
 * `refused` carries the status because the provider treats a stale-revision
 * `409` (resync and retry is reasonable) differently from a `400` it cannot
 * fix, and a human-readable `detail` when the API sent one.
 */
export type CartResult =
  | { ok: true; view: ApiCartView }
  | { ok: false; reason: "offline" }
  | { ok: false; reason: "gone" }
  | { ok: false; reason: "refused"; status: number; detail?: string };

async function call(path: string, init: RequestInit = {}): Promise<CartResult> {
  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/shop${path}`, {
      ...init,
      /* The cart's identity. Nothing works without it. */
      credentials: "include",
      headers: init.body ? { "content-type": "application/json" } : undefined,
    });
  } catch {
    /* THE ONLY CASE WHERE NOTHING IS KNOWN. `fetch` rejects for transport
       failures — offline, DNS, CORS preflight — and for nothing else. A 4xx is
       a successful round trip carrying bad news, which is why it is below and
       not here. */
    return { ok: false, reason: "offline" };
  }

  if (res.ok) {
    try {
      return { ok: true, view: (await res.json()) as ApiCartView };
    } catch {
      /* A 200 whose body is not the cart is not a cart. Treated as a refusal
         rather than as offline: the server answered, we just cannot use it. */
      return { ok: false, reason: "refused", status: res.status };
    }
  }

  /* 404 IS NOT AN ERROR TO SHOW ANYONE. It means this browser has no cart —
     because it never had one, because it expired, or because the one it had
     became an order. All three are "your basket is empty", which is a state,
     not a failure. */
  if (res.status === 404) return { ok: false, reason: "gone" };

  return { ok: false, reason: "refused", status: res.status, detail: await detailOf(res) };
}

/** The API's `detail` string when it sent one. Never trusted to exist, and
 *  never shown raw to a shopper — the provider writes the copy. */
async function detailOf(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { detail?: unknown; error?: unknown };
    const value = body.detail ?? body.error;
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The current basket. The API answers an empty view rather than 404 when this
 *  browser has never had one, so `gone` here means a cart that was retired. */
export function readCart(): Promise<CartResult> {
  return call("/cart");
}

/**
 * Create the basket.
 *
 * CALLED LAZILY, ON THE FIRST ADD, never on page load. Creating one for every
 * visitor would set a cookie on people who never touch the shop and fill the
 * carts table with empties — and the API's own rate budget on this endpoint is
 * sized for a real basket rather than a page view.
 */
export function createCart(): Promise<CartResult> {
  return call("/cart", { method: "POST" });
}

/**
 * `baseRevision` is the cart's CURRENT revision, and it changes after almost
 * every call — see the file header on `/cart/lines`. Reading it back with a
 * fresh `GET` rather than tracking a local counter costs one extra round trip
 * per add, and it is the round trip that avoids the `400 {"detail":
 * "baseRevision"}` a stale value produces.
 */
export async function addLine(variantId: string, qty: number): Promise<CartResult> {
  const current = await call("/cart");
  /* The read's own failure is the add's failure, and it is passed through
     unchanged rather than flattened — a `gone` here means the cart was retired
     between opening the page and pressing the button, which the provider
     handles by starting a new one. */
  if (!current.ok) return current;
  if (!current.view.cart) return { ok: false, reason: "gone" };
  return call("/cart/lines", {
    method: "POST",
    body: JSON.stringify({ variantId, qty, baseRevision: current.view.cart.revision }),
  });
}

export function setLineQty(lineId: string, qty: number): Promise<CartResult> {
  return call(`/cart/lines/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    body: JSON.stringify({ qty }),
  });
}

export function removeLine(lineId: string): Promise<CartResult> {
  return call(`/cart/lines/${encodeURIComponent(lineId)}`, { method: "DELETE" });
}

/** Minor units → whole Naira, the one place this conversion happens client-side.
 *  `money.ts` formats; this converts. */
export function majorUnits(money: ApiMoney | null): number {
  return money ? Math.round(money.amount / 100) : 0;
}
