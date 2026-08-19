import { COMMERCE_API_BASE } from "./config";
import type { ApiMoney } from "./cart-api";
import type { Address, ShippingOption } from "./checkout-api";

/**
 * The order-history client — the storefront's half of the commerce API's
 * order endpoints.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALL THREE CALLS ARE CROSS-SITE, same rule as `cart-api.ts` and
 * `checkout-api.ts` — `credentials: "include"` is not optional.
 *
 * `GET /orders` (the list) is SIGNED-IN ONLY. It 401s when no customer
 * session resolves from the cookie, and that 401 is not an error — it means
 * "sign in to see these". The caller renders a sign-in prompt, not a crash.
 *
 * `GET /orders/:orderNumber` and its `/events` sibling work for BOTH a
 * signed-in customer AND a guest carrying a signed `token` query param — the
 * link a guest gets after checkout. Pass it through when present; omit it
 * for a signed-in customer reading their own list.
 *
 * EVERY LOOKUP FAILURE ON THE DETAIL ROUTE IS THE SAME 404 — absent, not
 * yours, wrong token, expired token, all collapse to one `not_found` result.
 * The admin's own comment is explicit that distinguishing them tells an
 * unauthenticated caller whether an order exists at all. Do not try to
 * infer which happened here or upstream in the UI.
 *
 * The response omits `checkoutId` and `paymentIntentId` on purpose — nothing
 * here tries to read either.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface OrderLine {
  variantId: string;
  sku?: string | null;
  title?: string | null;
  optionValues?: Record<string, string>;
  qty: number;
  unit: ApiMoney;
  lineTotal: ApiMoney;
}

/** The order itself, as `/orders` and `/orders/:orderNumber` both describe
 *  it. Optional fields are read defensively — the exact set the API sends
 *  beyond `orderNumber`, `status`, `createdAt` and the totals was not pinned
 *  down for this change, so nothing here assumes a field is present. */
export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  createdAt: string;
  email?: string | null;
  shippingAddress?: Address | null;
  shipping?: ShippingOption | null;
  subtotal: ApiMoney;
  shippingTotal?: ApiMoney | null;
  taxTotal?: ApiMoney | null;
  adjustmentTotal?: ApiMoney | null;
  grandTotal: ApiMoney;
}

export interface OrderEvent {
  id: string;
  type: string;
  createdAt: string;
  detail?: string | null;
}

export interface OrderListItem {
  order: Order;
  lines: OrderLine[];
}

export type OrdersListResult =
  | { ok: true; items: OrderListItem[]; nextCursor: string | null }
  | { ok: false; reason: "unauthenticated" | "network" };

export type OrderDetailResult =
  | { ok: true; order: Order; lines: OrderLine[] }
  | { ok: false; reason: "not_found" | "network" };

export type OrderEventsResult =
  | { ok: true; events: OrderEvent[] }
  | { ok: false; reason: "not_found" | "network" };

/** The signed-in customer's orders, newest first, one cursor-page at a time.
 *  There is no total count and no page number — the API does not answer
 *  either, so nothing here invents them. */
export async function listOrders(
  cursor?: string,
  limit?: number,
): Promise<OrdersListResult> {
  const url = new URL(`${COMMERCE_API_BASE}/api/shop/orders`);
  if (cursor) url.searchParams.set("cursor", cursor);
  if (limit) url.searchParams.set("limit", String(limit));

  let res: Response;
  try {
    res = await fetch(url.toString(), { credentials: "include" });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (res.status === 401) return { ok: false, reason: "unauthenticated" };
  if (!res.ok) return { ok: false, reason: "network" };

  const body = (await res.json().catch(() => null)) as {
    items: OrderListItem[];
    nextCursor: string | null;
  } | null;
  if (!body) return { ok: false, reason: "network" };
  return { ok: true, items: body.items, nextCursor: body.nextCursor };
}

/** One order, by number. `token` is the signed guest link's query param —
 *  pass it when the visitor arrived with one; a signed-in customer reading
 *  their own order needs none. */
export async function getOrder(
  orderNumber: string,
  token?: string | null,
): Promise<OrderDetailResult> {
  const url = new URL(
    `${COMMERCE_API_BASE}/api/shop/orders/${encodeURIComponent(orderNumber)}`,
  );
  if (token) url.searchParams.set("token", token);

  let res: Response;
  try {
    res = await fetch(url.toString(), { credentials: "include" });
  } catch {
    return { ok: false, reason: "network" };
  }

  /* Every lookup failure — absent, not yours, wrong token, expired token —
     is deliberately the same 404. Do not distinguish them here. */
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "network" };

  const body = (await res.json().catch(() => null)) as {
    order: Order;
    lines: OrderLine[];
  } | null;
  if (!body) return { ok: false, reason: "network" };
  return { ok: true, order: body.order, lines: body.lines };
}

/** The order's timeline. Same authorization as `getOrder` — same `token`,
 *  same collapsed 404. */
export async function getOrderEvents(
  orderNumber: string,
  token?: string | null,
): Promise<OrderEventsResult> {
  const url = new URL(
    `${COMMERCE_API_BASE}/api/shop/orders/${encodeURIComponent(orderNumber)}/events`,
  );
  if (token) url.searchParams.set("token", token);

  let res: Response;
  try {
    res = await fetch(url.toString(), { credentials: "include" });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "network" };

  const body = (await res.json().catch(() => null)) as { events: OrderEvent[] } | null;
  if (!body) return { ok: false, reason: "network" };
  return { ok: true, events: body.events };
}
