import type { CheckoutError } from "../data/checkout-api";
import type { AddressMode } from "../data/delivery-config";
import { isMysteryBox } from "../data/mystery-box";
import type { ResolvedLine } from "../cart/types";

/**
 * The basket's mystery-box lines: variant id → the size's name, or null for a
 * box with one unnamed size. See `boxVariantIdsOf`.
 */
export type BoxVariantIds = ReadonlyMap<string, string | null>;

/**
 * The basket's mystery-box variant ids, looked up through the catalogue entry
 * each line was resolved against — a `Shortfall` names a variant and nothing
 * else, so the cart is the only place that knows whether it is a box.
 */
export function boxVariantIdsOf(lines: readonly ResolvedLine[]): BoxVariantIds {
  const ids = new Map<string, string | null>();
  for (const line of lines) {
    if (!isMysteryBox(line.product)) continue;
    const id = line.product.variantIds[`${line.colour.id}:${line.size.id}`];
    /* THE SIZE'S OWN NAME, so the refusal can say WHICH box sold out — a
       basket may hold two sizes of one box. An unnamed size carries null, and
       the copy then says "box" rather than naming something that has no name. */
    if (id) ids.set(id, line.size.label || null);
  }
  return ids;
}

/**
 * Checkout's failure copy, lifted out of `checkout-flow.tsx`.
 *
 * It moved because it is the one part of that 1,000-line client component with
 * no React in it at all — pure `CheckoutError` in, two strings out — and the
 * component cannot be rendered by this suite (it is a client component full of
 * hooks, and the runner is `environment: "node"` with no jsdom, deliberately).
 * Left where it was, the words a shopper actually reads were the only part of
 * the checkout that nothing could assert on.
 */

/**
 * How long until the rate-limit window reopens, in words.
 *
 * ROUNDS UP, and that is the whole reason this is a function. `retryAfter` is
 * the seconds REMAINING, so 61 seconds rounded down is "about a minute" — an
 * instruction that sends the shopper back a minute early to spend another
 * attempt on the same refusal, and the refusal is a spent-attempts counter.
 * Round up and the next try is inside the new window.
 *
 * `null` and `0` both answer the vague phrase rather than a number: neither
 * "about 0 minutes" nor a confident figure derived from nothing is honest.
 */
export function retryWaitLabel(retryAfter: number | null): string {
  if (!retryAfter || retryAfter <= 0) return "a few minutes";
  const minutes = Math.ceil(retryAfter / 60);
  return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
}

