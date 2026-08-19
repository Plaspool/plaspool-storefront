import { COMMERCE_API_BASE } from "./config";
import type { ApiMoney } from "./cart-api";

/**
 * The checkout client — the storefront's half of the commerce API's checkout
 * state machine over the cart.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `checkoutId` IS THE CART ID. There is no separate checkout entity and no
 * `shop_checkouts` table — every function below that wants "the checkout"
 * takes the cart id `readCart()` already returned.
 *
 * EVERY CALL IS CROSS-SITE and needs `credentials: "include"`, the same rule
 * `cart-api.ts` follows, for the same cookie.
 *
 * `baseRevision` IS REQUIRED on `/checkout/addresses`, `/checkout/shipping`
 * and `/checkout/freeze`, and it is the cart's CURRENT revision — read it back
 * from `GET /cart` immediately before the call rather than reusing a value
 * from an earlier response. A stale value is `400 {"detail":"baseRevision"}`.
 *
 * `GET /checkout/totals` answers `gone` until the cart is frozen — the freeze
 * response already carries the totals, so this client only calls `/totals`
 * to re-read them on a later render (e.g. after a reload of the review step).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE THROWS FOR A NETWORK FAILURE OR A 4xx. Every call answers a
 * discriminated `CheckoutResult`, and the caller decides what a particular
 * `error` code means on its step — a checkout wizard that could throw out of
 * a click handler is a dead button, same as the cart.
 */

export interface Address {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  /** State/province. Optional at the type the API accepts, but required by
   *  this client's own address step — see `AddressForm`. */
  region?: string | null;
  postalCode?: string | null;
  /** ISO-3166-1 alpha-2, UPPERCASE. */
  countryCode: string;
  phone?: string | null;
}

export interface ShippingOption {
  id: string;
  label: string;
  amount: ApiMoney;
  taxable: boolean;
}

export interface TotalsLine {
  variantId: string;
  qty: number;
  unit: ApiMoney;
  lineTotal: ApiMoney;
  taxable: boolean;
  taxAmount: ApiMoney;
}

export interface FrozenTotals {
  currency: string;
  lines: TotalsLine[];
  shipping: ShippingOption | null;
  subtotal: ApiMoney;
  adjustmentTotal: ApiMoney;
  shippingTotal: ApiMoney;
  taxTotal: ApiMoney;
  grandTotal: ApiMoney;
}

export interface Reservation {
  id: string;
  variantId: string;
  qty: number;
  expiresAt: string;
}

export interface Shortfall {
  variantId: string;
  requested: number;
  available: number;
}

export interface PaymentIntent {
  id: string;
  checkoutId: string;
  status: "requires_payment" | "captured" | "failed" | "cancelled" | string;
  amount: number;
  currency: string;
  authorizationUrl: string | null;
  refundedTotal: number;
}

/** Every failure mode a checkout route can name, collapsed to one shape the
 *  UI switches on. `detail` carries whatever else the API said, for the rare
 *  case a screen wants to show it verbatim (e.g. a field name). */
export type CheckoutError =
  | { code: "empty_cart" }
  | { code: "insufficient_stock"; shortfalls: Shortfall[] }
  | { code: "no_shipping_address" }
  | { code: "unresolved_lines"; variantIds: string[] }
  | { code: "currency_mismatch" }
  | { code: "gone" }
  | { code: "bad_revision" }
  | { code: "field"; field: string; detail?: string }
  | { code: "network" }
  | { code: "unknown"; status: number; detail?: string };

export type CheckoutResult<T> = { ok: true; data: T } | { ok: false; error: CheckoutError };

