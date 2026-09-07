import { COMMERCE_API_BASE } from "../data/config";
import { majorUnits } from "../data/cart-api";
import type { AddOnBasis, AddOnOffer, ApiMoney } from "../data/cart-api";
import { formatNaira } from "../data/money";

/**
 * The checkout's reading of the add-on offers — the lists and strings every
 * add-on surface is built from.
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
 * `appliedAddOns` are filters over what the server said, never a verdict of
 * their own — and `addOnRowsFor` renders the amount the API froze. There is no
 * `subtotal + addOnTotal` anywhere in this file, and there must not be.
 *
 * `unitAmount × units` DOES appear, in `potentialSavingOf` and
 * `addOnUnitLabel`, and that is not an exception to the rule: it is the
 * ARITHMETIC SHOWN BESIDE the price ("₦500 each × 4"), never the price itself.
 * The server clamps a saving to the goods subtotal, so the product of those
 * two fields can legitimately exceed `amount` — which is why every figure that
 * moves a bill reads `amount`, and only figures that EXPLAIN one read the pair.
 *
 * ═══ THE COST IS `amount`, NEVER `price` ═══
 * An offer carries both. `price` is the list price — what the add-on is
 * worth — and `amount` is what the rule will actually charge, which is the
 * same figure until an operator makes packaging free over five items. Every
 * label here reads `amount`; `price` reaches no shopper-facing string.
 *
 * ═══ `opt_out` IS THE MODE THAT PAYS MONEY BACK ═══
 * Its cost is already inside the product price. Keeping it is free — not
 * because it is a gift, but because it has been bought already — and DECLINING
 * it is what costs the shop money, so `amount` goes negative. Two consequences
 * run through every function below:
 *
 *   - `choice: null` and `choice: "accepted"` are the SAME STATE. An
 *     unanswered `opt_out` is already applied, at zero. Nothing may render it
 *     as "not added yet", and nothing may put a charge beside it.
 *   - a negative `amount` is a SAVING and is labelled as one. `formatNaira`
 *     would spell it `-₦2,000`, a charge wearing a minus sign; `savingLabel`
 *     spells `− ₦2,000`, mirroring `addOnPriceLabel`'s `+ ₦1,500`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * What the shop still has to ask about: offered, and not yet answered.
 *
 * `mode !== "include"` RATHER THAN `mode === "ask"`. An `opt_out` add-on is a
 * question too — "shall we leave the boxes out?" — and gating on `"ask"` alone
 * is the single change that would make this whole feature invisible: the
 * extras step would never appear for the one add-on that is configured.
 */
export function pendingAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode !== "include" && offer.choice === null);
}

/**
 * What will be on the order: included by the rules, accepted by the shopper,
 * or an `opt_out` in either of its states.
 *
 * EVERY `opt_out` IS APPLIED, which reads oddly until you notice that both of
 * its outcomes put a line on the bill: kept, it is applied at `0` and a box
 * still goes in the parcel; declined, it is applied at a negative amount and
 * money comes off. The only add-on that is not on the order is an `ask` nobody
 * said yes to.
 */
export function appliedAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode !== "ask" || offer.choice === "accepted");
}

/** Every add-on the shopper was, or is being, asked about — answered or not.
 *  The review step draws a control for each of these so an answer can be
 *  changed beside the total it moves. `opt_out` included, for the reason
 *  `pendingAddOns` gives. */
export function askedAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode !== "include");
}

/** The add-ons the rules put on the order without asking — the cart drawer's
 *  quiet "included" line. Never an accepted one: the shopper knows about
 *  those, having said yes. Never an `opt_out` either — the shopper has a say
 *  over those, and this line is for the ones they do not. */
export function includedAddOns(offers: AddOnOffer[]): AddOnOffer[] {
  return offers.filter((offer) => offer.mode === "include");
}

/**
 * ═══ THE THREE DEFENSIVE READERS ═══
 * `unitAmount`, `units` and `basis` arrived with per-item pricing, so every
 * response written before it — and every order placed before it — carries none
 * of them. Reading them strictly would render every historical order as
 * corrupt, so each has one fallback describing exactly what those servers
 * meant: one unit, charged once for the order, costing the whole amount.
 */

/** What one unit costs — signed — falling back to the whole amount. */
export function addOnUnitAmount(offer: {
  amount: ApiMoney;
  unitAmount?: ApiMoney | null;
}): ApiMoney {
  return offer.unitAmount ?? offer.amount;
}

/** How many units the amount covers. `1` on anything that predates the field,
 *  and on anything charged per order. */
export function addOnUnits(offer: { units?: number | null }): number {
  return typeof offer.units === "number" && Number.isFinite(offer.units) ? offer.units : 1;
}

/** Whether it is charged once per order or once per item. */
export function addOnBasisOf(offer: { basis?: AddOnBasis | null }): AddOnBasis {
  return offer.basis ?? "order";
}

/** True when this amount takes money off the bill rather than putting it on. */
export function isSaving(amount: ApiMoney): boolean {
  return amount.amount < 0;
}

/**
 * What the shopper would get back by declining an `opt_out` offer they have
 * not answered yet, in minor units, always positive.
 *
 * THE PRODUCT PAGE'S NUMBER, and the one place a multiplication is the only
 * honest answer. Before there is a cart there is no charge to read — an
 * unanswered `opt_out` is priced at `0`, because that is what it costs to
 * keep — so the saving on offer has to come from `unitAmount × units`. The
 * clamp that can make that disagree with `amount` only exists once there is a
 * basket to clamp against, and from that moment the cart is authoritative.
 */
