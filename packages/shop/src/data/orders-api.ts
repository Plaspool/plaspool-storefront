import { COMMERCE_API_BASE } from "./config";

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
 *
 * MONEY IS A PLAIN NUMBER IN MINOR UNITS HERE, NOT `ApiMoney`. Unlike the
 * cart and checkout responses, an order carries no `{amount, currency}`
 * pair per field — one `currency` on the order applies to every amount on
 * it. Read these fields against the server's own type
 * (`server/shop/orders/repo/orders.ts` in plaspool-admin) rather than the
 * cart/checkout shape; the two were confused once already and it rendered
 * `[object Object]`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type OrderStatus = string;

/** The order itself, exactly as the admin's `Order` type describes it minus
 *  `checkoutId`/`paymentIntentId`, which `customerView` strips before this
 *  ever reaches the browser. */
export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string;
  currency: string;
  /** Minor units. Render through `majorUnits({amount, currency})` +
   *  `formatNaira` — never divide by 100 directly. */
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  refundedTotal: number;
  status: OrderStatus;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  /** Epoch ms, not an ISO string. */
  placedAt: number;
  paidAt: number | null;
  fulfilledAt: number | null;
  cancelledAt: number | null;
  revision: number;
}

export interface OrderLine {
  id: string;
  lineNo: number;
  variantId: string;
  sku: string;
  title: string;
  optionValues: Record<string, string>;
  qty: number;
  /** Minor units. */
  unitAmount: number;
  /** Minor units. */
  lineTotal: number;
  /** How much of `qty` is covered by a non-cancelled fulfilment. */
  fulfilledQty: number;
}

export interface OrderEvent {
  id: string;
  type: string;
  message: string;
  /** Epoch ms, not an ISO string. */
  occurredAt: number;
  actorId: string | null;
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

/**
 * The addresses this customer has shipped to before, most recent first.
 *
 * FOR THE CHECKOUT'S ADDRESS STEP, which used to open on an empty form every
 * time. The API derives these from the customer's own orders rather than from an
 * address book (`Plaspool/plaspool-admin#40`), so an address appears here once
 * something has actually been delivered to it.
 *
 * ANSWERS AN EMPTY LIST FOR A GUEST rather than an error. Guest checkout is the
 * default path in this shop and it must not become an account wall — a caller
 * that has nothing to offer should render the plain form, which is exactly what
 * an empty list produces.
 */
export async function listSavedAddresses(): Promise<SavedAddress[]> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/shop/orders/addresses`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { addresses?: SavedAddress[] } | null;
    return body?.addresses ?? [];
  } catch {
    return [];
  }
}

export interface SavedAddress {
  /** The order's snapshot, so every field is `unknown` until it is read. */
  address: Record<string, unknown>;
  /** Epoch ms of the most recent order sent here. */
  lastUsedAt: number;
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
