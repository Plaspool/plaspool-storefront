import { COMMERCE_API_BASE } from "./config";
import type { ApiMoney, TotalsLine } from "./cart-api";

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
  /**
   * A served-area KEY (`ServiceArea.key`), CHOSEN from the district picker —
   * never typed, never parsed out of `line1`. `null` is the ordinary value:
   * no district named, priced at the state's zone rate. Unlike the other
   * optional fields this one is never `""` — it is an identifier, not text,
   * and the picker writes `null` for "none" rather than an empty string.
   */
  district?: string | null;
  /**
   * Where the door actually is, when the shopper offered it.
   *
   * FOR THE RIDER, NOT FOR THE PRICE. There is no geographic data anywhere in
   * this system — the service areas carry a name, a key and a region, and no
   * coordinates or boundaries — so nothing can price by a point, and the
   * config says `pricing: false` on the wire so nobody wires one up by
   * accident.
   *
   * ═══ SENT ONLY WHEN THE CONFIG OFFERS IT ═══
   * `AddressesBody` is `.strict()` server-side. Until the column ships, this
   * field is a 400 with no useful message — so `submittedAddress()` attaches
   * it if and only if `config.location.offer` is true, and a server old enough
   * to refuse the field is also old enough never to say so. Do not set this
   * from anywhere else.
   *
   * OPTIONAL RATHER THAN NULLABLE, the same rule `district` follows on the
   * event payload: every `checkout.completed` already in the outbox lacks the
   * property, and a replayed payload must not become invalid for it.
   */
  location?: AddressLocation;
}

/** Decimal degrees on the wire; stored server-side as integer micro-degrees,
 *  the same way money is stored in minor units. `accuracyM` is the browser's
 *  own `coords.accuracy`, rounded to a whole metre. */
export interface AddressLocation {
  lat: number;
  lng: number;
  accuracyM: number;
  /** `"device"` is the Geolocation API; `"pin"` is dropped on a map. */
  source: "device" | "pin";
  /** Epoch milliseconds. */
  capturedAt: number;
}

export interface ShippingOption {
  id: string;
  label: string;
  amount: ApiMoney;
  taxable: boolean;
}

/* `TotalsLine` and `bulkOf` LIVE IN `cart-api.ts` and are re-exported here.
   The cart's own `preview` carries the identical per-line shape, and this
   module already imports from that one — putting the type here as well would
   have meant either a duplicate definition or a cycle. */
export { bulkOf } from "./cart-api";
export type { TotalsLine } from "./cart-api";

/**
 * A line that moves the total and must appear on the invoice. Today the only
 * one is a points redemption; the shape is the API's generic extension point.
 *
 * `amount` IS NEGATIVE FOR A DISCOUNT, which is why the review step renders it
 * without a sign of its own — the number already carries one, and adding a
 * second is how a discount renders as "-−₦500".
 *
 * `label` IS THE API'S OWN WORDING and is rendered verbatim. It is where the
 * programme's nouns legitimately reach the storefront: the admin composed the
 * string from the operator's configuration at the instant the total was frozen,
 * so it says what the customer agreed to even if the programme is renamed
 * afterwards. This package still spells no such noun itself.
 */
export interface Adjustment {
  code: string;
  label: string;
  amount: ApiMoney;
}

