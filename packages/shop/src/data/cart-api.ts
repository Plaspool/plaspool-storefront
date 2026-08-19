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
 * NOTHING HERE THROWS FOR A NETWORK FAILURE. A cart that cannot reach the API
 * is a cart the customer cannot change, and the drawer says so — but a rejected
 * promise inside a click handler is an unhandled rejection and a dead button.
 * Every call answers `null` instead, and the provider decides what that means.
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
  sku: string;
  title: string | null;
  optionValues: Record<string, string>;
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

async function call(path: string, init: RequestInit = {}): Promise<ApiCartView | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/shop${path}`, {
      ...init,
      /* The cart's identity. Nothing works without it. */
      credentials: "include",
      headers: init.body ? { "content-type": "application/json" } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiCartView;
  } catch {
    return null;
  }
}

/** The current basket. Answers an empty view rather than 404 when there is none. */
export function readCart(): Promise<ApiCartView | null> {
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
export function createCart(): Promise<ApiCartView | null> {
  return call("/cart", { method: "POST" });
}

/**
 * `baseRevision` is the cart's CURRENT revision, and it changes after almost
 * every call — see the file header on `/cart/lines`. Reading it back with a
 * fresh `GET` rather than tracking a local counter costs one extra round trip
 * per add, and it is the round trip that avoids the `400 {"detail":
 * "baseRevision"}` a stale value produces.
 */
export async function addLine(variantId: string, qty: number): Promise<ApiCartView | null> {
  const current = await call("/cart");
  if (!current?.cart) return null;
  return call("/cart/lines", {
    method: "POST",
    body: JSON.stringify({ variantId, qty, baseRevision: current.cart.revision }),
  });
}

export function setLineQty(lineId: string, qty: number): Promise<ApiCartView | null> {
  return call(`/cart/lines/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    body: JSON.stringify({ qty }),
  });
}

export function removeLine(lineId: string): Promise<ApiCartView | null> {
  return call(`/cart/lines/${encodeURIComponent(lineId)}`, { method: "DELETE" });
}

/** Minor units → whole Naira, the one place this conversion happens client-side.
 *  `money.ts` formats; this converts. */
export function majorUnits(money: ApiMoney | null): number {
  return money ? Math.round(money.amount / 100) : 0;
}
