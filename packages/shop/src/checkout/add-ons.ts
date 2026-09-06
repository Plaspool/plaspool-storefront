import { COMMERCE_API_BASE } from "../data/config";
import { majorUnits } from "../data/cart-api";
import type { AddOnOffer, ApiMoney } from "../data/cart-api";
import { formatNaira } from "../data/money";

/**
 * The checkout's reading of the add-on offers — the four lists and two
 * strings every add-on surface is built from.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A PLAIN MODULE, FOR THE REASON `basket-spent.ts` IS ONE. `checkout-flow.tsx`
 * is a client component full of hooks that this suite cannot render
 * (`environment: "node"`, no jsdom), so a rule that decides which add-ons the
 * shopper is asked about, and what a totals row says about one, has to live
 * where a test can reach it.
 *
 * ═══ NOTHING HERE DECIDES, AND NOTHING HERE ADDS UP ═══
 * The API evaluates the rules and prices the result. `pendingAddOns` and
 * `appliedAddOns` are the two derivations the brief names — filters over what
 * the server said, never a verdict of their own — and `addOnRowsFor` renders
 * the amount the API froze. There is no `price × 1` and no
 * `subtotal + addOnTotal` anywhere in this file, and there must not be.
 *
 * ═══ THE COST IS `amount`, NEVER `price` ═══
 * An offer carries both. `price` is the list price — what the add-on is
 * worth — and `amount` is what the rule will actually charge, which is the
 * same figure until an operator makes packaging free over five items. Every
 * label here reads `amount`; `price` reaches no shopper-facing string.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** What the extras step has to ask about: offered, and not yet answered. */
export function pendingAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode === "ask" && offer.choice === null);
}

/** What will be on the order: included by the rules, or accepted by the
 *  shopper. */
export function appliedAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode === "include" || offer.choice === "accepted");
}

/** Every add-on the shopper was, or is being, asked about — answered or not.
 *  The review step draws a control for each of these so an answer can be
 *  changed beside the total it moves. */
export function askedAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode === "ask");
}

/** The add-ons the rules put on the order without asking — the cart drawer's
 *  quiet "included" line. Never an accepted one: the shopper knows about
 *  those, having said yes. */
export function includedAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode === "include");
}

/**
 * What an add-on costs, in words: "₦1,500", or "Free" when the rule charges
 * nothing.
 *
 * TAKES `amount`, NEVER `price`. `amount` is what the API will charge; `price`
 * is what the add-on is worth, and the two differ exactly when a rule made it
 * free or repriced it. `formatNaira(majorUnits(…))` is the same pair the
 * review step prices every line with; no symbol is invented here. "Free"
 * rather than "₦0" because a figure of nothing reads as a mistake.
 */
export function addOnAmountLabel(amount: ApiMoney): string {
  return amount.amount === 0 ? "Free" : formatNaira(majorUnits(amount));
}

/**
 * "+ ₦1,500" — the charge on an offer card, as an addition to a total the
 * shopper is already looking at — or "Free", which is not an addition to
 * anything and so carries no sign.
 */
export function addOnPriceLabel(amount: ApiMoney): string {
  return amount.amount === 0 ? "Free" : `+ ${formatNaira(majorUnits(amount))}`;
}

/**
 * The one word a totals row says for an add-on that cost nothing.
 *
 * The TITLE is the operator's; this word is ours. "Gift box — Included" is a
 * row whose label came off the wire and whose value did not, which is the
 * same split `adjustment.label` already lives with.
 */
export const INCLUDED = "Included";

/** One row of a totals panel, ready to draw: what to call it, what to print
 *  beside it. */
export interface AddOnRow {
  key: string;
  label: string;
  value: string;
}

/**
 * The add-on rows for a totals panel, in the API's order.
 *
 * ═══ ONE RULE, THREE PANELS ═══
 * The review step, the confirmation page and the order page each draw these
 * rows in their own row idiom, so what they share is the DECISION rather than
 * the markup: the label is the title verbatim, and the value is the amount
 * charged — except an included add-on that cost nothing, which reads
 * `Included` instead of `₦0`. An included add-on the operator chose to CHARGE
 * for is just a row with an amount; nothing here second-guesses that.
 *
 * `amount` is MINOR UNITS as a bare number, because that is the shape the
 * receipt snapshot and the order both carry; `FrozenAddOn.amount` is an
 * `ApiMoney` and the review step unwraps it on the way in.
 */
export function addOnRowsFor(
  addOns: ReadonlyArray<{
    id?: string;
    title: string;
    mode: "chosen" | "included";
    amount: number;
  }>,
  currency: string,
): AddOnRow[] {
  return addOns.map((addOn, index) => ({
    key: addOn.id ?? `add-on-${index}`,
    label: addOn.title,
    value:
      addOn.mode === "included" && addOn.amount === 0
        ? INCLUDED
        : formatNaira(majorUnits({ amount: addOn.amount, currency })),
  }));
}

/**
 * Where an add-on's picture is actually fetched from.
 *
 * THE SAME RULE AS `imageUrl()` IN `data/api.ts`, spelled again here on
 * purpose: that module is the catalogue client and reaches only the SERVER
 * bundle today, and the offer card is a client component. Importing one
 * five-line function from it would pull the whole catalogue client across
 * the boundary for every shopper who reaches checkout. `/api/public/images/
 * <id>` goes through the storefront's own proxy at `/images/shop/<id>` — the
 * cacheable route every product picture already uses — and any other path on
 * the API origin is fetched from there directly.
 */
const IMAGE_PATH = /^\/api\/public\/images\/([A-Za-z0-9_-]+)$/;

export function addOnImageSrc(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const id = IMAGE_PATH.exec(path)?.[1];
  return id ? `/images/shop/${id}` : `${COMMERCE_API_BASE}${path}`;
}