export interface FrozenTotals {
  currency: string;
  lines: TotalsLine[];
  shipping: ShippingOption | null;
  /** Empty for almost every order. See `Adjustment`. */
  adjustments: Adjustment[];
  /**
   * What the tax line IS — zone, label ("VAT") and rate — frozen with the
   * number it explains. OPTIONAL because this type ignored it until the shop
   * registered for VAT (2026-08-25) and there was no line to label; the wire
   * has always carried it. The label is the API's own wording, rendered
   * verbatim like an adjustment's.
   */
  tax?: { zone: string; label: string; rateBps: number } | null;
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
  | { code: "outside_delivery_area" }
  /**
   * The shop does not serve that part of the country AT ALL — the refusal
   * `simple` address mode produces, and a DIFFERENT code from
   * `outside_delivery_area` on purpose.
   *
   * The admin split the two because under `simple` there is no district list
   * to name, so the older code's copy ("pick a different district") is an
   * instruction the shopper cannot follow — they were never shown a picker.
   * Collapsing them here would put those words back on the screen.
   *
   * It fell through to `unknown` until now, which told a shopper to "try
   * again" for an address that will be refused identically every time.
   */
  | { code: "outside_service_region" }
  /**
   * The checkout was ALREADY PAID, and the cart is refusing to reopen.
   *
   * ═══ THE ONE REFUSAL HERE THAT MUST NEVER READ AS A FAILURE ═══
   * A capture whose inline completion failed leaves a genuinely paid cart at
   * `converting`, indistinguishable from one merely stuck there. The API
   * refuses to thaw it, and it is RIGHT to: reopening and re-freezing would
   * build the order from numbers the customer was never charged.
   *
   * This fell past both `precondition_failed` branches to `unknown`, whose
   * copy is "That didn't go through. Try again." — said to somebody whose
   * card HAS been charged, beside a control that invites them to charge it
   * again. It is the `checkout_start` fall-through this branch's own comment
   * describes, with money on the other end of it.
   *
   * Its copy must send the shopper to their ORDER, never back to the basket,
   * and must never offer a retry. See `errorCopy`.
   */
  | { code: "checkout_paid" }
  /**
   * A discount code the shop will not honour.
   *
   * `reason` IS THE API'S OWN WORD and is never shown raw — `errorCopy` maps
   * the ones this build knows and falls back to a sentence that promises
   * nothing for the ones it does not. The admin can add reasons at any time
   * (expiry, minimum spend, per-customer limits) and a storefront that printed
   * an unrecognised enum at a shopper would be worse than one that says plainly
   * that the code was not accepted.
   *
   * NOT `field`. A rejected code is not a malformed one: the input was fine and
   * the shop declined it, so the copy is about the code rather than about how
   * it was typed.
   */
  | { code: "discount_rejected"; reason: string }
  | { code: "unresolved_lines"; variantIds: string[] }
  | { code: "currency_mismatch" }
  | { code: "gone" }
  | { code: "bad_revision" }
  | { code: "field"; field: string; detail?: string }
  | { code: "network" }
  /**
   * Too many attempts on this cart. `retryAfter` is SECONDS until the window
   * reopens, straight from the API's own `Retry-After`; `null` when the 429
   * came from somewhere that named no wait, because the copy still has to say
   * something true in that case.
   *
   * THIS ONE EXISTS BECAUSE THE GENERIC ADVICE CAUSES IT. `/checkout/start`
   * allows ten attempts per cart per fifteen minutes, and the fallback banner
   * said "try again" — which is the shopper spending the rest of that budget
   * on the instruction that failed them.
   */
  | { code: "rate_limited"; retryAfter: number | null }
  /** Reached, and broken on the store's side. Split from `unknown` because it
   *  is the one refusal where "try again shortly" is honest and the shopper
   *  did nothing to cause it. */
  | { code: "server"; status: number; requestId: string | null }
  | { code: "unknown"; status: number; detail?: string; requestId: string | null };

export type CheckoutResult<T> = { ok: true; data: T } | { ok: false; error: CheckoutError };

function classify(status: number, body: Record<string, unknown> | null): CheckoutError {
  const errorCode = typeof body?.error === "string" ? body.error : null;
  const detail = typeof body?.detail === "string" ? body.detail : undefined;
  /* EVERY error the admin produces carries this, and repeats it as
     `x-request-id`. The detail it will not put in a response — the stack, the
     SQLSTATE — is in its log beside this string, so it is the whole of what
     makes a shopper's "it didn't work" findable. It used to be dropped here. */
  const requestId = typeof body?.requestId === "string" ? body.requestId : null;
  if (status === 429 || errorCode === "rate_limited") {
    return {
      code: "rate_limited",
      retryAfter: typeof body?.retryAfter === "number" ? body.retryAfter : null,
    };
  }
  if (status === 410 || errorCode === "gone") return { code: "gone" };
  if (status === 400 && detail === "baseRevision") return { code: "bad_revision" };
  /* Two spellings of one refusal: the address step refuses at the door (400
     bad_request with this detail), and the freeze refuses a district switched
     off mid-checkout (409 with this as its own error code). Same meaning,
     same screenful of copy, one code. */
  if (errorCode === "outside_delivery_area" || detail === "outside_delivery_area") {
    return { code: "outside_delivery_area" };
  }
  /* The `simple`-mode sibling of the refusal above, kept SEPARATE because the
     admin deliberately gave it its own code — there is no district list to
     name in that mode, so it cannot inherit copy that names one. Both
     spellings accepted, for the same reason the branch above accepts two. */
  if (errorCode === "outside_service_region" || detail === "outside_service_region") {
    return { code: "outside_service_region" };
  }
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
  /* `409 { error: "discount_rejected", reason: "not_found" }` — the shape the
     discount route answers with. `reason` is carried through rather than
     collapsed, so the copy can name the cause where it recognises it. */
  if (errorCode === "discount_rejected") {
    return {
      code: "discount_rejected",
      reason: typeof body?.reason === "string" ? body.reason : "rejected",
    };
  }
  if (errorCode === "precondition_failed") {
    /*
     * ═══ `operation` CARRIES TWO DIFFERENT THINGS, AND THAT COST A BUG ═══
     * Across the admin, `operation` names the OPERATION — `update_cart`,
     * `remove_line`, `capture`, `parseWebhook`. But the freeze route passes
     * its REASON through the same field, which is where `empty_cart` and
     * `no_shipping_address` come from, and this client was written to read
     * only that second sense.
     *
     * So `/checkout/start` refusing an empty cart — which it reports as
     * `operation: 'checkout_start'`, obeying the first sense — fell past both
     * branches to `unknown`, and a shopper at step 1 of 4 got "That didn't go
     * through" for a cart the store could have named as empty. That is the
     * screenful of copy already written, never reached.
     *
     * `reason` is read FIRST because it is the unambiguous field, and the
     * admin now sends it alongside `operation` rather than overloading it.
     * The two `operation` spellings stay accepted underneath: this client
     * cannot assume which version of the API it is talking to, and a
     * storefront that only works against the newest deploy of its own
     * backend is a storefront that breaks on every rollback.
     */
    const reason =
      typeof body?.reason === "string" ? body.reason : (body?.operation as string | undefined);
    /* ═══ READ FIRST, BECAUSE IT IS THE ONLY ONE THAT COSTS MONEY TO GET
       WRONG ═══
       Ordered ahead of its neighbours deliberately. The others are all
       "you cannot proceed"; this one is "you already did, and it worked". A
       future edit that adds a broader match above it would turn a paid
       checkout back into a retry prompt, so it sits where nothing can shadow
       it. Same `reason`-then-`operation` read as everything else in this
       branch — see the comment above on why both spellings stay accepted. */
    if (reason === "checkout_paid") return { code: "checkout_paid" };
    if (reason === "no_shipping_address") return { code: "no_shipping_address" };
    /* `checkout_start` IS an empty cart: that route's only other refusal is
       `insufficient_stock`, matched above. */
    if (reason === "empty_cart" || reason === "checkout_start") return { code: "empty_cart" };
  }
  if (status >= 500) return { code: "server", status, requestId };
  return { code: "unknown", status, detail, requestId };
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
  /**
   * How many points to spend, if the customer chose to spend any.
   *
   * OMITTED MEANS SPEND NOTHING, and that is the API's contract rather than
   * this client's caution: its `quote()` reads an absent value as "as much as
   * the rules allow", so the route declines to quote at all unless a number
   * arrives. Sending `0` and sending nothing both end at no discount, so this
   * omits the field entirely when there is nothing to spend rather than relying
   * on the two being equivalent.
   *
   * The API RE-DECIDES the amount against the balance at this instant and
   * against its own cap. A number here is a request, not an instruction, and
   * the returned totals are what the customer is charged.
   */
  redeemPoints?: number,
): Promise<CheckoutResult<{ totals: FrozenTotals }>> {
  return request("/checkout/freeze", {
    method: "POST",
    body: JSON.stringify(
      redeemPoints && redeemPoints > 0 ? { baseRevision, redeemPoints } : { baseRevision },
    ),
  });
}

/** The cart as the cancel route hands it back — reopened, and with the frozen
 *  totals already discarded. `status` is `"open"` on success. */
export interface ReopenedCart {
  id: string;
  status: string;
  revision: number;
  currency: string;
}

/**
 * Thaw a frozen checkout: `converting -> open`, cancelling the pending payment
 * intent and CLEARING the frozen totals.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS THE CALL THAT MAKES ABANDONING THE PAYMENT PAGE SURVIVABLE.
 *
 * A cart that reached `converting` could never go back. A shopper who was sent
 * to Paystack and did not pay — declined card, closed tab, changed their mind
 * about the address — got `409 precondition_failed` from every later address
 * or shipping edit, FOREVER, and the cart cookie kept resolving to the same
 * dead basket. The flow `idempotencyKey` describes ("abandons the review step,
 * comes back, changes the delivery option and re-freezes at a different
 * total") was written for an API that could not perform it.
 *
 * ═══ SAFE TO OVER-CALL, UNSAFE TO CALL BLINDLY ═══
 * Idempotent: an already-open cart answers 200 and writes nothing, so firing
 * it from several handlers costs nothing. But a cart that was actually PAID
 * refuses with `checkout_paid`, and that refusal must be surfaced rather than
 * swallowed — see the variant's own comment. Callers that cannot show an
 * error (an unload beacon) must still not be written as if the refusal cannot
 * happen; they simply are not the ones who report it.
 *
 * ═══ AFTER THIS, THERE ARE NO TOTALS ═══
 * `GET /checkout/totals` and `POST /payments/intents` both 404 until
 * `freezeCheckout` runs again. That is fail-closed and deliberate: it stops a
 * stale total being charged against an address that has since changed. Any
 * `FrozenTotals` still held in component state after a thaw is a number on
 * screen that nothing will honour, and must be dropped rather than reused.
 *
 * `baseRevision` IS OPTIONAL HERE, unlike every other write in this file. The
 * highest-value call sites (a bfcache restore, a tab closing) have no chance
 * to read a fresh revision first, and a guard they cannot satisfy would just
 * mean not calling at all. Pass one when there is one to pass; omitting it
 * only forgoes the `stale_write` check.
 *
 * Rate limit: 10 per cart per 15 minutes, on its OWN bucket — it does not
 * spend the `/checkout/start` allowance.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function cancelCheckout(
  baseRevision?: number,
  /**
   * `keepalive` LETS THIS OUTLIVE THE DOCUMENT, which is the only reason the
   * "closed the tab" case can be covered at all — an ordinary fetch is
   * cancelled with the page that started it.
   *
   * Not `sendBeacon`, deliberately. The commerce API is CROSS-ORIGIN and this
   * call is worthless without the cart cookie; a beacon posting JSON
   * cross-origin needs a preflight and gives no control over credentials
   * mode, whereas `fetch` carries this module's `credentials: "include"`
   * unchanged and negotiates CORS the same way every other call here does.
   */
  init?: { keepalive?: boolean },
): Promise<CheckoutResult<{ cart: ReopenedCart }>> {
  return request("/checkout/cancel", {
    method: "POST",
    keepalive: init?.keepalive,
    /* `undefined` rather than `{}` when there is nothing to send: `request()`
       sets the JSON content-type only when there IS a body, so an empty object
       would declare a content-type for no content. Compared against
       `undefined` and not falsily — revision 0 is a real revision. */
    body: baseRevision === undefined ? undefined : JSON.stringify({ baseRevision }),
  });
}