function classify(status: number, body: Record<string, unknown> | null): CheckoutError {
  const errorCode = typeof body?.error === "string" ? body.error : null;
  const detail = typeof body?.detail === "string" ? body.detail : undefined;
  if (status === 410 || errorCode === "gone") return { code: "gone" };
  if (status === 400 && detail === "baseRevision") return { code: "bad_revision" };
  if (status === 400 && detail && ["email", "shipping", "optionId"].includes(detail)) {
    return { code: "field", field: detail };
  }
  if (errorCode === "insufficient_stock") {
    return { code: "insufficient_stock", shortfalls: (body?.shortfalls as Shortfall[]) ?? [] };
  }
  if (errorCode === "unavailable_lines" || errorCode === "unresolved_lines") {
    return { code: "unresolved_lines", variantIds: (body?.variantIds as string[]) ?? [] };
  }
  if (errorCode === "currency_mismatch") return { code: "currency_mismatch" };
  if (errorCode === "precondition_failed" && body?.operation === "no_shipping_address") {
    return { code: "no_shipping_address" };
  }
  if (errorCode === "precondition_failed" && body?.operation === "empty_cart") {
    return { code: "empty_cart" };
  }
  return { code: "unknown", status, detail };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<CheckoutResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/shop${path}`, {
      ...init,
      credentials: "include",
      headers: init.body ? { "content-type": "application/json" } : undefined,
    });
  } catch {
    return { ok: false, error: { code: "network" } };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) return { ok: false, error: classify(res.status, body) };
  return { ok: true, data: body as T };
}

/** The cart's live revision, read fresh — never tracked locally. See the
 *  file header on why. Answers `null` when there is no cart to read. */
export async function currentCartRevision(): Promise<{ cartId: string; revision: number } | null> {
  const res = await request<{ cart: { id: string; revision: number } | null }>("/cart");
  if (!res.ok || !res.data.cart) return null;
  return { cartId: res.data.cart.id, revision: res.data.cart.revision };
}

/** Reserve stock for the cart's current lines. Holds for 15 minutes, with one
 *  extension — spent at `freezeCheckout`. */
export function startCheckout(): Promise<CheckoutResult<{ reservations: Reservation[] }>> {
  return request("/checkout/start", { method: "POST" });
}

export function setCheckoutAddress(
  shipping: Address,
  baseRevision: number,
): Promise<CheckoutResult<{ zone: string; options: ShippingOption[] }>> {
  return request("/checkout/addresses", {
    method: "PUT",
    body: JSON.stringify({ shipping, baseRevision }),
  });
}

export function setCheckoutShipping(
  optionId: string,
  baseRevision: number,
): Promise<CheckoutResult<{ shipping: ShippingOption }>> {
  return request("/checkout/shipping", {
    method: "PUT",
    body: JSON.stringify({ optionId, baseRevision }),
  });
}

/** From here the number is the price. The response carries the totals — do
 *  not follow this with a `GET /checkout/totals`, which answers `gone` for a
 *  cart that was never frozen but is a needless round trip for one that was. */
export function freezeCheckout(
  baseRevision: number,
): Promise<CheckoutResult<{ totals: FrozenTotals }>> {
  return request("/checkout/freeze", {
    method: "POST",
    body: JSON.stringify({ baseRevision }),
  });
}

/** Re-read the frozen totals, e.g. after a reload of the review step. Answers
 *  `{ code: "gone" }` for a cart that has not been frozen. */
export function getCheckoutTotals(): Promise<CheckoutResult<{ totals: FrozenTotals }>> {
  return request("/checkout/totals");
}

export function createPaymentIntent(
  checkoutId: string,
  email: string,
  idempotencyKey: string,
): Promise<CheckoutResult<PaymentIntent>> {
  return request("/payments/intents", {
    method: "POST",
    body: JSON.stringify({ checkoutId, email, idempotencyKey }),
  });
}

/** Poll a payment's state. Used on the return route while a webhook may
 *  still be in flight. */
export function getPaymentIntent(id: string): Promise<CheckoutResult<PaymentIntent>> {
  return request(`/payments/intents/${encodeURIComponent(id)}`);
}

/**
 * Ask the provider directly rather than waiting on the webhook.
 *
 * THIS IS WHAT MAKES THE RETURN ROUTE HONEST. The browser landing on the
 * callback URL is a UI hint and carries no evidence of payment — this route
 * asks Paystack, then applies the answer through the same path the webhook
 * uses. Calling it once on arrival, before falling back to polling
 * `getPaymentIntent`, is what lets a captured payment resolve to a
 * confirmation without waiting out the sweep.
 */
export function confirmPaymentIntent(id: string): Promise<CheckoutResult<PaymentIntent>> {
  return request(`/payments/intents/${encodeURIComponent(id)}/confirm`, { method: "POST" });
}