export function potentialSavingOf(offer: AddOnOffer): number {
  return Math.abs(addOnUnitAmount(offer).amount) * addOnUnits(offer);
}

/**
 * "− ₦2,000" — money coming off, spelled so it cannot be read as a charge.
 *
 * MIRRORS `addOnPriceLabel`'s `"+ ₦1,500"`, and uses U+2212 MINUS SIGN rather
 * than the hyphen `formatNaira` emits for a negative. `-₦2,000` is a charge
 * that happens to have a minus in front of it; `− ₦2,000` is a subtraction,
 * and at this size the two are told apart by the spacing as much as by the
 * glyph. Takes minor units of either sign and prints the magnitude.
 */
export function savingLabel(minorUnits: number): string {
  return `− ${savingAmountLabel(minorUnits)}`;
}

/** The same magnitude WITHOUT the sign — "₦2,000" — for a sentence that
 *  already carries the direction in words ("save ₦2,000"). A "− " in front of
 *  that would say the saving twice and read as a negative saving. */
export function savingAmountLabel(minorUnits: number): string {
  return formatNaira(majorUnits({ amount: Math.abs(minorUnits), currency: "NGN" }));
}

/**
 * What an add-on costs, in words: "₦1,500", "Free" when the rule charges
 * nothing, or "− ₦2,000" when it pays money back.
 *
 * TAKES `amount`, NEVER `price`. `amount` is what the API will charge; `price`
 * is what the add-on is worth, and the two differ exactly when a rule made it
 * free or repriced it. "Free" rather than "₦0" because a figure of nothing
 * reads as a mistake.
 */
export function addOnAmountLabel(amount: ApiMoney): string {
  if (isSaving(amount)) return savingLabel(amount.amount);
  return amount.amount === 0 ? "Free" : formatNaira(majorUnits(amount));
}

/**
 * "+ ₦1,500" — the charge on an offer card, as an addition to a total the
 * shopper is already looking at — or "Free", which is not an addition to
 * anything and so carries no sign, or a saving, which is a subtraction.
 */
export function addOnPriceLabel(amount: ApiMoney): string {
  if (isSaving(amount)) return savingLabel(amount.amount);
  return amount.amount === 0 ? "Free" : `+ ${formatNaira(majorUnits(amount))}`;
}

/**
 * "₦500 each × 4" — the arithmetic behind a per-item add-on, or `null` when
 * there is none worth showing.
 *
 * ONLY FOR `basis === "item"`, and only above one unit. "₦500 each × 1" is a
 * sum nobody needed spelled out, and an order-basis add-on has no per-unit
 * story at all — its unit IS the order. The MAGNITUDE is used because the sign
 * belongs to the total beside it, not to the unit price: "− ₦500 each" would
 * claim every individual box is a refund.
 */
export function addOnUnitLabel(offer: AddOnOffer): string | null {
  if (addOnBasisOf(offer) !== "item") return null;
  const units = addOnUnits(offer);
  if (units <= 1) return null;
  const unit = Math.abs(addOnUnitAmount(offer).amount);
  return `${formatNaira(majorUnits({ amount: unit, currency: "NGN" }))} each × ${units}`;
}

/**
 * The one word a totals row says for an add-on that cost nothing.
 *
 * The TITLE is the operator's; this word is ours. "Gift box — Included" is a
 * row whose label came off the wire and whose value did not, which is the
 * same split `adjustment.label` already lives with.
 */
export const INCLUDED = "Included";

/** What a totals row says for an add-on the shopper took back out. Paired with
 *  a negative value, so the row reads "Packaging — Removed … − ₦2,000". */
export const REMOVED = "Removed";

/** One row of a totals panel, ready to draw: what to call it, what to print
 *  beside it. */
export interface AddOnRow {
  key: string;
  label: string;
  value: string;
  /** True when `value` is money coming OFF the bill, so a panel can caption or
   *  colour it as a saving rather than leaving one glyph to do all the work. */
  saving: boolean;
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
 * ═══ A PLACED ORDER SPELLS THE MODES DIFFERENTLY ═══
 * `chosen | included | removed`, not `ask | include | opt_out`: the order
 * records what HAPPENED, while the offer describes what was on the table.
 * `included` covers both a rule adding it and an `opt_out` the shopper kept —
 * a box went in the parcel either way — and `removed` is the only one whose
 * amount is negative. A `removed` row must read as a refund, which is why it
 * is labelled as well as signed: the glyph alone is one pixel of difference
 * between "we charged you" and "we paid you back".
 *
 * `amount` is MINOR UNITS as a bare number, because that is the shape the
 * receipt snapshot and the order both carry; `FrozenAddOn.amount` is an
 * `ApiMoney` and the review step unwraps it on the way in.
 */
export function addOnRowsFor(
  addOns: ReadonlyArray<{
    id?: string;
    title: string;
    mode: "chosen" | "included" | "removed";
    amount: number;
  }>,
  currency: string,
): AddOnRow[] {
  return addOns.map((addOn, index) => {
    const saving = addOn.amount < 0;
    const included = addOn.mode === "included" && addOn.amount === 0;
    return {
      key: addOn.id ?? `add-on-${index}`,
      label: addOn.mode === "removed" ? `${addOn.title} — ${REMOVED}` : addOn.title,
      value: saving
        ? savingLabel(addOn.amount)
        : included
          ? INCLUDED
          : formatNaira(majorUnits({ amount: addOn.amount, currency })),
      saving,
    };
  });
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