/**
 * Put a discount code on the checkout.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BODY IS `{ code }` AND THE ROUTE IS `.strict()`.
 * Sending a `discountCode` field alongside it is a `400 bad_request` naming
 * the field it did not expect — which is how this contract was discovered, so
 * it is written down rather than left to be rediscovered.
 *
 * AN EMPTY STRING IS A 400, NOT A REMOVAL. Clearing the code is `DELETE`, and
 * the two are different operations rather than two spellings of one; a caller
 * that "clears" by applying `""` gets a validation error and no change.
 *
 * ═══ IT DOES NOT WORK ON A FROZEN CHECKOUT ═══
 * The totals are frozen at `converting`, and a code applied afterwards would
 * change a price the shopper has already been quoted. The review step
 * therefore THAWS first (`cancelCheckout`), applies, and re-freezes — see
 * `reprice` in `checkout-flow.tsx`. That whole journey only became possible
 * when the cancel route shipped.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function applyDiscountCode(code: string): Promise<CheckoutResult<unknown>> {
  return request("/checkout/discount", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/** Take the discount code off again. Answers `204` with no body, which
 *  `request` reports as a success carrying null — there is nothing to read. */
export function removeDiscountCode(): Promise<CheckoutResult<unknown>> {
  return request("/checkout/discount", { method: "DELETE" });
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