/**
 * What the freeze refused, in the numbers it refused it with.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE API SENT THE NUMBER AND THIS FUNCTION USED TO BIN IT.
 *
 * `Shortfall` carries `requested` and `available` per variant, and the admin's
 * route says exactly why:
 *
 *     // THE NUMBER, in the body. "Out of stock" is not actionable; "only 3
 *     // left" lets the shopper reduce the quantity without leaving the page.
 *
 * The copy here read `shortfalls.length` and nothing else — "2 items in the
 * cart no longer have enough stock" — which names no item, gives no number, and
 * sends the shopper back to a basket where nothing is marked. Every fact needed
 * to act was in the response and none of it reached the screen.
 *
 * ═══ WHY NO PRODUCT NAME, WHEN A SHOPPER WOULD WANT ONE ═══
 * A `Shortfall` identifies its line by `variantId`, and this module is pure —
 * `CheckoutError` in, two strings out, which is the only reason the words a
 * shopper reads are assertable at all (the flow around it is a client component
 * this `environment: "node"` suite cannot render). Resolving a name means
 * handing it the catalogue, and the catalogue is exactly what a stale checkout
 * may no longer agree with.
 *
 * So the number does the work, and the CART does the naming: every basket row
 * now carries its own "Only N left" off the line's live `inStock`, which is
 * fresher than anything this refusal could reconstruct. See `stock.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function shortfallBody(
  shortfalls: { variantId?: string; requested: number; available: number }[],
  boxVariantIds: BoxVariantIds = new Map(),
): string {
  /* A refusal with no detail is still a refusal, and it must not render as
     "0 items". The API always sends at least one, so this is the shape-changed
     case rather than an expected one — and it degrades to the instruction,
     which is the half the shopper can still act on. */
  if (shortfalls.length === 0) {
    return "Something in your cart is no longer fully in stock. Go back to the cart and adjust the quantity.";
  }

  /* ONE LINE, ONE SENTENCE, WITH BOTH NUMBERS. This is the common case by a
     distance, and it is the one where the shopper can act without hunting:
     they know what they asked for and now they know what there is. */
  if (shortfalls.length === 1) {
    const { requested, available, variantId } = shortfalls[0];
    /* ═══ A BOX IS REFUSED BY WHAT CAN BE FILLED, NOT A SHELF ═══
       For a box, `available` is already how many more can be filled, so the
       sentence talks about boxes. The instruction — lower it or remove it — is
       the same. */
    if (variantId !== undefined && boxVariantIds.has(variantId)) {
      const sizeName = boxVariantIds.get(variantId) ?? null;
      const box = sizeName ? `${sizeName} box` : "box";
      if (available <= 0) {
        return sizeName
          ? `That size has just sold out. Go back to the cart and remove it to continue.`
          : "The mystery box has just sold out. Go back to the cart and remove it to continue.";
      }
      return `Only ${available} more ${available === 1 ? `${box} is` : `${box}es are`} available. Go back to the cart and lower the quantity to continue.`;
    }
    /* `available` CAN BE ZERO — the stock went while they were checking out.
       "Only 0 left" is a sentence no shop should print; the item is gone and
       the instruction is different. */
    if (available <= 0) {
      return "An item in your cart has sold out since you added it. Go back to the cart and remove it to continue.";
    }
    return `You asked for ${requested} of an item and only ${available} ${available === 1 ? "is" : "are"} left. Go back to the cart and lower the quantity to continue.`;
  }

  /* SEVERAL LINES: the count, then the promise that the cart names them. It
     does — each row carries its own "Only N left" — so this is a pointer to
     information that exists rather than the dead end the old copy was. */
  return `${shortfalls.length} items in your cart no longer have enough stock. Go back to the cart — each one shows how many are left.`;
}

/** The register from `empty-state.tsx`: what happened, and what to do about
 *  it. Never "Sorry", never vague. */
