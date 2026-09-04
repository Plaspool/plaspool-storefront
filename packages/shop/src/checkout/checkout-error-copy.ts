import type { CheckoutError } from "../data/checkout-api";
import type { AddressMode } from "../data/delivery-config";

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

/** The register from `empty-state.tsx`: what happened, and what to do about
 *  it. Never "Sorry", never vague. */
export function errorCopy(
  error: CheckoutError,
  /** The shop may not be asking for a district at all — see the
   *  `outside_delivery_area` case. Defaults to `district`, so a call site that
   *  does not know the mode gets the wording this function always had. */
  mode: AddressMode = "district",
): { title: string; body: string } {
  switch (error.code) {
    case "empty_cart":
      return { title: "Your cart is empty", body: "Add something to the cart before checking out." };
    case "insufficient_stock":
      return {
        title: "Not enough in stock",
        body: `${error.shortfalls.length} item${error.shortfalls.length === 1 ? "" : "s"} in the cart no longer have enough stock. Go back to the cart and adjust the quantity.`,
      };
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