export function errorCopy(
  error: CheckoutError,
  /** The shop may not be asking for a district at all — see the
   *  `outside_delivery_area` case. Defaults to `district`, so a call site that
   *  does not know the mode gets the wording this function always had. */
  mode: AddressMode = "district",
  /** Mystery-box variant ids in the basket, so a box shortfall reads as one. */
  boxVariantIds?: BoxVariantIds,
): { title: string; body: string } {
  switch (error.code) {
    case "empty_cart":
      return { title: "Your cart is empty", body: "Add something to the cart before checking out." };
    case "insufficient_stock":
      return { title: "Not enough in stock", body: shortfallBody(error.shortfalls, boxVariantIds) };
    case "no_shipping_address":
      return { title: "No delivery address on file", body: "Enter a delivery address before choosing a delivery option." };
    case "outside_delivery_area":
      /* THE HANDLER STAYS IN BOTH MODES (§6.4). The server can still refuse
         under `simple` — `servedRegions` is the documented way — and this is
         the only thing that tells the shopper why. Only the WORDING moves:
         naming a district to a shopper who was never shown one is an
         instruction they cannot follow. */
      return mode === "district"
        ? {
            title: "We don't deliver to that district yet",
            body: "Pick a different district — or leave the district blank to use your state's standard delivery.",
          }
        : {
            title: "We don't deliver to that address yet",
            body: "Check the state and town are right. If they are, we don't reach there yet — contact us and we'll see what we can do.",
          };
    case "add_on_not_offered":
      /* The cart changed, or the rules did, between the offer and the answer.
         The flow re-reads the offers and re-renders without a banner — the
         brief is explicit — so this too is a fallback. It blames nobody, and
         it says the order is otherwise fine, because it is. */
      return {
        title: "That extra is no longer offered",
        body: "The offer changed while you were deciding. Your order is otherwise ready — carry on without it.",
      };
    case "outside_service_region":
      /* THE `simple`-MODE REFUSAL, AND IT NEEDS ITS OWN SENTENCE. The admin
         gave this a different code from `outside_delivery_area` precisely
         because there is no district list to name here — so this copy names
         no district, in either mode, and does not tell the shopper to change
         one they were never shown.

         IT ALSO DOES NOT SAY "TRY AGAIN". The same address refused once will
         be refused identically every time; the only moves that exist are a
         different address or talking to us, so those are the two offered. */
      return {
        title: "We don't deliver to that area yet",
        body: "We don't reach that part of the country yet. Try a different delivery address, or contact us and we'll see what we can do.",
      };
    case "checkout_paid":
      /* ═══ THE ONLY "ERROR" ON THIS SCREEN THAT IS GOOD NEWS ═══
         The payment succeeded and its inline completion did not, so the cart
         is stuck at `converting` while the money is gone and an order is
         being built from it. This reached the shopper as the default's "That
         didn't go through. Try again." — an instruction to pay twice, beside
         a live Pay button.

         THREE THINGS THIS COPY OWES, none of which the default can give:
         it says the payment WORKED; it never offers a retry; and it points at
         their ORDERS, never at the cart — the cart is where a second attempt
         begins. "don't pay again" is stated outright rather than implied,
         because the person reading it is looking at a screen that just showed
         them a failure banner. */
      return {
        title: "Your payment went through",
        body: "This order is already paid and we're finishing it now. Check your orders for the confirmation — don't pay again.",
      };
    case "discount_rejected":
      /* ═══ THE REASON IS NAMED ONLY WHERE IT IS RECOGNISED ═══
         `reason` is the admin's own enum and it will grow — expiry, minimum
         spend, per-customer limits. Printing an unrecognised value at a
         shopper ("Discount rejected: min_subtotal_not_met") is worse than
         saying plainly that the code was not accepted, so unknown reasons get
         a sentence that promises nothing and blames nobody.

         NOTHING HERE SUGGESTS RETRYING THE SAME CODE. It will be refused
         identically every time; the moves that exist are a different code or
         carrying on without one. */
      return {
        title:
          error.reason === "not_found"
            ? "That code isn't recognised"
            : "That code can't be used",
        body:
          error.reason === "not_found"
            ? "Check the spelling, or carry on without it — your order is otherwise ready."
            : "It may have expired or not apply to this order. Carry on without it, or try a different code.",
      };
    case "unresolved_lines":
      return { title: "An item in the cart is no longer available", body: "Go back to the cart and remove it, then try again." };
    case "currency_mismatch":
      return { title: "Currency mismatch", body: "The store currency changed mid-checkout. Start again from the cart." };
    case "gone":
      return {
        title: "This checkout has expired",
        body: "The stock held for this order was released. Your cart still has the items — start checkout again.",
      };
    case "bad_revision":
      return { title: "The cart changed elsewhere", body: "Reload and try again — something else updated this cart in the meantime." };
    case "field":
      return {
        title: `Check the ${error.field}`,
        body:
          error.field === "email"
            ? "That email address was refused. Use one the payment provider will accept."
            : `The ${error.field} field was refused. Check it and try again.`,
      };
    case "network":
      return { title: "Couldn't reach the store", body: "Check your connection and try again." };
    case "rate_limited":
      return {
        title: "Too many attempts",
        body: `Wait ${retryWaitLabel(error.retryAfter)}, then try again. Nothing has been ordered and your cart is safe.`,
      };
    case "server":
      /* WHOSE FAULT IT IS, SAID OUT LOUD. A shopper who has just typed their
         address into a form reads any failure as something they did to it, and
         the next thing they do is edit an address that was never wrong. */
      return {
        title: "The store is having a problem",
        body: "This is on our side, not yours. Your cart is safe — try again in a few minutes.",
      };
    default:
      /* The genuine unknown. The two bodies differ ONLY on whether there is a
         reference to point at — copy telling someone to quote "the reference
         below" under a banner with nothing below it is worse than vague, so
         the words and the rendered reference are decided in one place. */
      return {
        title: "That didn't go through",
        body:
          "requestId" in error && error.requestId
            ? "Try again. If it keeps happening, send us the reference below and we'll find it in our logs."
            : "Try again. If it keeps happening, get in touch and we'll look into it.",
      };
  }
}
